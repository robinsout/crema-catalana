// Verb reference pages (BACKLOG I-11): the list with search, a verb with its tenses, the choice of
// tenses kept on this device (progress v7, not synced), and the content: translations of every verb.
import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppRouter } from '../src/router.ts';
import { STORAGE_KEY, parseProgress } from '../src/services/progress.ts';
import { syncable } from '../src/services/sync.ts';
import { contentLanguages } from '../scripts/lib/catalog.ts';
import { parseVerbList } from '../scripts/lib/verbs.ts';
import { stubSite, saveProgress } from './helpers.ts';
import type { LocalesIndex, VerbsData } from '../src/types/index.ts';

const data: VerbsData = JSON.parse(readFileSync('content/verbs/verbs.json', 'utf8'));
const ui = (lang: string) => JSON.parse(readFileSync(`content/locales/${lang}/ui.json`, 'utf8'));
const pick = (ids: string[]): VerbsData => ({ ...data, verbs: data.verbs.filter((v) => ids.includes(v.id)) });

let wrapper: VueWrapper | null = null;
let requested: string[] = [];
beforeEach(() => {
  localStorage.clear();
  requested = stubSite({
    'verbs/verbs.json': pick(['ser', 'anar', 'fer', 'cantar', 'adonar-se']),
    'locales/ru/verbs.json': { ser: 'быть', anar: 'идти', fer: 'делать', cantar: 'петь', 'adonar-se': 'замечать' },
    'locales/ru/ui.json': ui('ru'),
  });
  window.HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

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

test('the menu links to the verbs; the list shows verbs in frequency order with translations', async () => {
  const { w } = await openApp('/ru/verbs');
  assert.equal(w.find('a.verbs-link').attributes('aria-current'), 'page');
  assert.deepEqual(w.findAll('.verb-inf').map((e) => e.text()), ['ser', 'anar', 'fer', 'adonar-se', 'cantar']);
  assert.match(w.find('.verb-list').text(), /петь/);
  assert.match(document.title, /Глаголы/);
  assert.ok(!requested.some((u) => u.includes('verbs') && u.includes('/en/')), 'only the reader’s language is fetched');
});

test('search by a form names the verb and the tense, and stays in the address', async () => {
  const { w, router } = await openApp('/ru/verbs');
  await w.find('.verb-search input').setValue('vaig');
  await flushPromises();
  assert.deepEqual(w.findAll('.verb-inf').map((e) => e.text()), ['anar']);
  assert.match(w.find('.verb-form').text(), /vaig · Present/);
  assert.equal(router.currentRoute.value.query.q, 'vaig');
  await w.find('.verb-search input').setValue('zzz');
  await flushPromises();
  assert.match(w.text(), /Ничего не нашлось/);
});

test('a verb page: the default tenses grouped by mood, alternatives, non-personal forms', async () => {
  const { w } = await openApp('/ru/verbs/anar');
  assert.equal(w.find('.lesson-head h2').text(), 'anar');
  assert.match(w.find('.lesson-head .sub').text(), /идти/);
  assert.deepEqual(w.findAll('.mood h3').map((e) => e.text()), ['Indicatiu', 'Subjuntiu', 'Imperatiu', 'Formes no personals']);
  const tenses = w.findAll('.conj-card').map((e) => e.attributes('data-tense'));
  assert.deepEqual(tenses, ['ind.pres', 'ind.perf', 'ind.perif', 'ind.imperf', 'ind.fut', 'ind.cond', 'subj.pres', 'imp']);
  const fut = w.find('.conj-card[data-tense="ind.fut"]');
  assert.match(fut.text(), /aniré/);
  const perif = w.find('.conj-card[data-tense="ind.perif"]');
  assert.match(perif.text(), /vaig anar/);
  assert.equal(perif.find('.alt').text(), '/ vares anar');
  assert.match(w.find('table.nonpers').text(), /anant/);
  assert.match(document.title, /^anar ·/);
});

test('switching a tense off hides it on every verb and is saved on this device only', async () => {
  const { w, router } = await openApp('/ru/verbs/cantar');
  await w.find('input[data-tense="ind.cond"]').setValue(false);
  await w.find('input[data-tense="ind.simple"]').setValue(true);
  await flushPromises();
  assert.ok(!w.find('.conj-card[data-tense="ind.cond"]').exists());
  assert.ok(w.find('.conj-card[data-tense="ind.simple"]').exists());
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  assert.ok(saved.verbTenses.includes('ind.simple') && !saved.verbTenses.includes('ind.cond'));
  assert.ok(!('verbTenses' in syncable(parseProgress(JSON.stringify(saved)))), 'not synced');
  await router.push('/ru/verbs/fer');
  await flushPromises();
  assert.ok(!w.find('.conj-card[data-tense="ind.cond"]').exists());
  assert.match(w.find('.conj-card[data-tense="ind.simple"]').text(), /fiu/);
});

test('progress saved by older versions keeps working; a broken tense choice falls back to the defaults', async () => {
  saveProgress(JSON.stringify({ done: { 'b1-01': true }, last: 'b1-01', verbTenses: 'nonsense' }));
  const { w } = await openApp('/ru/verbs/fer');
  assert.equal(w.findAll('.conj-card').length, 8);
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  assert.deepEqual(saved.done, { 'b1-01': true });
});

test('a pronominal verb shows its pronouns; an unknown verb says so', async () => {
  const { w, router } = await openApp('/ru/verbs/adonar-se');
  assert.match(w.find('.conj-card[data-tense="ind.pres"]').text(), /m'adono/);
  await router.push('/ru/verbs/volar');
  await flushPromises();
  assert.match(w.text(), /Такого глагола в справочнике нет/);
});

test('every verb has a translation in every language, and no other keys', () => {
  const locales: LocalesIndex = JSON.parse(readFileSync('content/locales/index.json', 'utf8'));
  const ids = data.verbs.map((v) => v.id);
  assert.deepEqual(parseVerbList(readFileSync('authoring/verbs.txt', 'utf8')).map((v) => v.id), ids, 'verbs.json is generated from authoring/verbs.txt');
  for (const lang of contentLanguages(locales)) {
    const tr = JSON.parse(readFileSync(`content/locales/${lang}/verbs.json`, 'utf8')) as Record<string, string>;
    assert.deepEqual(ids.filter((id) => !tr[id]?.trim()), [], `${lang}: missing`);
    assert.deepEqual(Object.keys(tr).filter((k) => !ids.includes(k)), [], `${lang}: extra`);
  }
});
