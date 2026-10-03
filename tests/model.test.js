import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCatalog, allLessons, readyLessons, findLesson, resolveRoute,
  progress, neighbours, lessonLabel, relatedExtras,
} from '../portal/js/model.js';

const catalog = normalizeCatalog({
  course: { title: 'Passos 1' },
  extras: [
    { id: 'intro', kind: 'overview', title: 'Introducció', file: 'content/intro.html' },
    { id: 'x-pronoms', kind: 'topic', title: 'Pronoms febles', file: 'content/x-pronoms.html', related: ['b1-02'] },
    { id: 'x-later', kind: 'topic', title: 'Later' },
  ],
  parts: [
    { id: 'b1', title: 'Bàsic 1', units: [
      { id: 'b1-01', unit: 1, title: 'Hola', file: 'content/b1-01.html' },
      { id: 'b1-02', unit: 2, title: 'Família' },
      { id: 'b1-03', unit: 3, title: 'Visc', file: 'content/b1-03.html' },
    ] },
    { id: 'b2', title: 'Bàsic 2', units: [
      { id: 'b2-01', unit: 1, title: 'Petit', file: 'content/b2-01.html' },
    ] },
  ],
});

test('legacy catalog with a separate intro is turned into the first extra', () => {
  const c = normalizeCatalog({ intro: { id: 'intro', title: 'Intro', file: 'a.html' }, parts: [] });
  assert.equal(c.extras.length, 1);
  assert.equal(c.extras[0].id, 'intro');
  assert.equal(c.extras[0].kind, 'overview');
});

test('missing sections default to empty lists', () => {
  const c = normalizeCatalog({});
  assert.deepEqual(c.parts, []);
  assert.deepEqual(c.extras, []);
});

test('allLessons lists extras first, then units in course order, with track info', () => {
  const ids = allLessons(catalog).map((l) => l.id);
  assert.deepEqual(ids, ['intro', 'x-pronoms', 'x-later', 'b1-01', 'b1-02', 'b1-03', 'b2-01']);
  assert.equal(findLesson(catalog, 'b1-03').track, 'unit');
  assert.equal(findLesson(catalog, 'b1-03').part.id, 'b1');
  assert.equal(findLesson(catalog, 'x-pronoms').track, 'extra');
});

test('readyLessons keeps only lessons with a file', () => {
  assert.deepEqual(readyLessons(catalog).map((l) => l.id), ['intro', 'x-pronoms', 'b1-01', 'b1-03', 'b2-01']);
});

test('findLesson also accepts an old aliased id', () => {
  const c = normalizeCatalog({ extras: [{ id: 'intro', title: 'I', file: 'i.html' }] });
  assert.equal(findLesson(c, 'l01').id, 'intro');
});

test('route: hash with a ready lesson opens it', () => {
  assert.deepEqual(resolveRoute(catalog, 'b1-03', null), { view: 'lesson', id: 'b1-03' });
});

test('route: unit without a lesson opens the plan focused on that unit', () => {
  assert.deepEqual(resolveRoute(catalog, 'b1-02', null), { view: 'plan', focus: 'b1-02' });
});

test('route: extra without a lesson opens the plan focused on it', () => {
  assert.deepEqual(resolveRoute(catalog, 'x-later', null), { view: 'plan', focus: 'x-later' });
});

test('route: no hash falls back to the last opened view', () => {
  assert.deepEqual(resolveRoute(catalog, '', 'x-pronoms'), { view: 'lesson', id: 'x-pronoms' });
  assert.deepEqual(resolveRoute(catalog, '', 'pla'), { view: 'plan', focus: null });
});

test('route: old v1 id in hash or last still opens the lesson', () => {
  const c = normalizeCatalog({ extras: [{ id: 'intro', title: 'I', file: 'i.html' }] });
  assert.deepEqual(resolveRoute(c, 'l01', null), { view: 'lesson', id: 'intro' });
  assert.deepEqual(resolveRoute(c, '', 'l01'), { view: 'lesson', id: 'intro' });
});

test('route: unknown ids and first visit open the plan', () => {
  assert.deepEqual(resolveRoute(catalog, 'nope', null), { view: 'plan', focus: null });
  assert.deepEqual(resolveRoute(catalog, '', null), { view: 'plan', focus: null });
});

test('progress counts done marks only for ready lessons', () => {
  const p = progress(catalog, { intro: true, 'b1-03': true, 'b1-02': true, gone: true, 'b2-01': false });
  assert.deepEqual(p, { done: 2, ready: 5, total: 7 });
});

test('neighbours stay inside the same track', () => {
  assert.deepEqual(ids(neighbours(catalog, 'b1-03')), { prev: 'b1-01', next: 'b2-01' });
  assert.deepEqual(ids(neighbours(catalog, 'b1-01')), { prev: null, next: 'b1-03' });
  assert.deepEqual(ids(neighbours(catalog, 'intro')), { prev: null, next: 'x-pronoms' });
  assert.deepEqual(ids(neighbours(catalog, 'x-pronoms')), { prev: 'intro', next: null });
});

test('labels name the track', () => {
  assert.equal(lessonLabel(findLesson(catalog, 'b1-03')), 'Bàsic 1 · Unitat 3');
  assert.equal(lessonLabel(findLesson(catalog, 'intro')), 'Обзорный урок');
  assert.equal(lessonLabel(findLesson(catalog, 'x-pronoms')), 'Тематический урок');
});

test('relatedExtras finds topic lessons linked to a unit', () => {
  assert.deepEqual(relatedExtras(catalog, 'b1-02').map((l) => l.id), ['x-pronoms']);
  assert.deepEqual(relatedExtras(catalog, 'b1-01'), []);
});

function ids({ prev, next }) {
  return { prev: prev ? prev.id : null, next: next ? next.id : null };
}
