// Languages of explanations (BACKLOG F-1 step 4): the language of the first visit, the switcher,
// the remembered language and the page of a lesson not yet written in the chosen language.
import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppRouter } from '../src/router.ts';
import { preferredLanguage } from '../src/services/content.ts';
import { parseProgress, STORAGE_KEY } from '../src/services/progress.ts';
import { stubSite, saveProgress, ruUi } from './helpers.ts';
import type { LocalesIndex } from '../src/types/index.ts';

const twoLanguages: LocalesIndex = { base: 'ru', default: 'en', available: ['ru', 'en'], names: { ru: 'Русский', en: 'English' } };
// English: the interface and only the intro lesson so far
const enSite = {
  'locales/index.json': twoLanguages,
  'locales/en/ui.json': { ...ruUi, _dateLocale: 'en-GB', 'lesson.missing': 'Not yet in English. Available in:' },
  'locales/en/catalog.json': { lessons: { intro: { subtitle: 'Overview', date: '2026-10-05' } } },
};

let wrapper: VueWrapper | null = null;
let browser: string[] = [];

beforeEach(() => {
  localStorage.clear();
  browser = ['ru-RU'];
  vi.spyOn(navigator, 'languages', 'get').mockImplementation(() => browser);
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openApp(path: string) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await flushPromises();
  return { router, w: wrapper };
}

const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;

// ---------- the language of a visit ----------

test('preferred language: the saved one, then the base one for old progress, then the browser, then the default', () => {
  const pick = (saved: string | null, hasHistory: boolean, langs: string[]) => preferredLanguage(twoLanguages, { saved, hasHistory, browser: langs });
  assert.equal(pick('ru', false, ['en-US']), 'ru');
  assert.equal(pick('xx', false, ['ru']), 'ru', 'an unknown saved language is ignored');
  assert.equal(pick(null, true, ['en-US']), 'ru', 'progress saved before languages was read in the base language');
  assert.equal(pick(null, false, ['de-DE', 'en-US']), 'en');
  assert.equal(pick(null, false, ['RU']), 'ru');
  assert.equal(pick(null, false, ['de-DE']), 'en', 'an unsupported browser language gets the default');
  assert.equal(pick(null, false, []), 'en');
});

test('the saved language is read back only when it looks like a language code', () => {
  assert.equal(parseProgress('{"locale":"en"}').locale, 'en');
  assert.equal(parseProgress('{"locale":"__proto__"}').locale, undefined);
  assert.equal(parseProgress('{"locale":5}').locale, undefined);
});

test('a first visit without a link opens the language of the browser', async () => {
  stubSite(enSite);
  browser = ['de-DE', 'ru'];
  const { router } = await openApp('/');
  assert.equal(router.currentRoute.value.fullPath, '/ru/plan');
});

test('a reader from before the languages keeps the base language', async () => {
  stubSite(enSite);
  browser = ['en-US'];
  saveProgress(JSON.stringify({ done: { intro: true }, last: 'pla' }));
  const { router } = await openApp('/');
  assert.equal(router.currentRoute.value.fullPath, '/ru/plan');
});

test('old links and unknown languages use the preferred language too', async () => {
  stubSite(enSite);
  browser = ['en-US'];
  assert.equal((await openApp('/intro')).router.currentRoute.value.fullPath, '/en/lesson/intro');
  wrapper?.unmount();
  localStorage.clear();
  assert.equal((await openApp('/xx/plan')).router.currentRoute.value.fullPath, '/en/plan');
});

test('the language of the opened page is remembered on this device', async () => {
  stubSite(enSite);
  browser = ['ru'];
  await openApp('/en/lesson/intro');
  assert.equal(saved().locale, 'en');
  wrapper?.unmount();
  const { router } = await openApp('/');
  assert.equal(router.currentRoute.value.params.lang, 'en');
});

// ---------- the switcher ----------

test('with one language there is no switcher', async () => {
  stubSite();
  const { w } = await openApp('/ru/plan');
  assert.equal(w.find('#nav select.lang-select').exists(), false);
});

test('the switcher lists languages by their own names and opens the same page in the chosen one', async () => {
  stubSite(enSite);
  const { router, w } = await openApp('/ru/lesson/intro');
  const select = w.find<HTMLSelectElement>('#nav select.lang-select');
  assert.ok(select.exists());
  assert.ok(select.attributes('aria-label'));
  assert.deepEqual(select.findAll('option').map((o) => [o.attributes('value'), o.text(), o.attributes('lang')]),
    [['ru', 'Русский', 'ru'], ['en', 'English', 'en']]);
  assert.equal(select.element.value, 'ru');
  await select.setValue('en');
  await flushPromises();
  assert.equal(router.currentRoute.value.fullPath, '/en/lesson/intro');
  assert.equal(saved().locale, 'en');
  assert.equal(document.documentElement.lang, 'en');
});

// ---------- a lesson not yet written in the language ----------

test('a lesson written only in another language shows where to read it', async () => {
  stubSite(enSite);
  const { router, w } = await openApp('/en/lesson/x-temps');
  assert.equal(router.currentRoute.value.fullPath, '/en/lesson/x-temps', 'the link stays: the reader can switch language');
  const missing = w.find('.lesson-missing');
  assert.ok(missing.exists());
  assert.equal(w.find('.lesson-head h2').text(), 'Els temps');
  assert.ok(missing.text().includes('Not yet in English. Available in:'));
  const links = missing.findAll('a');
  assert.deepEqual(links.map((a) => [a.text(), a.attributes('href'), a.attributes('lang')]), [['Русский', '/ru/lesson/x-temps', 'ru']]);
  assert.equal(w.find('article.lesson').exists(), false);
  assert.equal(w.find('.lesson-head button').exists(), false, 'nothing to mark as done here');
});

test('a lesson written in no language opens its place in the plan, as before', async () => {
  stubSite(enSite);
  const { router } = await openApp('/en/lesson/b1-02');
  assert.equal(router.currentRoute.value.fullPath, '/en/plan/b1-02');
});

test('the other languages are fetched only for a lesson missing in the current one', async () => {
  const requested = stubSite(enSite);
  await openApp('/en/lesson/intro');
  assert.equal(requested.includes('locales/ru/catalog.json'), false);
});

// ---------- a language being written (draft) ----------

const withDraft = {
  ...enSite,
  'locales/index.json': { ...twoLanguages, available: ['ru'], default: 'ru', drafts: ['en'] },
};

test('a draft language opens by a direct link and shows itself in the switcher there', async () => {
  stubSite(withDraft);
  const { router, w } = await openApp('/en/lesson/intro');
  assert.equal(router.currentRoute.value.fullPath, '/en/lesson/intro');
  const options = w.findAll('#nav select.lang-select option');
  assert.deepEqual(options.map((o) => o.attributes('value')), ['ru', 'en']);
});

test('a draft language is not offered: no switcher entry elsewhere, never picked from the browser', async () => {
  stubSite(withDraft);
  browser = ['en-US'];
  const { router, w } = await openApp('/');
  assert.equal(router.currentRoute.value.params.lang, 'ru');
  assert.equal(w.find('#nav select.lang-select').exists(), false);
});

test('a lesson page does not send readers to a draft language', async () => {
  stubSite({ ...withDraft, 'locales/index.json': { base: 'ru', default: 'ru', available: ['ru', 'es'], names: { ru: 'Русский', es: 'Español' }, drafts: ['en'] },
    'locales/es/ui.json': ruUi, 'locales/es/catalog.json': {} });
  const { router } = await openApp('/es/lesson/intro');
  // intro is written in ru and in the draft en: only ru is offered
  assert.equal(router.currentRoute.value.fullPath, '/es/lesson/intro');
  assert.deepEqual(wrapper!.findAll('.lesson-missing a').map((a) => a.attributes('lang')), ['ru']);
});

test('phones: the menu stays open after switching the language, so the reader sees what changed', async () => {
  stubSite(enSite);
  const { router, w } = await openApp('/ru/lesson/intro');
  const menu = w.find('button[aria-controls="nav"]');
  await menu.trigger('click');
  await w.find<HTMLSelectElement>('#nav select.lang-select').setValue('en');
  await flushPromises();
  assert.equal(router.currentRoute.value.fullPath, '/en/lesson/intro');
  assert.equal(menu.attributes('aria-expanded'), 'true');
  // any other navigation still closes it
  await router.push('/en/plan');
  await flushPromises();
  assert.equal(menu.attributes('aria-expanded'), 'false');
});
