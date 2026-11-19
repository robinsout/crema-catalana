// Opening #/import/<payload>…: progress from the old address is merged, a sync code is only offered.
import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { stubSite, syncServer, useSyncServer, SYNC_URL } from './helpers.ts';
import { generateCode } from '../src/services/sync.ts';

const sent: { event: string; props: Record<string, unknown> }[] = [];
vi.mock('../src/api/visits.ts', () => ({
  visitsApi: { count: (event: string, props: Record<string, unknown>) => { sent.push({ event, props }); }, isOff: () => false, setOff: () => {} },
}));
const { default: App } = await import('../src/App.vue');
const { createAppRouter } = await import('../src/router.ts');
const { useSyncStore } = await import('../src/stores/sync.ts');

let mounted: VueWrapper | null = null;
let requested: string[] = [];
const syncRequests = () => requested.filter((u) => u.startsWith(SYNC_URL)).length;

beforeEach(() => {
  sent.length = 0;
  localStorage.clear();
  useSyncServer(syncServer());
  requested = stubSite();
  window.HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(() => { mounted?.unmount(); mounted = null; vi.unstubAllGlobals(); });

const payload = (progress: unknown, sync: unknown = null): string => {
  const json = Buffer.from(JSON.stringify({ v: 1, progress: progress === null ? null : JSON.stringify(progress), sync: sync === null ? null : JSON.stringify(sync) }));
  return Buffer.concat([Buffer.from([1]), deflateRawSync(json)]).toString('base64url');
};

async function open(path: string) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  mounted = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await flushPromises();
  await new Promise((r) => setTimeout(r, 30));
  await flushPromises();
  return router;
}
const saved = () => JSON.parse(localStorage.getItem('quadern-catala') ?? '{}');

test('progress is merged with local and the original lesson route opens', async () => {
  localStorage.setItem('quadern-catala', JSON.stringify({ done: { 'x-temps': true }, doneAt: { 'x-temps': 10 }, last: null }));
  const p = payload({ done: { 'b1-01': true }, doneAt: { 'b1-01': 5 }, last: 'b1-01' });
  const router = await open(`/import/${p}/ru/lesson/b1-01`);
  assert.equal(router.currentRoute.value.fullPath, '/ru/lesson/b1-01');
  assert.ok(!router.currentRoute.value.fullPath.includes('import'));
  assert.deepEqual(saved().done, { 'x-temps': true, 'b1-01': true });
});

test('legacy link and plain import resolve like old links', async () => {
  const p = payload({ done: { 'b1-01': true }, doneAt: { 'b1-01': 5 } });
  const r1 = await open(`/import/${p}/b1-01`);
  assert.equal(r1.currentRoute.value.fullPath, '/ru/lesson/b1-01');
  mounted?.unmount();
  const r2 = await open(`/import/${p}`);
  assert.match(r2.currentRoute.value.fullPath, /^\/ru\/(plan|lesson\/)/);
  assert.ok(!r2.currentRoute.value.fullPath.includes('import'));
});

test('a query of the original route is kept', async () => {
  const router = await open(`/import/${payload({ done: {} })}/ru/plan?x=1`);
  assert.equal(router.currentRoute.value.fullPath, '/ru/plan?x=1');
});

test('a sync code is only offered: no storage write, no request, lands on the sync page', async () => {
  const code = generateCode();
  const router = await open(`/import/${payload({ done: { 'b1-01': true }, doneAt: { 'b1-01': 5 } }, { code, lastSyncAt: 1 })}/ru/lesson/b1-01`);
  assert.equal(router.currentRoute.value.fullPath, '/ru/sync');
  assert.equal(useSyncStore().incoming, code);
  assert.equal(localStorage.getItem('quadern-sync'), null);
  assert.equal(syncRequests(), 0);
  assert.deepEqual(saved().done, { 'b1-01': true });
});

test('a code is ignored when this device already syncs', async () => {
  const mine = generateCode();
  localStorage.setItem('quadern-sync', JSON.stringify({ code: mine, lastSyncAt: null }));
  const router = await open(`/import/${payload({ done: {} }, { code: generateCode(), lastSyncAt: 1 })}/ru/plan`);
  assert.equal(router.currentRoute.value.fullPath, '/ru/plan');
  assert.equal(useSyncStore().incoming, null);
  assert.equal(useSyncStore().code, mine);
});

test('a malformed payload imports nothing and opens the original route', async () => {
  localStorage.setItem('quadern-catala', JSON.stringify({ done: { 'x-temps': true }, doneAt: { 'x-temps': 10 }, last: null }));
  const router = await open('/import/garbage!!/ru/lesson/b1-01');
  assert.equal(router.currentRoute.value.fullPath, '/ru/lesson/b1-01');
  assert.deepEqual(saved().done, { 'x-temps': true });
  const r2 = await open('/import/AAAA/ru/plan');
  assert.equal(r2.currentRoute.value.fullPath, '/ru/plan');
});

test('the payload never reaches the counter', async () => {
  const p = payload({ done: { 'b1-01': true }, doneAt: { 'b1-01': 5 } }, { code: generateCode(), lastSyncAt: 1 });
  await open(`/import/${p}/ru/lesson/b1-01`);
  const all = JSON.stringify(sent);
  assert.ok(!all.includes(p.slice(0, 20)), all);
  assert.ok(!/import/.test(all), all);
  assert.ok(sent.every((s) => s.event !== 'view' || ['sync', 'plan', 'b1-01'].includes(String(s.props.page))));
});
