import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { STORAGE_KEY, ID_ALIASES, parseProgress, serializeProgress, createStore, mergeProgress, canonicalId, isLessonId, markSection, recordReading } from '../src/services/progress.ts';

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
  assert.deepEqual(saved, { done: { intro: true, 'b1-01': true }, doneAt: { 'b1-01': 42 }, exercises: {}, sections: {}, reading: {}, last: 'b1-01' });
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

test('v4: exercise results load; invalid entries are dropped; older data has none', () => {
  assert.deepEqual(parseProgress(SAVED.v2).exercises, {});
  const p = parseProgress('{"done":{},"last":null,"exercises":{"x-temps/tenses":{"score":2,"total":3,"at":5},"bad":{"score":"x"}}}');
  assert.deepEqual(p.exercises, { 'x-temps/tenses': { score: 2, total: 3, at: 5 } });
});

test('merge: per exercise the later result wins', () => {
  const local = { done: {}, exercises: { a: { score: 1, total: 3, at: 10 }, b: { score: 3, total: 3, at: 50 } } };
  const remote = { done: {}, exercises: { a: { score: 3, total: 3, at: 20 }, c: { score: 0, total: 2, at: 1 } } };
  assert.deepEqual(mergeProgress(local, remote).exercises, {
    a: { score: 3, total: 3, at: 20 }, b: { score: 3, total: 3, at: 50 }, c: { score: 0, total: 2, at: 1 },
  });
});

// Saved and synced progress is untrusted input: only lesson ids and "<lesson>/<exercise>" keys are kept.
test('progress ignores ids that are not lesson ids (__proto__, constructor, odd strings)', () => {
  const p = parseProgress(JSON.stringify({
    done: { ['__proto__']: true, constructor: true, toString: true, 'b1-01': true, 'Bad Id': true, '': true },
    doneAt: { ['__proto__']: 5, constructor: 6, 'b1-01': 7 },
    exercises: {
      ['__proto__']: { score: 1, total: 1, at: 1 },
      'b1-01/__proto__': { score: 1, total: 1, at: 1 },
      'x-temps-verbals/tenses': { score: 2, total: 3, at: 5 },
    },
    last: '__proto__',
  }));
  assert.deepEqual(Object.keys(p.done), ['b1-01']);
  assert.deepEqual(Object.keys(p.doneAt), ['b1-01']);
  assert.deepEqual(Object.keys(p.exercises), ['x-temps-verbals/tenses']);
  assert.equal(Object.getPrototypeOf(p.done), Object.prototype);
  assert.equal(Object.getPrototypeOf(p.exercises), Object.prototype);
  assert.equal(p.last, null);
});

test('canonicalId does not read inherited properties', () => {
  for (const id of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) assert.equal(canonicalId(id), id);
});

test('merge does not mistake inherited properties for marks', () => {
  const m = mergeProgress({ done: {}, doneAt: {} }, { done: { constructor: true }, doneAt: { constructor: 5 } });
  assert.deepEqual(m.done, { constructor: true });
  assert.deepEqual(m.doneAt, { constructor: 5 });
});

test('every published lesson id and exercise id has the accepted format', () => {
  const ids: string[] = JSON.parse(readFileSync('tests/published-ids.json', 'utf8'));
  for (const id of ids) assert.ok(isLessonId(id), id);
  for (const lang of readdirSync('content/locales')) {
    const dir = `content/locales/${lang}/exercises`;
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      for (const ex of Object.keys(JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')))) {
        assert.ok(isLessonId(ex), `${file}: ${ex}`);
      }
    }
  }
});

test('v5: section marks and reading points load; invalid entries are dropped; older data has none', () => {
  assert.deepEqual(parseProgress(SAVED.v2).sections, {});
  assert.deepEqual(parseProgress(SAVED.v2).reading, {});
  const p = parseProgress(JSON.stringify({
    done: {},
    sections: {
      'x-temps-verbals/mapa': { done: true, at: 5 },
      'x-temps-verbals/formes': { done: false, at: 6 },
      'x-temps-verbals/__proto__': { done: true, at: 1 },
      'x-temps-verbals': { done: true, at: 1 },
      'intro/fonetica': { done: 'yes', at: 1 },
    },
    reading: {
      'x-temps-verbals': { section: 'formes', at: 7 },
      intro: { section: 'Bad Id', at: 1 },
      __proto__: { section: 'mapa', at: 1 },
      'b1-01': { section: 'x', at: 'later' },
    },
  }));
  assert.deepEqual(p.sections, { 'x-temps-verbals/mapa': { done: true, at: 5 }, 'x-temps-verbals/formes': { done: false, at: 6 } });
  assert.deepEqual(p.reading, { 'x-temps-verbals': { section: 'formes', at: 7 } });
});

