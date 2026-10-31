// Two areas of the site (BACKLOG I-12): "Lessons" and "Verbs" (the reference and the trainer).
// The switch in the header, the menu of each area, and opening the site where the reader left off.
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
import { stubSite, saveProgress } from './helpers.ts';
import type { VerbsData } from '../src/types/index.ts';

const data: VerbsData = JSON.parse(readFileSync('content/verbs/verbs.json', 'utf8'));
const ui = (lang: string) => JSON.parse(readFileSync(`content/locales/${lang}/ui.json`, 'utf8'));
const pick = (ids: string[]): VerbsData => ({ ...data, verbs: data.verbs.filter((v) => ids.includes(v.id)) });

let wrapper: VueWrapper | null = null;
beforeEach(() => {
  localStorage.clear();
  stubSite({
    'verbs/verbs.json': pick(['ser', 'anar', 'fer', 'tenir', 'dir', 'veure', 'cantar']),
    'locales/ru/verbs.json': { ser: 'быть', anar: 'идти', fer: 'делать', tenir: 'иметь', dir: 'говорить', veure: 'видеть', cantar: 'петь' },
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
const go = async (router: Awaited<ReturnType<typeof openApp>>['router'], path: string) => { await router.push(path); await flushPromises(); };
const current = (w: VueWrapper) => w.find('.area-switch a[aria-current="page"]').text();
const saved = () => parseProgress(localStorage.getItem(STORAGE_KEY));

test('the header switches between the lessons and the verbs; the current area is marked', async () => {
  const { w, router } = await openApp('/ru/lesson/b1-01');
  assert.equal(current(w), 'Уроки');
  await go(router, '/ru/verbs');
  assert.equal(current(w), 'Глаголы');
  await go(router, '/ru/trainer');
  assert.equal(current(w), 'Глаголы');
  await go(router, '/ru/verbs/anar');
  assert.equal(current(w), 'Глаголы');
});

test('each area links back to where the reader was in it', async () => {
  const { w, router } = await openApp('/ru/lesson/b1-01');
  await go(router, '/ru/trainer');
  assert.equal(w.find('.area-switch a:first-child').attributes('href'), '/ru/lesson/b1-01');
  await go(router, '/ru/plan');
  assert.equal(w.find('.area-switch a:last-child').attributes('href'), '/ru/trainer', 'the verbs tab used last');
  await go(router, '/ru/verbs');
  await go(router, '/ru/lesson/intro');
  assert.equal(w.find('.area-switch a:last-child').attributes('href'), '/ru/verbs');
});

test('the lessons menu lists the lessons; the verbs menu has the trainer, search and recent verbs instead', async () => {
  const { w, router } = await openApp('/ru/plan');
  assert.ok(w.find('.nav .lesson-list').text().includes('Hola, soc la Maria'));
  assert.ok(!w.find('a.verbs-link').exists(), 'the verbs are in the header now');
  await go(router, '/ru/verbs');
  assert.ok(!w.find('.nav').text().includes('Hola, soc la Maria'));
  assert.match(w.find('.nav .goal-line').text(), /Тренажёр сегодня\s*0 из 25/);
  assert.ok(w.find('.nav .side-search input').exists());
  assert.ok(w.find('.nav .sync-link').exists(), 'sync and the language stay where they were');
});

test('recent verbs: the last five opened, newest first; kept on the device, not synced', async () => {
  const { w, router } = await openApp('/ru/verbs');
  for (const v of ['ser', 'anar', 'fer', 'tenir', 'dir', 'veure', 'anar']) await go(router, `/ru/verbs/${v}`);
  assert.deepEqual(w.findAll('.nav .recent .t').map((e) => e.text()), ['anar', 'veure', 'dir', 'tenir', 'fer']);
  assert.ok(!('recentVerbs' in syncable(saved())));
});

test('the menu search opens the reference with the query', async () => {
  const { w, router } = await openApp('/ru/trainer');
  const input = w.find('.nav .side-search input');
  await input.setValue('vaig');
  await w.find('.nav .side-search').trigger('submit');
  await flushPromises();
  assert.equal(router.currentRoute.value.name, 'verbs');
  assert.equal(router.currentRoute.value.query.q, 'vaig');
});

test('the site opens where the reader left off: the trainer, the reference, or the last lesson', async () => {
  saveProgress(JSON.stringify({ done: {}, last: 'b1-01', lastArea: 'trainer' }));
  let { router } = await openApp('/');
  assert.equal(router.currentRoute.value.name, 'trainer');
  wrapper?.unmount();
  saveProgress(JSON.stringify({ done: {}, last: 'b1-01', lastArea: 'verbs' }));
  ({ router } = await openApp('/'));
  assert.equal(router.currentRoute.value.name, 'verbs');
  wrapper?.unmount();
  saveProgress(JSON.stringify({ done: {}, last: 'b1-01', lastArea: 'lessons' }));
  ({ router } = await openApp('/'));
  assert.equal(router.currentRoute.value.fullPath, '/ru/lesson/b1-01');
});

test('the last area is remembered on the device', async () => {
  const { router } = await openApp('/ru/lesson/b1-01');
  assert.equal(saved().lastArea, 'lessons');
  await go(router, '/ru/trainer');
  assert.equal(saved().lastArea, 'trainer');
  await go(router, '/ru/verbs/fer');
  assert.equal(saved().lastArea, 'verbs');
  assert.ok(!('lastArea' in syncable(saved())));
});
