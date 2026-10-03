// @vitest-environment node
// Sync on the device: code, keys, encryption and the merge loop (WebCrypto of Node 24).
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  generateCode, parseCode, formatCode, deriveKeys, encryptJson, decryptJson, syncOnce, type SyncApi,
} from '../src/services/sync.ts';
import type { Progress } from '../src/services/progress.ts';

test('a new code is 27 characters (26 + check) in groups, and parses back', () => {
  const code = generateCode();
  assert.match(formatCode(code), /^([0-9A-Z]{4}-){6}[0-9A-Z]{3}$/);
  assert.equal(parseCode(formatCode(code)), code);
  assert.notEqual(generateCode(), code);
});

test('parsing forgives case, spaces, dashes and look-alike letters', () => {
  const code = generateCode();
  const messy = ` ${formatCode(code).toLowerCase().replace(/-/g, ' ')} `.replace(/0/g, 'o').replace(/1/g, 'l');
  assert.equal(parseCode(messy), code);
});

test('a typo in a code is detected by the check character', () => {
  const code = generateCode();
  const chars = code.split('');
  chars[5] = chars[5] === 'A' ? 'B' : 'A';
  assert.equal(parseCode(chars.join('')), null);
  assert.equal(parseCode('too-short'), null);
  assert.equal(parseCode(''), null);
});

test('keys: the same code gives the same id and key; the id does not reveal the code', async () => {
  const code = generateCode();
  const a = await deriveKeys(code);
  const b = await deriveKeys(code);
  assert.match(a.id, /^[0-9a-f]{32}$/);
  assert.equal(a.id, b.id);
  assert.ok(!a.id.toUpperCase().includes(code.slice(0, 8)));
  const other = await deriveKeys(generateCode());
  assert.notEqual(other.id, a.id);
});

test('encryption round trip; another key cannot read the data; every encryption differs', async () => {
  const { key } = await deriveKeys(generateCode());
  const data = { done: { intro: true }, note: 'àèç' };
  const c1 = await encryptJson(key, data);
  const c2 = await encryptJson(key, data);
  assert.notEqual(c1, c2, 'random IV');
  assert.deepEqual(await decryptJson(key, c1), data);
  const { key: wrong } = await deriveKeys(generateCode());
  await assert.rejects(decryptJson(wrong, c1));
  await assert.rejects(decryptJson(key, `${c1.slice(0, -4)}AAAA`), 'tampering is detected');
});

// an in-memory server with the API contract
function fakeServer() {
  const blobs = new Map<string, { data: string; version: number }>();
  let conflictOnce = false;
  const api: SyncApi = {
    async get(id) { return blobs.get(id) ?? null; },
    async put(id, data, version) {
      const cur = blobs.get(id);
      if (conflictOnce) { conflictOnce = false; return { ok: false, version: cur?.version ?? null }; }
      if ((cur?.version ?? null) !== version) return { ok: false, version: cur?.version ?? null };
      const next = { data, version: (version ?? 0) + 1 };
      blobs.set(id, next);
      return { ok: true, version: next.version };
    },
  };
  return { api, blobs, failNextPut: () => { conflictOnce = true; } };
}

const progress = (p: Partial<Progress>): Progress => ({ done: {}, doneAt: {}, exercises: {}, last: null, ...p });

test('first sync uploads local progress; only progress data leaves the device', async () => {
  const server = fakeServer();
  const keys = await deriveKeys(generateCode());
  const local = progress({ done: { intro: true }, doneAt: { intro: 5 }, last: 'intro', secret: 'x' } as Partial<Progress>);
  const merged = await syncOnce(server.api, keys, local);
  assert.deepEqual(merged.done, { intro: true });
  const stored = server.blobs.get(keys.id);
  assert.ok(stored);
  assert.deepEqual(await decryptJson(keys.key, stored.data), { done: { intro: true }, doneAt: { intro: 5 }, exercises: {} });
});

test('two devices end up with the same progress', async () => {
  const server = fakeServer();
  const keys = await deriveKeys(generateCode());
  const laptop = progress({ done: { intro: true }, doneAt: { intro: 10 }, exercises: { 'a/b': { score: 1, total: 2, at: 10 } } });
  const phone = progress({ done: { 'x-temps': true, intro: false }, doneAt: { 'x-temps': 20, intro: 30 } });
  await syncOnce(server.api, keys, laptop);
  const phoneAfter = await syncOnce(server.api, keys, phone);
  assert.deepEqual(phoneAfter.done, { intro: false, 'x-temps': true }); // phone unmarked intro later
  assert.deepEqual(phoneAfter.exercises, { 'a/b': { score: 1, total: 2, at: 10 } });
  const laptopAfter = await syncOnce(server.api, keys, laptop);
  assert.deepEqual(laptopAfter.done, phoneAfter.done);
});

test('nothing is uploaded when the server already has the same progress', async () => {
  const server = fakeServer();
  const keys = await deriveKeys(generateCode());
  const p = progress({ done: { intro: true }, doneAt: { intro: 1 } });
  await syncOnce(server.api, keys, p);
  await syncOnce(server.api, keys, p);
  assert.equal(server.blobs.get(keys.id)?.version, 1);
});

test('a write conflict (another device wrote meanwhile) is retried', async () => {
  const server = fakeServer();
  const keys = await deriveKeys(generateCode());
  server.failNextPut();
  const merged = await syncOnce(server.api, keys, progress({ done: { intro: true }, doneAt: { intro: 1 } }));
  assert.deepEqual(merged.done, { intro: true });
  assert.equal(server.blobs.get(keys.id)?.version, 1);
});

test('data that cannot be decrypted is an error, not silently overwritten', async () => {
  const server = fakeServer();
  const keys = await deriveKeys(generateCode());
  server.blobs.set(keys.id, { data: 'garbage', version: 1 });
  await assert.rejects(syncOnce(server.api, keys, progress({})));
  assert.equal(server.blobs.get(keys.id)?.data, 'garbage');
});