test('v5: a section mark is set and stamped with the time of the change', () => {
  const p = parseProgress(null);
  assert.equal(markSection(p, 'intro/fonetica', true, 10), true);
  assert.deepEqual(p.sections['intro/fonetica'], { done: true, at: 10 });
  assert.equal(markSection(p, 'intro/fonetica', false, 20), false);
  assert.deepEqual(p.sections['intro/fonetica'], { done: false, at: 20 });
});

test('v5: the reading point only moves forward through the sections of a lesson', () => {
  const order = ['mapa', 'llegir', 'historia', 'formes'];
  const p = parseProgress(null);
  assert.equal(recordReading(p, 'x-temps', 'llegir', order, 10), true);
  assert.equal(recordReading(p, 'x-temps', 'historia', order, 20), true);
  assert.equal(recordReading(p, 'x-temps', 'mapa', order, 30), false); // went back to re-read: the point stays
  assert.deepEqual(p.reading['x-temps'], { section: 'historia', at: 20 });
  // a section that is no longer in the lesson is replaced by any current one
  p.reading['x-temps'] = { section: 'renamed', at: 5 };
  assert.equal(recordReading(p, 'x-temps', 'mapa', order, 40), true);
  assert.deepEqual(p.reading['x-temps'], { section: 'mapa', at: 40 });
});

test('merge: per section mark and per lesson reading point the later change wins', () => {
  const local = {
    done: {},
    sections: { 'a/s1': { done: true, at: 10 }, 'a/s2': { done: false, at: 50 } },
    reading: { a: { section: 's2', at: 50 }, b: { section: 's1', at: 5 } },
  };
  const remote = {
    done: {},
    sections: { 'a/s1': { done: false, at: 20 }, 'a/s2': { done: true, at: 40 }, 'a/s3': { done: true, at: 1 } },
    reading: { a: { section: 's3', at: 40 }, b: { section: 's4', at: 9 } },
  };
  const m = mergeProgress(local, remote);
  assert.deepEqual(m.sections, { 'a/s1': { done: false, at: 20 }, 'a/s2': { done: false, at: 50 }, 'a/s3': { done: true, at: 1 } });
  assert.deepEqual(m.reading, { a: { section: 's2', at: 50 }, b: { section: 's4', at: 9 } });
  assert.deepEqual(mergeProgress({ done: {}, sections: { 'a/s': { done: false, at: 3 } } }, { done: {}, sections: { 'a/s': { done: true, at: 3 } } }).sections,
    { 'a/s': { done: true, at: 3 } }, 'done wins a tie');
});

test('every section id of a lesson has the accepted format and is listed in tests/published-sections.json', () => {
  const published: Record<string, string[]> = JSON.parse(readFileSync('tests/published-sections.json', 'utf8'));
  for (const lang of readdirSync('content/locales')) {
    const dir = `content/locales/${lang}/lessons`;
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      const lesson = file.replace(/\.html$/, '');
      const ids = [...readFileSync(`${dir}/${file}`, 'utf8').matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]!);
      for (const id of ids) {
        assert.ok(isLessonId(id), `${lang}/${file}: ${id}`);
        assert.ok(published[lesson]?.includes(id), `add "${id}" to "${lesson}" in tests/published-sections.json`);
      }
    }
  }
});

// Section marks and reading points are saved under section ids: like lesson ids, they never disappear.
test('published section ids stay in their lessons', () => {
  const published: Record<string, string[]> = JSON.parse(readFileSync('tests/published-sections.json', 'utf8'));
  for (const [lesson, ids] of Object.entries(published)) {
    const html = readFileSync(`content/locales/ru/lessons/${lesson}.html`, 'utf8');
    for (const id of ids) assert.ok(html.includes(`<section id="${id}"`), `${lesson}: section "${id}" was removed or renamed`);
  }
});

test('v5: lastLesson loads when it is a lesson id', () => {
  assert.equal(parseProgress('{"done":{},"lastLesson":"x-temps"}').lastLesson, 'x-temps');
  assert.equal(parseProgress('{"done":{},"lastLesson":"__proto__"}').lastLesson, undefined);
  assert.equal(parseProgress('{"done":{},"lastLesson":"l01"}').lastLesson, 'intro');
  assert.equal('lastLesson' in parseProgress(SAVED.v2), false);
});
