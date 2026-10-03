import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, ID_ALIASES, parseProgress, serializeProgress, createStore } from '../portal/js/storage.js';

// Real payloads written by earlier versions of the portal. They must keep loading forever.
const SAVED = {
  // v1 (2026-10-03): flat lesson list, intro lesson had id "l01"
  v1: '{"done":{"l01":true},"last":"l01"}',
  // v2 (2026-10-03): study plan, intro renamed to "intro", plan view stored as "pla"
  v2: '{"done":{"intro":true,"b1-01":false},"last":"pla"}',
};

function memoryBackend(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
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

test('serialize keeps the v1/v2 shape: done map and last', () => {
  const back = JSON.parse(serializeProgress({ done: { intro: true }, last: 'b1-04' }));
  assert.deepEqual(back, { done: { intro: true }, last: 'b1-04' });
});

test('store loads, updates and saves through the backend', () => {
  const backend = memoryBackend({ [STORAGE_KEY]: SAVED.v1 });
  const store = createStore(backend);
  assert.equal(store.state.done.intro, true);
  store.setDone('b1-01', true);
  store.setLast('b1-01');
  const saved = JSON.parse(backend.data[STORAGE_KEY]);
  assert.deepEqual(saved, { done: { intro: true, 'b1-01': true }, last: 'b1-01' });
});

test('store toggles a done mark', () => {
  const store = createStore(memoryBackend());
  assert.equal(store.toggleDone('intro'), true);
  assert.equal(store.toggleDone('intro'), false);
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
