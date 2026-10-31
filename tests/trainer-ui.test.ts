// Conjugation trainer page (BACKLOG I-12): the task card, checking as one types, the pause after a
// right form, the tense row after a mistake, hints, the day's goal and its summary, settings, the
// state kept on this device (not synced).
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
import { today } from '../src/services/trainer.ts';
import { stubSite, saveProgress } from './helpers.ts';
import type { VerbsData } from '../src/types/index.ts';

const data: VerbsData = JSON.parse(readFileSync('content/verbs/verbs.json', 'utf8'));
const ui = (lang: string) => JSON.parse(readFileSync(`content/locales/${lang}/ui.json`, 'utf8'));
const pick = (ids: string[]): VerbsData => ({ ...data, verbs: data.verbs.filter((v) => ids.includes(v.id)) });

let wrapper: VueWrapper | null = null;
beforeEach(() => {
  localStorage.clear();
  stubSite({
    'verbs/verbs.json': pick(['ser', 'anar', 'fer']),
    'locales/ru/verbs.json': { ser: 'быть', anar: 'идти', fer: 'делать' },
    'locales/ru/ui.json': ui('ru'),
  });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  vi.spyOn(Math, 'random').mockReturnValue(0); // the first task of the pool: ser · jo · present
});
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// only the present tense, so the tasks are known
const presentOnly = (extra: Record<string, unknown> = {}) => saveProgress(JSON.stringify({ done: {}, last: null, verbTenses: ['ind.pres'], ...extra }));

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

const saved = () => parseProgress(localStorage.getItem(STORAGE_KEY));
const trainer = () => saved().trainer as { day: { done: number; exact: number; missed: number } };
async function type(w: VueWrapper, text: string) {
  await w.find('.tr-input').setValue(text);
  await flushPromises();
}

test('the card asks for a verb, a person and a tense; the tabs show the trainer', async () => {
  presentOnly();
  const { w } = await openApp('/ru/trainer');
  assert.equal(w.find('.area-tabs a[aria-current="page"]').text(), 'Тренажёр');
  assert.equal(w.find('.tr-verb').text(), 'ser');
  assert.match(w.find('.tr-ask').text(), /jo · Present/);
  assert.match(w.find('.tr-goal').text(), /0 \/ 25/);
  assert.match(document.title, /Тренажёр/);
});

test('a right form: green, a short pause, then the next task and the form under "previous"', async () => {
  presentOnly();
  const { w } = await openApp('/ru/trainer');
  vi.useFakeTimers();
  await type(w, 'soc');
  assert.ok(w.find('.tr-field').classes().includes('is-correct'));
  assert.equal(w.findAll('.tr-letters .l-ok').length, 3);
  assert.equal(trainer().day.done, 1);
  await vi.advanceTimersByTimeAsync(1300);
  assert.notEqual(w.find('.tr-verb').text() + w.find('.tr-ask').text(), 'serjo · Present');
  assert.match(w.find('.tr-prev').text(), /ser · jo · Present → soc/);
  assert.equal((w.find('.tr-input').element as HTMLInputElement).value, '');
});

test('a letter typed during the pause starts the next task at once', async () => {
  presentOnly();
  const { w } = await openApp('/ru/trainer');
  vi.useFakeTimers();
  await type(w, 'soc');
  const first = w.find('.tr-ask').text() + w.find('.tr-verb').text();
  await type(w, 'socv');
  assert.notEqual(w.find('.tr-ask').text() + w.find('.tr-verb').text(), first);
  assert.equal((w.find('.tr-input').element as HTMLInputElement).value, 'v');
});

test('a wrong letter is marked and stops typing; the task then waits for "Next" and shows the tense row', async () => {
  presentOnly();
  const { w } = await openApp('/ru/trainer');
  await type(w, 'sx');
  assert.equal(w.findAll('.tr-letters .l-bad').length, 1);
  assert.match(w.find('.tr-status').text(), /Не та буква/);
  await type(w, 'sxy');
  assert.equal((w.find('.tr-input').element as HTMLInputElement).value, 'sx', 'nothing after the wrong letter');
  await type(w, 'soc');
  assert.match(w.find('.tr-status').text(), /С ошибкой/);
  assert.match(w.find('.tr-row').text(), /som/);
  assert.equal(trainer().day.missed, 1);
  await w.find('.tr-action').trigger('click');
  await flushPromises();
  assert.equal((w.find('.tr-input').element as HTMLInputElement).value, '');
  assert.ok(!w.find('.tr-row').exists());
});

