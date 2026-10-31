// Load speed: what the first screen waits for. Each sequential request is a network round trip
// (on a phone ~150–300 ms), so independent requests start together and secondary data waits.
import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppRouter } from '../src/router.ts';
import { useCatalogStore } from '../src/stores/catalog.ts';
import { useLessonsStore } from '../src/stores/lessons.ts';
import { readFileSync } from 'node:fs';
import { verbList } from '../src/services/verbs.ts';
import type { VerbsData } from '../src/types/index.ts';
import { stubSite } from './helpers.ts';

let wrapper: VueWrapper | null = null;

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  window.HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.unstubAllGlobals();
});

// Holds back the responses for urls matching `pattern` until release() is called.
function holdBack(pattern: RegExp) {
  const real = globalThis.fetch;
  const held: (() => void)[] = [];
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) =>
    pattern.test(url) ? new Promise((resolve) => held.push(() => resolve(real(url, init)))) : real(url, init)));
  return { release: () => held.splice(0).forEach((go) => go()) };
}

test('the language pack of the requested language loads together with the course, not after it', async () => {
  const requested = stubSite();
  const gate = holdBack(/^(course|locales\/index)\.json$/);
  const loading = useCatalogStore().load('ru');
  await flushPromises();
  assert.ok(requested.includes('locales/ru/ui.json'), `requested: ${requested.join(', ')}`);
  assert.ok(requested.includes('locales/ru/catalog.json'));
  gate.release();
  await loading;
  assert.equal(useCatalogStore().lang, 'ru');
});

test('a link without a language starts loading the language last read on this device', async () => {
  localStorage.setItem('quadern-catala', JSON.stringify({ done: {}, last: 'pla', locale: 'ru' }));
  const requested = stubSite();
  const gate = holdBack(/^(course|locales\/index)\.json$/);
  const router = createAppRouter(createMemoryHistory());
  const pushed = router.push('/');
  await flushPromises();
  assert.ok(requested.includes('locales/ru/ui.json'), `requested: ${requested.join(', ')}`);
  gate.release();
  await pushed;
  assert.equal(router.currentRoute.value.fullPath, '/ru/plan');
});

test('a mistyped language in a link still opens the default one', async () => {
  stubSite();
  const router = createAppRouter(createMemoryHistory());
  await router.push('/xx/plan');
  assert.equal(router.currentRoute.value.fullPath, '/ru/plan');
});

test('the plan and lesson pages come with the app: no extra request for their code after the data', () => {
  const router = createAppRouter(createMemoryHistory());
  for (const name of ['plan', 'lesson']) {
    const view = router.getRoutes().find((r) => r.name === name)?.components?.default;
    assert.ok(view && typeof view !== 'function', `${name} is loaded lazily`);
  }
});

test('lesson exercises load together with the lesson text', async () => {
  const requested = stubSite();
  const gate = holdBack(/lessons\/x-temps\.html$/);
  const lessons = useLessonsStore();
  const lesson = { id: 'x-temps', file: 'locales/ru/lessons/x-temps.html' };
  const loading = lessons.load(lesson, 'ru');
  await flushPromises();
  assert.ok(requested.includes('locales/ru/exercises/x-temps.json'), `requested: ${requested.join(', ')}`);
  gate.release();
  await loading;
  assert.deepEqual(Object.keys(lessons.exercises(lesson)), ['fill1', 'pick']);
});

test('a lesson without exercises shows none, even when the request for them fails', async () => {
  stubSite();
  const lessons = useLessonsStore();
  const lesson = { id: 'intro', file: 'locales/ru/lessons/intro.html' };
  await lessons.load(lesson, 'ru');
  assert.deepEqual(lessons.exercises(lesson), {});
  assert.equal(lessons.content(lesson).state, 'ready');
});

async function openApp(path: string) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await flushPromises();
}

test('the audio index waits until the lesson text is requested', async () => {
  const requested = stubSite();
  await openApp('/ru/lesson/b1-01');
  const audio = requested.indexOf('audio/index.json');
  assert.ok(audio >= 0, 'the audio index is loaded on a lesson');
  assert.ok(audio > requested.indexOf('locales/ru/lessons/b1-01.html'), `requested: ${requested.join(', ')}`);
});

test('the verb reference has no audio and does not load its index', async () => {
  const requested = stubSite({ 'verbs/verbs.json': { verbs: [] }, 'locales/ru/verbs.json': {} });
  await openApp('/ru/verbs');
  assert.ok(!requested.includes('audio/index.json'), `requested: ${requested.join(', ')}`);
});

// The verb reference: the full forms (~90 KB) are the largest file of the site.
const verbData = {
  source: 'test',
  verbs: [
    { id: 'ser', inf: 'ser', ger: 'sent', part: ['estat', 'estada', 'estats', 'estades'], forms: { 'ind.pres': ['soc', 'ets', 'és', 'som', 'sou', 'són'] } },
    { id: 'anar', inf: 'anar', ger: 'anant', part: ['anat', 'anada', 'anats', 'anades'], forms: { 'ind.pres': ['vaig', 'vas', 'va', 'anem', 'aneu', 'van'] } },
  ],
};
const verbSite = (extra: Record<string, unknown> = {}) => stubSite({
  'verbs/verbs.json': verbData,
  'verbs/list.json': verbList(verbData as VerbsData),
  'locales/ru/verbs.json': { ser: 'быть', anar: 'идти' },
  'locales/ru/ui.json': JSON.parse(readFileSync('content/locales/ru/ui.json', 'utf8')),
  ...extra,
});

test('the verb list is the infinitives of the full reference, in the same order', () => {
  const full = JSON.parse(readFileSync('content/verbs/verbs.json', 'utf8')) as VerbsData;
  const list = JSON.parse(readFileSync('content/verbs/list.json', 'utf8')) as unknown;
  assert.deepEqual(list, verbList(full), 'run npm run verbs (or the list generator) again');
});

test('a verb page starts loading the verbs together with the course, not after the page code', async () => {
  const requested = verbSite();
  const gate = holdBack(/^(course|locales\/index)\.json$/);
  const router = createAppRouter(createMemoryHistory());
  const pushed = router.push('/ru/verbs/anar');
  await vi.waitFor(() => assert.ok(requested.includes('verbs/verbs.json'), `requested: ${requested.join(', ')}`));
  assert.ok(requested.includes('locales/ru/verbs.json'));
  gate.release();
  await pushed;
});

test('the verb list shows before the forms arrive; a search by a form works once they are there', async () => {
  verbSite();
  const gate = holdBack(/^verbs\/verbs\.json$/);
  await openApp('/ru/verbs');
  const w = wrapper!;
  assert.deepEqual(w.findAll('.verb-inf').map((e) => e.text()), ['ser', 'anar']);
  assert.match(w.find('.verb-list').text(), /идти/);
  await w.find('.verb-search input').setValue('vaig');
  assert.ok(!w.find('.verb-list').text().includes('anar'));
  assert.ok(!w.text().includes('Ничего не нашлось'), 'not "nothing found" while the forms are loading');
  gate.release();
  await flushPromises();
  assert.match(w.find('.verb-list').text(), /anar/);
});

test('without the list file the verbs still show from the full reference', async () => {
  verbSite({ 'verbs/list.json': undefined });
  await openApp('/ru/verbs');
  assert.deepEqual(wrapper!.findAll('.verb-inf').map((e) => e.text()), ['ser', 'anar']);
});
