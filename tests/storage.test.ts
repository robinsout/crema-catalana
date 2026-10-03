import { test } from 'vitest';
import assert from 'node:assert/strict';
import { STORAGE_KEY, ID_ALIASES, parseProgress, serializeProgress, createStore, mergeProgress } from '../src/lib/storage.ts';

// Real payloads written by earlier versions of the portal. They must keep loading forever.
const SAVED = {
  // v1 (2026-10-03): flat lesson list, intro lesson had id "l01"
  v1: '{"done":{"l01":true},"last":"l01"}',
  // v2 (2026-10-03): study plan, intro renamed to "intro", plan view stored as "pla"
  v2: '{"done":{"intro":true,"b1-01":false},"last":"pla"}',
};

function memoryBackend(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => { data[k] = String(v); },
    data,
  };
}

test('storage key never changes', () => {
  assert.equal(STORAGE_KEY, 'quadern-catala');
});

test('empty, missing or corrupt data gives an empty progress', () => {
  for (const raw of [null, undefined, '', 'not json', '[]', '42', 'null', '{"done":"x"}']) {
    const p = parseProgress(raw);
    assert.deepEqual(p.done, {}, `done for ${raw}`);
    assert.equal(p.last, null, `last for ${raw}`);
  }
});

test('v1 data: old intro id l01 is migrated to intro', () => {
  const p = parseProgress(SAVED.v1);
  assert.equal(p.done.intro, true);
  assert.equal(p.last, 'intro');
  assert.equal('l01' in p.done, false);
});

test('v2 data loads unchanged', () => {
  const p = parseProgress(SAVED.v2);
  assert.deepEqual(p.done, { intro: true, 'b1-01': false });
  assert.equal(p.last, 'pla');
});

test('aliases only map old ids to new ones and never chain into themselves', () => {
  for (const [from, to] of Object.entries(ID_ALIASES)) {
    assert.notEqual(from, to);
    assert.equal(to in ID_ALIASES, false, `${to} must not be aliased again`);
  }
});

test('a done mark under the new id wins over the alias', () => {
  const p = parseProgress('{"done":{"l01":false,"intro":true},"last":null}');
  assert.equal(p.done.intro, true);
});

test('unknown fields written by future versions are preserved on save', () => {
  const p = parseProgress('{"done":{},"last":null,"notes":{"b1-01":"hola"}}');
  const back = JSON.parse(serializeProgress(p));
  assert.deepEqual(back.notes, { 'b1-01': 'hola' });
});

test('serialize keeps the v1/v2 fields: done map and last', () => {
  const back = JSON.parse(serializeProgress({ done: { intro: true }, last: 'b1-04' }));
  assert.deepEqual(back, { done: { intro: true }, last: 'b1-04' });
});

test('v3: doneAt timestamps load; data without them gets an empty map', () => {
  assert.deepEqual(parseProgress(SAVED.v2).doneAt, {});
  const p = parseProgress('{"done":{"intro":true},"doneAt":{"intro":1700000000000,"bad":"x"},"last":null}');
  assert.deepEqual(p.doneAt, { intro: 1700000000000 });
});

test('v3: doneAt keys of old ids are migrated like done', () => {
  const p = parseProgress('{"done":{"l01":true},"doneAt":{"l01":5},"last":null}');
  assert.deepEqual(p.doneAt, { intro: 5 });
});

test('store loads, updates and saves through the backend', () => {
  const backend = memoryBackend({ [STORAGE_KEY]: SAVED.v1 });
  const store = createStore(backend, { now: () => 42 });
  assert.equal(store.state.done.intro, true);
  store.setDone('b1-01', true);
  store.setLast('b1-01');
  const saved = JSON.parse(backend.data[STORAGE_KEY] ?? 'null');
  assert.deepEqual(saved, { done: { intro: true, 'b1-01': true }, doneAt: { 'b1-01': 42 }, last: 'b1-01' });
});

test('store toggles a done mark and stamps the time of every change', () => {
  let t = 100;
  const store = createStore(memoryBackend(), { now: () => t });
  assert.equal(store.toggleDone('intro'), true);
  assert.equal(store.state.doneAt.intro, 100);
  t = 200;
  assert.equal(store.toggleDone('intro'), false);
  assert.equal(store.state.doneAt.intro, 200);
});

test('merge: per lesson the later change wins, in both directions', () => {
  const local = { done: { a: true, b: false }, doneAt: { a: 10, b: 30 }, last: 'a' };
  const remote = { done: { a: false, b: true, c: true }, doneAt: { a: 20, b: 5, c: 7 }, last: 'zzz' };
  const m = mergeProgress(local, remote);
  assert.deepEqual(m.done, { a: false, b: false, c: true });
  assert.deepEqual(m.doneAt, { a: 20, b: 30, c: 7 });
});

test('merge: marks without a timestamp (saved before v3) lose to stamped ones; done wins a tie', () => {
  const old = parseProgress('{"done":{"intro":true,"x":true},"last":null}');
  const stamped = { done: { intro: false }, doneAt: { intro: 1 } };
  const m = mergeProgress(old, stamped);
  assert.equal(m.done.intro, false);
  assert.equal(m.done.x, true);
  assert.equal(mergeProgress({ done: { y: false } }, { done: { y: true } }).done.y, true);
});

test('merge keeps the local last view and unknown local fields', () => {
  const m = mergeProgress({ done: {}, doneAt: {}, last: 'b1-01', notes: 1 }, { done: {}, doneAt: {}, last: 'x' });
  assert.equal(m.last, 'b1-01');
  assert.equal(m.notes, 1);
});

test('merge is order-independent for done and doneAt', () => {
  const a = { done: { p: true, q: false }, doneAt: { p: 3, q: 9 } };
  const b = { done: { p: false, r: true }, doneAt: { p: 4, r: 1 } };
  const ab = mergeProgress(a, b);
  const ba = mergeProgress(b, a);
  assert.deepEqual(ab.done, ba.done);
  assert.deepEqual(ab.doneAt, ba.doneAt);
});

test('store survives a backend that throws (private mode, blocked storage)', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const store = createStore(broken);
  assert.deepEqual(store.state.done, {});
  assert.doesNotThrow(() => store.setDone('intro', true));
  assert.equal(store.state.done.intro, true);
});

test('store works without any backend', () => {
  const store = createStore(null);
  store.setLast('pla');
  assert.equal(store.state.last, 'pla');
});