test('a form without its accent is "almost": counted, but waits for "Next"', async () => {
  saveProgress(JSON.stringify({ done: {}, last: null, verbTenses: ['ind.pres'], trainer: { settings: { persons: [false, false, true, false, false, false], limit: 300, kinds: { regular: true, irregular: true }, goal: 25 } } }));
  const { w } = await openApp('/ru/trainer');
  assert.equal(w.find('.tr-verb').text(), 'ser'); // ell · és
  await type(w, 'es');
  assert.match(w.find('.tr-status').text(), /Почти/);
  assert.match(w.find('.tr-status').text(), /és/);
  assert.equal(w.find('.tr-action').text(), 'Дальше ↵');
});

test('a hint gives the next letter; the form typed with a hint counts as a mistake', async () => {
  presentOnly();
  const { w } = await openApp('/ru/trainer');
  await w.find('.tr-action').trigger('click');
  await flushPromises();
  assert.equal((w.find('.tr-input').element as HTMLInputElement).value, 's');
  assert.equal(w.findAll('.tr-letters .l-hint').length, 1);
  await type(w, 'soc');
  assert.equal(trainer().day.missed, 1);
});

test('the goal of the day: a summary with the forms to look at again; "more" goes on', async () => {
  presentOnly({ trainer: { settings: { persons: [true, true, true, true, true, true], limit: 300, kinds: { regular: true, irregular: true }, goal: 10 },
    day: { date: today(), done: 9, exact: 8, almost: 0, missed: 1, review: [{ key: 'fer|ind.pres|0', form: 'faig' }] } } });
  const { w } = await openApp('/ru/trainer');
  vi.useFakeTimers();
  await type(w, 'soc');
  await vi.advanceTimersByTimeAsync(1300);
  assert.match(w.find('.tr-done').text(), /Цель на сегодня выполнена/);
  assert.match(w.find('.tr-done').text(), /fer · jo · Present → faig/);
  await w.find('.tr-more').trigger('click');
  await flushPromises();
  assert.ok(w.find('.tr-input').exists());
});

test('settings: persons, frequency, goal; saved on the device only, never synced', async () => {
  presentOnly();
  const { w } = await openApp('/ru/trainer');
  await w.find('.tr-settings input[data-person="0"]').setValue(false);
  await w.find('.tr-settings input[data-goal="50"]').setValue(true);
  await flushPromises();
  const t = saved().trainer as { settings: { persons: boolean[]; goal: number } };
  assert.equal(t.settings.persons[0], false);
  assert.equal(t.settings.goal, 50);
  assert.ok(!('trainer' in syncable(saved())));
  assert.notEqual(w.find('.tr-ask').text().split(' · ')[0], 'jo');
});

test('?verb= trains one verb; a verb page links to it', async () => {
  presentOnly();
  const { w, router } = await openApp('/ru/trainer?verb=anar');
  assert.equal(w.find('.tr-verb').text(), 'anar');
  await router.push('/ru/verbs/fer');
  await flushPromises();
  assert.equal(w.find('a.verb-practice').attributes('href'), '/ru/trainer?verb=fer');
});

test('after a first hint the whole answer can be shown; it counts as a mistake', async () => {
  presentOnly();
  const { w } = await openApp('/ru/trainer');
  assert.ok(!w.find('.tr-reveal').exists(), 'not before a hint');
  await w.find('.tr-action').trigger('click');
  await flushPromises();
  await w.find('.tr-reveal').trigger('click');
  await flushPromises();
  assert.equal((w.find('.tr-input').element as HTMLInputElement).value, 'soc');
  assert.equal(trainer().day.missed, 1);
  assert.match(w.find('.tr-row').text(), /som/);
});
