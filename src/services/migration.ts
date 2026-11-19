// Moving from the old address (robinsout.github.io/crema-catalana) to this one: a bridge page there
// reads the old browser storage and sends it in the address, #/import/<payload>. The payload is
// untrusted (anyone can craft a link), so everything is validated and size-capped here.
import { mergeProgress, parseProgress, type Progress } from './progress.ts';
import { parseCode } from './sync.ts';

const MAX_PAYLOAD = 100_000; // characters of the address part
const MAX_BYTES = 1_000_000; // after decompression
const DEFLATED = 1;
const PLAIN = 0;

export interface Imported {
  progress: Progress | null;
  syncCode: string | null;
}

// reads a stream up to `limit` bytes; null when it is longer (a deflate bomb is cut off at once)
async function readCapped(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) { await reader.cancel().catch(() => {}); return null; }
      chunks.push(value);
    }
  } catch { return null; }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

const fromBase64Url = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

export async function decodeImport(payload: string): Promise<Imported | null> {
  if (payload.length === 0 || payload.length > MAX_PAYLOAD || !/^[A-Za-z0-9_-]+$/.test(payload)) return null;
  let bytes: Uint8Array<ArrayBuffer>;
  try { bytes = fromBase64Url(payload); } catch { return null; }
  const marker = bytes[0];
  const rest = bytes.slice(1);
  let json: Uint8Array | null;
  if (marker === DEFLATED) {
    try { json = await readCapped(new Blob([rest]).stream().pipeThrough(new DecompressionStream('deflate-raw')), MAX_BYTES); } catch { return null; }
  } else if (marker === PLAIN) json = rest.length <= MAX_BYTES ? rest : null;
  else return null;
  if (!json) return null;
  let data: unknown;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(json)); } catch { return null; }
  if (!isObject(data) || data.v !== 1) return null;
  const progress = typeof data.progress === 'string' ? parseProgress(data.progress) : null;
  let syncCode: string | null = null;
  if (typeof data.sync === 'string') {
    try {
      const s: unknown = JSON.parse(data.sync);
      if (isObject(s) && typeof s.code === 'string') syncCode = parseCode(s.code);
    } catch { /* no code */ }
  }
  return { progress, syncCode };
}

const clampTimes = <T extends { at: number }>(map: Record<string, T>, now: number): Record<string, T> =>
  Object.fromEntries(Object.entries(map).map(([k, v]) => [k, { ...v, at: Math.min(v.at, now) }]));

// Merges imported progress into this device's: the later change wins, so newer local data is never
// overwritten. Times are cut to `now`: a crafted link must not plant entries "from the future" that
// would beat every later real change (here and on synced devices). Device-only fields are taken
// only when this device has none; no other incoming fields are copied.
export function importProgress(local: Progress, incoming: Progress, now: number): Progress {
  const clamped: Progress = {
    ...incoming,
    doneAt: Object.fromEntries(Object.entries(incoming.doneAt).map(([k, v]) => [k, Math.min(v, now)])),
    exercises: clampTimes(incoming.exercises, now),
    sections: clampTimes(incoming.sections, now),
    reading: clampTimes(incoming.reading, now),
  };
  const out = mergeProgress(local, clamped);
  if (local.last === null && incoming.last !== null) out.last = incoming.last;
  for (const f of ['lastLesson', 'locale', 'verbTenses', 'trainer', 'lastArea', 'verbsTab', 'recentVerbs'] as const) {
    if (local[f] === undefined && incoming[f] !== undefined) out[f] = incoming[f] as never;
  }
  return out;
}
