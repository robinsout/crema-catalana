import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppRouter } from '../src/router.ts';
import { stubSite, saveProgress } from './helpers.ts';
import { STORAGE_KEY } from '../src/services/progress.ts';

let wrapper: VueWrapper | null = null;

beforeEach(() => {
  localStorage.clear();
  stubSite();
  // happy-dom has no media playback
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  window.HTMLElement.prototype.scrollIntoView = () => {};
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

test('a lesson shows its header, content and pager', async () => {
  const { w } = await openApp('/ru/lesson/b1-01');
  assert.match(w.find('.lesson-head h2').text(), /Hola, soc la Maria/);
  assert.match(w.find('.eyebrow').text(), /Bàsic 1 · Unitat 1/);
  assert.match(w.find('article.lesson').html(), /Раздел b1-01/);
  assert.match(w.find('.related').text(), /Els temps/);
  assert.equal(w.findAll('.toc li').length, 2); // the lesson section and its vocabulary
});

test('a lesson with a vocabulary shows it as the last section, clickable for audio', async () => {
  const { w } = await openApp('/ru/lesson/b1-01');
  const vocab = w.find('#vocab');
  assert.ok(vocab.exists());
  assert.match(vocab.find('h2').text(), /Слова урока/);
  assert.match(vocab.text(), /Дни/);
  const first = vocab.find('tbody tr');
  assert.match(first.text(), /el dilluns/);
  assert.match(first.text(), /понедельник/);
  assert.ok(vocab.find('[lang="ca"]').exists());
  assert.match(vocab.text(), /не otoño/);
  assert.deepEqual(w.findAll('.toc li').map((li) => li.text()), ['Раздел b1-01', 'Слова урока']);
});

test('a lesson without a vocabulary has no vocabulary section', async () => {
  const { w } = await openApp('/ru/lesson/intro');
  assert.equal(w.find('#vocab').exists(), false);
});

test('marking a lesson as done updates the button and the progress in the menu', async () => {
  const { w } = await openApp('/ru/lesson/b1-01');
  assert.match(w.find('.progress').text(), /Пройдено: 0 из 3/);
  await w.find('.head-actions .btn').trigger('click');
  assert.match(w.find('.head-actions .btn').text(), /Урок пройден/);
  assert.match(w.find('.progress').text(), /Пройдено: 1 из 3/);
  assert.ok(w.find('.lesson-list a.done').exists());
});

test('progress saved by the first version shows up', async () => {
  saveProgress('{"done":{"l01":true},"last":"l01"}');
  const { router, w } = await openApp('/');
  assert.equal(router.currentRoute.value.fullPath, '/ru/lesson/intro');
  assert.match(w.find('.progress').text(), /Пройдено: 1 из 3/);
  assert.match(w.find('.head-actions .btn').text(), /Урок пройден/);
});

test('the plan lists units; an unwritten unit links to its place in the plan', async () => {
  const { w } = await openApp('/ru/plan/b1-02');
  assert.equal(w.findAll('.unit').length, 4);
  assert.ok(w.find('#u-b1-02').classes().includes('focus'));
  assert.match(w.find('#u-b1-02 .pill').text(), /Урок появится/);
  assert.match(w.find('#u-b1-01 .pill').text(), /Открыть урок/);
  const navLink = w.findAll('.lesson-list a').find((a) => a.text().includes('Aquesta és la meva família'));
  assert.equal(navLink?.attributes('href'), '/ru/plan/b1-02');
  assert.ok(navLink?.classes().includes('soon'));
});

test('a focused unit in the plan is scrolled into view', async () => {
  const scrolled: string[] = [];
  window.HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) { scrolled.push(this.id); };
  await openApp('/ru/plan/b1-02');
  assert.ok(scrolled.includes('u-b1-02'), `scrolled: ${scrolled.join(', ')}`);
});

test('the menu marks the open lesson as current', async () => {
  const { w } = await openApp('/ru/lesson/x-temps');
  const current = w.findAll('.lesson-list a[aria-current="page"]');
  assert.equal(current.length, 1);
  assert.match(current[0]?.text() ?? '', /Els temps/);
});

test('a click on a Catalan phrase plays its clip', async () => {
  const { w } = await openApp('/ru/lesson/b1-01');
  await flushPromises();
  await w.find('article.lesson [lang="ca"]').trigger('click');
  assert.equal(vi.mocked(window.HTMLMediaElement.prototype.play).mock.calls.length, 1);
});

test('a broken site shows an error instead of an empty page', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  await router.push('/').catch(() => {});
  wrapper = mount(App, { global: { plugins: [pinia, router] } });
  await flushPromises();
  assert.ok(wrapper.find('.status').exists());
});

test('a fill-in exercise checks answers, shows solutions and saves the result', async () => {
  const { w } = await openApp('/ru/lesson/x-temps');
  const ex = w.find('[data-exercise="fill1"] .ex');
  assert.ok(ex.exists(), 'the exercise is mounted into its placeholder');
  const inputs = ex.findAll('input');
  assert.equal(inputs.length, 3);
  await inputs[0]?.setValue('Vaig  anar');
  await inputs[1]?.setValue('es');
  await inputs[2]?.setValue('plourà');
  await ex.find('button.ex-check').trigger('click');
  const items = ex.findAll('li');
  assert.ok(items[0]?.classes().includes('is-correct'));
  assert.ok(items[1]?.classes().includes('is-accent'));
  assert.match(items[1]?.text() ?? '', /проверьте ударения/);
  assert.ok(items[2]?.classes().includes('is-wrong'));
  assert.match(items[2]?.find('.ex-solution').text() ?? '', /farà/);
  assert.match(ex.find('.ex-score').text(), /Верно: 1 из 3/);
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  assert.equal(saved.exercises['x-temps/fill1'].score, 1);
  assert.equal(saved.exercises['x-temps/fill1'].total, 3);
  await ex.find('button.ex-retry').trigger('click');
  assert.equal((ex.find('input').element as HTMLInputElement).value, '');
  assert.match(ex.text(), /Последний результат: 1 из 3/);
});

test('a choice exercise marks the picked option at once and saves the result', async () => {
  const { w } = await openApp('/ru/lesson/x-temps');
  const ex = w.find('[data-exercise="pick"] .ex');
  const options = ex.findAll('button.ex-option');
  assert.deepEqual(options.map((o) => o.text()), ['perfet', 'imperfet']);
  await options[1]?.trigger('click');
  assert.ok(ex.find('li').classes().includes('is-wrong'));
  assert.ok(options[0]?.classes().includes('right'));
  assert.match(ex.text(), /avui → perfet/);
  assert.match(ex.find('.ex-score').text(), /Верно: 0 из 1/);
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  assert.equal(saved.exercises['x-temps/pick'].total, 1);
});
