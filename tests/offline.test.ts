// The page side of the service worker (BACKLOG I-6): registration in the built site only, and the
// "site updated" notice when a new version arrives while a page is open.
import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppRouter } from '../src/router.ts';
import { useUpdateStore } from '../src/stores/update.ts';
import { SW_UPDATED } from '../shared/sw-api.ts';
import { stubSite } from './helpers.ts';

// navigator.serviceWorker of a page controlled (or not yet) by a worker
function fakeWorkers(controlled: boolean) {
  const target = new EventTarget();
  const sw = Object.assign(target, {
    controller: controlled ? {} : null,
    register: vi.fn(async () => ({})),
  });
  Object.defineProperty(window.navigator, 'serviceWorker', { value: sw, configurable: true });
  return { sw, send: (data: unknown) => target.dispatchEvent(new MessageEvent('message', { data })) };
}

let wrapper: VueWrapper | null = null;
beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); });
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window.navigator, 'serviceWorker');
});

test('the worker is registered from the site folder, once', () => {
  const { sw } = fakeWorkers(false);
  const update = useUpdateStore();
  update.start();
  update.start();
  assert.deepEqual(sw.register.mock.calls, [['./sw.js']]);
});

test('a new version while the page is open offers a reload', () => {
  const { send } = fakeWorkers(true);
  const update = useUpdateStore();
  update.start();
  send({ type: 'other' });
  assert.equal(update.available, false);
  send({ type: SW_UPDATED });
  assert.equal(update.available, true);
});

test('the first install is not an update: no notice', () => {
  const { send } = fakeWorkers(false);
  const update = useUpdateStore();
  update.start();
  send({ type: SW_UPDATED });
  assert.equal(update.available, false);
});

test('a browser without service workers works as before', () => {
  assert.doesNotThrow(() => useUpdateStore().start());
  assert.equal(useUpdateStore().available, false);
});

test('the notice says the site was updated and reloads the page on request', async () => {
  stubSite({ 'locales/ru/ui.json': JSON.parse(readFileSync('content/locales/ru/ui.json', 'utf8')) });
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  await router.push('/ru/plan');
  await router.isReady();
  wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await flushPromises();
  assert.ok(!wrapper.find('.update-notice').exists());
  const update = useUpdateStore();
  const reload = vi.spyOn(update, 'reload').mockImplementation(() => {});
  update.available = true;
  await flushPromises();
  const notice = wrapper.find('.update-notice');
  assert.ok(notice.exists());
  assert.equal(notice.attributes('role'), 'status');
  assert.match(notice.text(), /обновился/);
  await notice.find('button').trigger('click');
  assert.equal(reload.mock.calls.length, 1);
});

test('the site registers the worker only when built, not in development or tests', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  assert.match(main, /if \(import\.meta\.env\.PROD\)[^\n]*start\(\)/);
});
