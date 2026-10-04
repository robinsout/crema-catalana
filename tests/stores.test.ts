import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { useProgressStore } from '../src/stores/progress.ts';
import { useCatalogStore } from '../src/stores/catalog.ts';
import { useLessonsStore } from '../src/stores/lessons.ts';
import { useAudioStore } from '../src/stores/audio.ts';
import { STORAGE_KEY } from '../src/services/progress.ts';
import { stubSite, saveProgress } from './helpers.ts';

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');

test('progress store loads saved data of earlier versions', () => {
  saveProgress('{"done":{"l01":true},"last":"l01"}');
  const p = useProgressStore();
  assert.equal(p.isDone('intro'), true);
  assert.equal(p.last, 'intro');
});

test('progress store toggles a mark, stamps the time and saves in the same format', () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  saveProgress('{"done":{"intro":true},"last":"pla","notes":"kept"}');
  const p = useProgressStore();
  p.toggleDone('b1-01');
  assert.equal(p.isDone('b1-01'), true);
  assert.deepEqual(stored(), { done: { intro: true, 'b1-01': true }, doneAt: { 'b1-01': 1000 }, exercises: {}, sections: {}, reading: {}, last: 'pla', notes: 'kept' });
  p.toggleDone('b1-01');
  assert.equal(p.isDone('b1-01'), false);
});

test('progress store marks chapters and saves them', () => {
  vi.useFakeTimers();
  vi.setSystemTime(2000);
  const p = useProgressStore();
  assert.equal(p.isSectionDone('intro', 'fonetica'), false);
  p.toggleSection('intro', 'fonetica');
  assert.equal(p.isSectionDone('intro', 'fonetica'), true);
  assert.deepEqual(stored().sections, { 'intro/fonetica': { done: true, at: 2000 } });
  p.toggleSection('intro', 'fonetica');
  assert.equal(p.isSectionDone('intro', 'fonetica'), false);
});

test('progress store keeps the furthest chapter read and saves it only when it moves', () => {
  vi.useFakeTimers();
  vi.setSystemTime(3000);
  const p = useProgressStore();
  const order = ['a', 'b', 'c'];
  assert.equal(p.readingPoint('intro'), null);
  p.reachSection('intro', 'b', order);
  assert.equal(p.readingPoint('intro'), 'b');
  const setItem = vi.spyOn(Storage.prototype, 'setItem');
  p.reachSection('intro', 'a', order);
  assert.equal(setItem.mock.calls.length, 0);
  assert.deepEqual(stored().reading, { intro: { section: 'b', at: 3000 } });
  vi.restoreAllMocks();
});

test('progress store remembers the last lesson apart from the last view', () => {
  saveProgress('{"done":{},"last":"x-temps"}'); // saved before v5: the last view was a lesson
  const p = useProgressStore();
  assert.equal(p.lastLesson, 'x-temps');
  p.setLast('pla');
  assert.equal(p.lastLesson, 'x-temps');
  p.setLast('intro');
  assert.equal(p.lastLesson, 'intro');
  assert.equal(stored().lastLesson, 'intro');
  assert.equal(stored().last, 'intro');
});

test('progress store remembers the last view', () => {
  const p = useProgressStore();
  p.setLast('x-temps');
  assert.equal(stored().last, 'x-temps');
});

test('progress store works when storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  const p = useProgressStore();
  assert.doesNotThrow(() => p.toggleDone('intro'));
  assert.equal(p.isDone('intro'), true);
  vi.restoreAllMocks();
});

test('catalog store loads a language: catalog, interface strings and readiness', async () => {
  stubSite();
  const c = useCatalogStore();
  await c.load('ru');
  assert.equal(c.lang, 'ru');
  assert.equal(c.ready, true);
  assert.equal(c.find('b1-01')?.file, 'locales/ru/lessons/b1-01.html');
  assert.equal(c.find('b1-02')?.file, undefined);
  assert.equal(c.t('progress.done', { done: 1, ready: 3 }), 'Пройдено: 1 из 3');
  assert.equal(c.catalog.parts[0]?.period, 'октябрь — декабрь');
});

test('catalog store fetches each file once', async () => {
  const requested = stubSite();
  const c = useCatalogStore();
  await c.load('ru');
  await c.load('ru');
  assert.equal(requested.filter((u) => u === 'course.json').length, 1);
});

test('catalog store falls back to the default language for an unknown one', async () => {
  stubSite();
  const c = useCatalogStore();
  await c.load('xx');
  assert.equal(c.lang, 'ru');
});

test('catalog store reports an error when the course cannot be loaded', async () => {
  stubSite({ 'course.json': undefined });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
  const c = useCatalogStore();
  await assert.rejects(c.load('ru'));
  assert.equal(c.error, true);
});

test('lessons store loads a lesson once and keeps it', async () => {
  const requested = stubSite();
  const lessons = useLessonsStore();
  const lesson = { id: 'b1-01', file: 'locales/ru/lessons/b1-01.html' };
  assert.equal(lessons.content(lesson).state, 'loading');
  await lessons.load(lesson, 'ru');
  await lessons.load(lesson, 'ru');
  const c = lessons.content(lesson);
  assert.equal(c.state, 'ready');
  assert.match(c.state === 'ready' ? c.html : '', /Раздел b1-01/);
  assert.equal(requested.filter((u) => u === lesson.file).length, 1);
});

test('lessons store reports a lesson that cannot be loaded', async () => {
  stubSite();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
  const lessons = useLessonsStore();
  const lesson = { id: 'x', file: 'locales/ru/lessons/x.html' };
  await lessons.load(lesson, 'ru');
  assert.equal(lessons.content(lesson).state, 'error');
});

test('audio store finds the clip of a phrase', async () => {
  stubSite();
  const audio = useAudioStore();
  assert.equal(audio.available, false);
  await audio.load();
  assert.equal(audio.available, true);
  assert.equal(audio.clip(' Bon  dia '), 'audio/clips/abc.mp3');
  assert.equal(audio.clip('Adéu'), null);
});

test('audio store: no audio index means no audio, not an error', async () => {
  stubSite({ 'audio/index.json': undefined });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
  const audio = useAudioStore();
  await audio.load();
  assert.equal(audio.available, false);
});

test('lessons store loads the vocabulary of a lesson that has one', async () => {
  const requested = stubSite();
  const lessons = useLessonsStore();
  const lesson = { id: 'b1-01', file: 'locales/ru/lessons/b1-01.html', hasVocab: true };
  await lessons.load(lesson, 'ru');
  assert.deepEqual(lessons.vocab(lesson)?.[0]?.words.map((w) => w.tr), ['понедельник', 'осень']);
  await lessons.load({ id: 'intro', file: 'locales/ru/lessons/intro.html' }, 'ru');
  assert.ok(!requested.includes('vocab/intro.json'), 'no request for a lesson without vocabulary');
});
