import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  normalizeCatalog, buildCatalog, allLessons, readyLessons, findLesson, resolveRoute,
  progress, neighbours, lessonLabel, relatedExtras,
} from '../src/lib/model.ts';
import { createT } from '../src/lib/i18n.ts';
import type { Catalog, Course, Lesson, LocaleCatalog } from '../src/lib/types.ts';

// findLesson for tests: the lesson must exist
function get(c: Catalog, id: string): Lesson {
  const l = findLesson(c, id);
  if (!l) throw new Error(`lesson ${id} not found`);
  return l;
}

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
  assert.equal(c.extras[0]?.id, 'intro');
  assert.equal(c.extras[0]?.kind, 'overview');
});

test('missing sections default to empty lists', () => {
  const c = normalizeCatalog({});
  assert.deepEqual(c.parts, []);
  assert.deepEqual(c.extras, []);
});

test('allLessons lists extras first, then units in course order, with track info', () => {
  const ids = allLessons(catalog).map((l) => l.id);
  assert.deepEqual(ids, ['intro', 'x-pronoms', 'x-later', 'b1-01', 'b1-02', 'b1-03', 'b2-01']);
  assert.equal(get(catalog, 'b1-03').track, 'unit');
  assert.equal(get(catalog, 'b1-03').part?.id, 'b1');
  assert.equal(get(catalog, 'x-pronoms').track, 'extra');
});

test('readyLessons keeps only lessons with a file', () => {
  assert.deepEqual(readyLessons(catalog).map((l) => l.id), ['intro', 'x-pronoms', 'b1-01', 'b1-03', 'b2-01']);
});

test('findLesson also accepts an old aliased id', () => {
  const c = normalizeCatalog({ extras: [{ id: 'intro', title: 'I', file: 'i.html' }] });
  assert.equal(get(c, 'l01').id, 'intro');
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

test('labels name the track in the reader\'s language', () => {
  const t = createT({ 'label.unit': '{part} · Unitat {unit}', 'label.overview': 'Overview', 'label.topic': 'Topic' });
  assert.equal(lessonLabel(get(catalog, 'b1-03'), t), 'Bàsic 1 · Unitat 3');
  assert.equal(lessonLabel(get(catalog, 'intro'), t), 'Overview');
  assert.equal(lessonLabel(get(catalog, 'x-pronoms'), t), 'Topic');
});

// course.json holds the structure; locales/<lang>/catalog.json the texts and which lessons are written
const course: Course = {
  course: { title: 'Passos 1' },
  extras: [
    { id: 'intro', kind: 'overview', title: 'Introducció' },
    { id: 'x-later', kind: 'topic', title: 'Later', related: ['b1-01'] },
  ],
  parts: [{ id: 'b1', title: 'Bàsic 1', units: [
    { id: 'b1-01', unit: 1, title: 'Hola' },
    { id: 'b1-02', unit: 2, title: 'Família' },
  ] }],
};
const ru: LocaleCatalog = {
  parts: { b1: { period: 'октябрь — декабрь', focus: 'Настоящее время' } },
  lessons: {
    intro: { subtitle: 'Обзор', date: '2026-10-03' },
    'b1-01': { topic: 'Знакомство', grammar: ['ser'], date: '2026-10-10' },
    'b1-02': { topic: 'Семья' },
  },
};

test('buildCatalog merges structure with the texts of one language', () => {
  const c = normalizeCatalog(buildCatalog(course, ru, 'ru'));
  assert.equal(c.parts[0]?.period, 'октябрь — декабрь');
  const intro = get(c, 'intro');
  assert.equal(intro.title, 'Introducció');
  assert.equal(intro.subtitle, 'Обзор');
  assert.equal(intro.kind, 'overview');
  assert.deepEqual(get(c, 'b1-01').grammar, ['ser']);
  assert.deepEqual(get(c, 'x-later').related, ['b1-01']);
});

test('buildCatalog: a lesson is ready in a language when it has a date there', () => {
  const c = normalizeCatalog(buildCatalog(course, ru, 'ru'));
  assert.equal(get(c, 'intro').file, 'locales/ru/lessons/intro.html');
  assert.equal(get(c, 'b1-01').file, 'locales/ru/lessons/b1-01.html');
  assert.equal(get(c, 'b1-02').file, undefined);
  assert.equal(get(c, 'x-later').file, undefined);
});

test('buildCatalog: structure wins over texts, so a language cannot change ids or units', () => {
  const evil = { lessons: { 'b1-01': { id: 'zzz', unit: 9, title: 'Changed' } } } as unknown as LocaleCatalog;
  const l = get(normalizeCatalog(buildCatalog(course, evil, 'ru')), 'b1-01');
  assert.equal(l.unit, 1);
  assert.equal(l.title, 'Hola');
});

test('buildCatalog works with an empty language (nothing translated yet)', () => {
  const c = normalizeCatalog(buildCatalog(course, {}, 'en'));
  assert.equal(allLessons(c).length, 4);
  assert.equal(readyLessons(c).length, 0);
});

test('relatedExtras finds topic lessons linked to a unit', () => {
  assert.deepEqual(relatedExtras(catalog, 'b1-02').map((l) => l.id), ['x-pronoms']);
  assert.deepEqual(relatedExtras(catalog, 'b1-01'), []);
});

function ids({ prev, next }: { prev: Lesson | null; next: Lesson | null }) {
  return { prev: prev ? prev.id : null, next: next ? next.id : null };
}
