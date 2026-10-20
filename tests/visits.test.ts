// Visit counting (robinsout/counter): what the site sends, and that it never sends anything else.
// Only fixed ids go out: the page name or a lesson id, never a route parameter as it is (the sync
// screen carries a secret code in its address).
import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { stubSite, syncServer, useSyncServer } from './helpers.ts';
import { visitEvent } from '../src/services/visits.ts';

const sent: { event: string; props: Record<string, unknown> }[] = [];
let off = false;
vi.mock('../src/api/visits.ts', () => ({
  visitsApi: {
    count: (event: string, props: Record<string, unknown>) => { if (!off) sent.push({ event, props }); },
    isOff: () => off,
    setOff: (v: boolean) => { off = v; },
  },
}));

const { default: App } = await import('../src/App.vue');
const { createAppRouter } = await import('../src/router.ts');
const { useProgressStore } = await import('../src/stores/progress.ts');
const { useExercisesStore } = await import('../src/stores/exercises.ts');
const { useVisitsStore } = await import('../src/stores/visits.ts');

let mounted: VueWrapper | null = null;

beforeEach(() => {
  sent.length = 0;
  off = false;
  localStorage.clear();
  useSyncServer(syncServer());
  stubSite();
  window.HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
});

async function open(path: string) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  mounted = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await flushPromises();
  return router;
}

test('events are built from fixed ids only; anything else is dropped', () => {
  assert.deepEqual(visitEvent('view', { page: 'b1-04', lang: 'es' }), { event: 'view', props: { page: 'b1-04', lang: 'es' } });
  assert.equal(visitEvent('view', { page: '0123456789abcdef0123456789abcdef', lang: 'ru' })?.props.page, '0123456789abcdef0123456789abcdef');
  for (const page of ['#/ru/sync/abc', 'B1-04', '', 'a/b', 'https://x.y']) assert.equal(visitEvent('view', { page, lang: 'ru' }), null, page);
  assert.equal(visitEvent('view', { page: 'plan', lang: 'Русский' }), null);
  assert.equal(visitEvent('exercise', { lesson: 'b1-01', exercise: 'ex1', score: 2.5, total: 4, lang: 'ru' }), null);
  assert.deepEqual(visitEvent('exercise', { lesson: 'b1-01', exercise: 'ex1', score: 3, total: 4, lang: 'ru' })?.props,
    { lesson: 'b1-01', exercise: 'ex1', score: 3, total: 4, lang: 'ru' });
});

test('opening the plan, a lesson and the sync page counts a view of each, with the language', async () => {
  const router = await open('/ru/plan');
  await router.push('/ru/lesson/b1-01');
  await flushPromises();
  await router.push('/ru/sync');
  await flushPromises();
  assert.deepEqual(sent.filter((s) => s.event === 'view').map((s) => s.props), [
    { page: 'plan', lang: 'ru' }, { page: 'b1-01', lang: 'ru' }, { page: 'sync', lang: 'ru' },
  ]);
});

test('a sync code in the address never reaches the counter', async () => {
  await open('/ru/sync/0123-4567-89ab-cdef-0123-4567-89ab-cdef');
  await flushPromises();
  const all = JSON.stringify(sent);
  assert.ok(!/0123|cdef/.test(all), all);
  assert.deepEqual(sent.map((s) => s.props.page), ['sync']);
});

test('a chapter read to the end counts once; exercises count with their result', async () => {
  await open('/ru/lesson/b1-01');
  const progress = useProgressStore();
  progress.reachSection('b1-01', 'salutacions', ['salutacions', 'practica']);
  progress.reachSection('b1-01', 'salutacions', ['salutacions', 'practica']);
  progress.reachSection('b1-01', 'practica', ['salutacions', 'practica']);
  assert.deepEqual(sent.filter((s) => s.event === 'chapter').map((s) => s.props), [
    { lesson: 'b1-01', chapter: 'salutacions', lang: 'ru' }, { lesson: 'b1-01', chapter: 'practica', lang: 'ru' },
  ]);
  useExercisesStore().finishChoice('b1-01/ex1', [{ prompt: 'a', options: ['x', 'y'], answer: 1 }], [1]);
  assert.deepEqual(sent.filter((s) => s.event === 'exercise').map((s) => s.props), [{ lesson: 'b1-01', exercise: 'ex1', score: 1, total: 1, lang: 'ru' }]);
});

test('listening counts once per lesson; turning sync on counts', async () => {
  await open('/ru/lesson/b1-01');
  const visits = useVisitsStore();
  visits.audio('b1-01');
  visits.audio('b1-01');
  visits.audio('b1-02');
  visits.syncOn();
  assert.deepEqual(sent.filter((s) => s.event !== 'view').map((s) => [s.event, s.props]), [
    ['audio', { lesson: 'b1-01', lang: 'ru' }], ['audio', { lesson: 'b1-02', lang: 'ru' }], ['sync', { lang: 'ru' }],
  ]);
});

test('"do not count my visits" is a switch on the plan, and it stops everything', async () => {
  await open('/ru/plan');
  const box = mounted!.find<HTMLInputElement>('.visits input[type="checkbox"]');
  assert.ok(box.exists());
  assert.equal(box.element.checked, false);
  assert.ok(mounted!.find('.visits a[href="https://github.com/robinsout/counter"]').exists(), 'the code is open to check');
  await box.setValue(true);
  assert.equal(off, true);
  sent.length = 0;
  useVisitsStore().audio('b1-01');
  assert.equal(sent.length, 0);
});
