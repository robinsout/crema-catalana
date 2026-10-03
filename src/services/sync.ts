// Sync between devices without accounts.
//
// A sync code is 128 random bits written as 26 Crockford base32 characters plus one check character.
// From the code (HKDF-SHA256) come two independent values: the storage id the server sees, and an
// AES-GCM key that never leaves the device. The server stores only encrypted progress.
import { mergeProgress, parseProgress, type Progress } from './progress.ts';
import { syncApi, SyncHttpError } from '../api/sync.ts';
import { syncStorage } from '../api/storage.ts';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford: no I, L, O, U
const DATA_CHARS = 26; // 128 bits (+2 zero bits)

// ---------- code ----------

function checkChar(data: string): string {
  // weighted sum with odd weights: any single wrong character changes the check
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += ALPHABET.indexOf(data[i] ?? '') * (2 * i + 1);
  return ALPHABET[sum % 32] ?? '0';
}

function encodeBits(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function decodeBits(text: string): Uint8Array {
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of text) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
    value &= (1 << bits) - 1;
  }
  return new Uint8Array(bytes);
}

export function generateCode(): string {
  const data = encodeBits(crypto.getRandomValues(new Uint8Array(16)));
  return data + checkChar(data);
}

// "ABCD-EFGH-…" for people
export const formatCode = (code: string): string => code.match(/.{1,4}/g)?.join('-') ?? code;

// Accepts what people type: any case, spaces or dashes, O for 0, I/L for 1. Returns null for a wrong code.
export function parseCode(input: string): string | null {
  const text = input.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  if (text.length !== DATA_CHARS + 1) return null;
  const data = text.slice(0, DATA_CHARS);
  if ([...data].some((c) => !ALPHABET.includes(c))) return null;
  if (checkChar(data) !== text[DATA_CHARS]) return null;
  return text;
}

// ---------- keys and encryption ----------

export interface SyncKeys {
  id: string; // 32 hex characters, the only thing the server learns
  key: CryptoKey;
}

const utf8 = (s: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(s) as Uint8Array<ArrayBuffer>;
const toHex = (buf: ArrayBuffer): string => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function deriveKeys(code: string): Promise<SyncKeys> {
  const secret = decodeBits(code.slice(0, DATA_CHARS)).slice(0, 16);
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits', 'deriveKey']);
  const params = (info: string) => ({ name: 'HKDF', hash: 'SHA-256', salt: utf8('quadern-sync-v1'), info: utf8(info) });
  const id = toHex(await crypto.subtle.deriveBits(params('storage-id'), base, 128));
  const key = await crypto.subtle.deriveKey(params('progress-key'), base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return { id, key };
}

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(text), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;

// base64 of a random 12-byte IV followed by the AES-GCM ciphertext (which includes the auth tag)
export async function encryptJson(key: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8(JSON.stringify(value))));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return toBase64(out);
}

export async function decryptJson(key: CryptoKey, data: string): Promise<unknown> {
  const bytes = fromBase64(data);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return JSON.parse(new TextDecoder().decode(plain)) as unknown;
}

// ---------- the sync loop ----------

export interface SyncApi {
  get(id: string): Promise<{ data: string; version: number } | null>;
  put(id: string, data: string, version: number | null): Promise<{ ok: boolean; version: number | null }>;
}

// what leaves the device: marks and exercise results; the last opened view stays local
const syncable = (p: Pick<Progress, 'done' | 'doneAt' | 'exercises'>) => ({ done: p.done, doneAt: p.doneAt, exercises: p.exercises });

// JSON with sorted keys, to compare progress regardless of key order
const stable = (v: unknown): string => JSON.stringify(v, (_, x: unknown) =>
  x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
    : x);

// Downloads the shared progress, merges it with the local one and uploads the result when it
// differs. Retries when another device wrote in between. Returns the merged progress.
export async function syncOnce(api: SyncApi, keys: SyncKeys, local: Progress, attempts = 4): Promise<Progress> {
  for (let i = 0; i < attempts; i++) {
    const remote = await api.get(keys.id);
    const shared = remote ? parseProgress(JSON.stringify(await decryptJson(keys.key, remote.data))) : null;
    const merged = shared ? mergeProgress(local, shared) : { ...local };
    const payload = syncable(merged);
    if (shared && stable(payload) === stable(syncable(shared))) return merged;
    const r = await api.put(keys.id, await encryptJson(keys.key, payload), remote?.version ?? null);
    if (r.ok) return merged;
  }
  throw new Error('sync: the shared progress kept changing, try again later');
}

// ---------- this device ----------
// (the loop above takes the API as a parameter; these use the real server and browser storage)

export { SYNC_URL } from '../api/sync.ts';

// the saved sync of this device, when its code is still valid
export function savedSync(): { code: string; lastSyncAt: number | null } | null {
  const r = syncStorage.read();
  return r && parseCode(r.code) ? { code: r.code, lastSyncAt: r.lastSyncAt ?? null } : null;
}
export const saveSync = (code: string, lastSyncAt: number | null): void =>
  syncStorage.write(lastSyncAt === null ? { code } : { code, lastSyncAt });
export const clearSync = (): void => syncStorage.clear();

let cached: { code: string; keys: Promise<SyncKeys> } | null = null;
const keysFor = (code: string): Promise<SyncKeys> => {
  if (cached?.code !== code) cached = { code, keys: deriveKeys(code) };
  return cached.keys;
};

export type SyncFailure = 'offline' | 'server' | 'data';

// why a sync failed, in words the interface can show
export function syncFailure(e: unknown): SyncFailure {
  if (e instanceof SyncHttpError) return 'server';
  if (e instanceof TypeError) return 'offline'; // fetch could not reach the server
  return 'data';
}

export async function syncProgress(code: string, local: Progress): Promise<Progress> {
  return syncOnce(syncApi, await keysFor(code), local);
}

export async function forgetRemoteProgress(code: string): Promise<void> {
  await syncApi.remove((await keysFor(code)).id);
}
