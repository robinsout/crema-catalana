// Sync in the interface: two "devices" are two app mounts with separate browser storage,
// talking to the real server handler (in memory).
import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppRouter } from '../src/router.ts';
import { stubSite, syncServer, useSyncServer, SYNC_URL } from './helpers.ts';

let mounted: VueWrapper[] = [];
let requested: string[] = [];
const syncRequests = () => requested.filter((u) => u.startsWith(SYNC_URL)).length;

beforeEach(() => {
  localStorage.clear();
  useSyncServer(syncServer());
  requested = stubSite();
  window.HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(() => {
  for (const w of mounted) w.unmount();
  mounted = [];
  vi.unstubAllGlobals();
});

async function device(path: string) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  const w = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  mounted.push(w);
  await flushPromises();
  return { w, router };
}

// each device keeps its own localStorage
function switchStorage(state: Record<string, string>) {
  localStorage.clear();
  for (const [k, v] of Object.entries(state)) localStorage.setItem(k, v);
}
const snapshot = () => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k) ?? '']));

// WebCrypto works on real timers: give it time, not only microtasks
const settle = async () => { for (let i = 0; i < 10; i++) { await new Promise((r) => setTimeout(r, 15)); await flushPromises(); } };

test('turning sync on shows a code and a QR code with a link to join', async () => {
  const { w } = await device('/ru/sync');
  await w.find('button.sync-enable').trigger('click');
  await settle();
  const code = w.find('.sync-code').text();
  assert.match(code, /^([0-9A-Z]{4}-){6}[0-9A-Z]{3}$/);
  assert.ok(w.find('.sync-qr svg').exists());
  assert.match(w.find('.sync-link-text').text(), new RegExp(`#/ru/sync/${code.replace(/-/g, '')}$`));
  assert.ok(w.find('.sync-status.ok').exists());
});

test('two devices with one code end up with the same progress', async () => {
  // laptop: turn sync on and finish a lesson
  const laptop = await device('/ru/lesson/intro');
  await laptop.router.push('/ru/sync');
  await settle();
  await laptop.w.find('button.sync-enable').trigger('click');
  await settle();
  const code = laptop.w.find('.sync-code').text().replace(/-/g, '');
  await laptop.router.push('/ru/lesson/intro');
  await settle();
  await laptop.w.find('.head-actions .btn').trigger('click');
  await laptop.router.push('/ru/sync');
  await settle();
  await laptop.w.find('button.sync-now').trigger('click'); // sync runs only on request
  await settle();
  const laptopStorage = snapshot();
  laptop.w.unmount();
  mounted = [];

  // phone: open the link from the QR code and join
  switchStorage({});
  const phone = await device(`/ru/sync/${code}`);
  await phone.w.find('button.sync-join').trigger('click');
  await settle();
  await phone.router.push('/ru/lesson/intro');
  await settle();
  assert.match(phone.w.find('.head-actions .btn').text(), /Урок пройден/);
  assert.ok(laptopStorage['quadern-catala']);
});

test('a mistyped code is refused', async () => {
  const { w } = await device('/ru/sync');
  await w.find('button.sync-have-code').trigger('click');
  await w.find('input.sync-code-input').setValue('ABCD-EFGH');
  await w.find('button.sync-join').trigger('click');
  await settle();
  assert.match(w.find('.sync-error').text(), /Код не подходит/);
});

test('sync can be turned off on a device', async () => {
  const { w } = await device('/ru/sync');
  await w.find('button.sync-enable').trigger('click');
  await settle();
  await w.find('button.sync-disable').trigger('click');
  await settle();
  assert.ok(w.find('button.sync-enable').exists());
  assert.equal(localStorage.getItem('quadern-sync'), null);
});

test('sync runs only when asked: no requests after changes, over time or on start', { timeout: 15_000 }, async () => {
  const first = await device('/ru/sync');
  await first.w.find('button.sync-enable').trigger('click');
  await settle();
  const afterEnable = syncRequests();
  assert.ok(afterEnable >= 2, 'enabling syncs once (read + write)');

  // a change and some time pass: nothing goes to the server
  await first.router.push('/ru/lesson/intro');
  await settle();
  await first.w.find('.head-actions .btn').trigger('click');
  await new Promise((r) => setTimeout(r, 2000));
  await settle();
  assert.equal(syncRequests(), afterEnable);
  const saved = Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k) ?? '']));
  first.w.unmount();
  mounted = [];

  // opening the site again with sync on: no requests either, the last sync time is remembered
  for (const [k, v] of Object.entries(saved)) localStorage.setItem(k, v);
  const again = await device('/ru/sync');
  await settle();
  assert.equal(syncRequests(), afterEnable);
  assert.ok(again.w.find('.lesson .sync-status.ok').exists(), 'shows when it last synced');

  // the button syncs once
  await again.w.find('button.sync-now').trigger('click');
  await settle();
  const afterButton = syncRequests();
  assert.ok(afterButton > afterEnable);
  await new Promise((r) => setTimeout(r, 2000));
  await settle();
  assert.equal(syncRequests(), afterButton, 'no follow-up requests after a sync');
});
