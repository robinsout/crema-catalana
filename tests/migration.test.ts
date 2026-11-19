// @vitest-environment node
// Moving to the new address: the payload of #/import/<payload> (made by the bridge page on the old
// address) is untrusted input; importProgress merges it without overwriting newer local data.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { decodeImport, importProgress } from '../src/services/migration.ts';
import { parseProgress, type Progress } from '../src/services/progress.ts';
import { generateCode } from '../src/services/sync.ts';

const b64u = (b: Uint8Array) => Buffer.from(b).toString('base64url');
const pack = (obj: unknown, marker: 0 | 1 = 1): string => {
  const json = Buffer.from(JSON.stringify(obj));
  return b64u(Buffer.concat([Buffer.from([marker]), marker === 1 ? deflateRawSync(json) : json]));
};
const NOW = 1_800_000_000_000;
const p = (o: Partial<Progress>): Progress => parseProgress(JSON.stringify(o));

test('round trip: compressed and plain payloads', async () => {
  const code = generateCode();
  const progress = JSON.stringify({ done: { 'b1-01': true }, doneAt: { 'b1-01': 5 }, last: 'b1-01' });
  for (const marker of [1, 0] as const) {
    const r = await decodeImport(pack({ v: 1, progress, sync: JSON.stringify({ code, lastSyncAt: 1 }) }, marker));
    assert.deepEqual(r?.progress?.done, { 'b1-01': true });
    assert.equal(r?.progress?.last, 'b1-01');
    assert.equal(r?.syncCode, code);
  }
  const empty = await decodeImport(pack({ v: 1, progress: null, sync: null }));
  assert.deepEqual(empty, { progress: null, syncCode: null });
});

test('an invalid sync code or broken sync string gives no code', async () => {
  for (const sync of [JSON.stringify({ code: 'nope' }), 'not json', JSON.stringify({ code: 5 })]) {
    assert.equal((await decodeImport(pack({ v: 1, progress: null, sync })))?.syncCode, null);
  }
});

test('malformed payloads give null', async () => {
  const bad = [
    '', 'a'.repeat(100_001), 'abc def', 'ab+/=', 'AA',
    b64u(Buffer.from([2, 123, 125])),
    b64u(Buffer.concat([Buffer.from([1]), Buffer.from('not deflate')])),
    b64u(Buffer.concat([Buffer.from([0]), Buffer.from('{oops')])),
    pack({ v: 2, progress: null, sync: null }),
    pack({ progress: null, sync: null }),
    pack([1, 2]),
  ];
  for (const x of bad) assert.equal(await decodeImport(x), null, x.slice(0, 30));
});

test('a deflate bomb gives null quickly', async () => {
  const bomb = b64u(Buffer.concat([Buffer.from([1]), deflateRawSync(Buffer.alloc(50_000_000))]));
  assert.ok(bomb.length < 100_000);
  const t = Date.now();
  assert.equal(await decodeImport(bomb), null);
  assert.ok(Date.now() - t < 3000);
});

test('bad ids and __proto__ are dropped', async () => {
  const progress = '{"done":{"__proto__":true,"B1 01":true,"b1-01":true},"doneAt":{"b1-01":1}}';
  const r = await decodeImport(pack({ v: 1, progress, sync: null }));
  assert.deepEqual(r?.progress?.done, { 'b1-01': true });
});

test('merge: the later change wins on either side', () => {
  const local = p({ done: { a: true, b: false }, doneAt: { a: 200, b: 100 } });
  const incoming = p({ done: { a: false, b: true, c: true }, doneAt: { a: 100, b: 200, c: 50 } });
  const r = importProgress(local, incoming, NOW);
  assert.deepEqual(r.done, { a: true, b: true, c: true });
  assert.equal(r.doneAt.a, 200);
});

test('timestamps from the future are clamped to now', () => {
  const far = NOW + 10 ** 12;
  const incoming = p({
    done: { a: true }, doneAt: { a: far },
    exercises: { 'x/e': { score: 1, total: 2, at: far } },
    sections: { 'x/s': { done: true, at: far } },
    reading: { x: { section: 's', at: far } },
  });
  const r = importProgress(p({}), incoming, NOW);
  assert.equal(r.doneAt.a, NOW);
  assert.equal(r.exercises['x/e']?.at, NOW);
  assert.equal(r.sections['x/s']?.at, NOW);
  assert.equal(r.reading.x?.at, NOW);
  // a later real change on this device beats the imported one
  const later = { ...r, done: { a: false }, doneAt: { a: NOW + 1 } };
  assert.equal(importProgress(later, incoming, NOW).done.a, false);
});

test('device fields come from the import only when absent locally; unknown fields are not copied', () => {
  const incoming = p({ last: 'b1-01', lastLesson: 'b1-01', locale: 'en', verbTenses: ['x'], trainer: { a: 1 }, lastArea: 'verbs', verbsTab: 'trainer', recentVerbs: ['anar'], extra: 1 });
  const r = importProgress(p({}), incoming, NOW);
  assert.equal(r.last, 'b1-01');
  assert.equal(r.lastLesson, 'b1-01');
  assert.equal(r.locale, 'en');
  assert.deepEqual(r.verbTenses, ['x']);
  assert.deepEqual(r.trainer, { a: 1 });
  assert.equal(r.lastArea, 'verbs');
  assert.equal(r.verbsTab, 'trainer');
  assert.deepEqual(r.recentVerbs, ['anar']);
  assert.equal('extra' in r, false);

  const local = p({ last: 'b1-02', lastLesson: 'b1-02', locale: 'es', verbTenses: [], lastArea: 'lessons', mine: 7 });
  const r2 = importProgress(local, incoming, NOW);
  assert.equal(r2.last, 'b1-02');
  assert.equal(r2.lastLesson, 'b1-02');
  assert.equal(r2.locale, 'es');
  assert.deepEqual(r2.verbTenses, []);
  assert.equal(r2.lastArea, 'lessons');
  assert.equal(r2.mine, 7);
});

test('importing the same thing twice gives the same result', () => {
  const incoming = p({ done: { a: true }, doneAt: { a: 5 }, last: 'a', sections: { 'a/s': { done: true, at: NOW + 5 } } });
  const once = importProgress(p({ done: { b: true }, doneAt: { b: 9 } }), incoming, NOW);
  assert.deepEqual(importProgress(once, incoming, NOW), once);
});
