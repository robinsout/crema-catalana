// Usability audit (BACKLOG U-1) and progress inside a lesson (F-3).
import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppRouter } from '../src/router.ts';
import { useTocStore } from '../src/stores/toc.ts';
import { STORAGE_KEY } from '../src/services/progress.ts';
import { stubSite, saveProgress } from './helpers.ts';

let wrapper: VueWrapper | null = null;
let scrolled: string[] = [];

beforeEach(() => {
  localStorage.clear();
  stubSite();
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  scrolled = [];
  window.HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) { scrolled.push(this.id); };
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
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

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');

// ---------- chapters of a lesson ----------

test('every chapter of a lesson ends with a button that marks it as studied', async () => {
  const { w } = await openApp('/ru/lesson/intro');
  const ends = w.findAll('article.lesson section .section-end button');
  assert.equal(ends.length, 3);
  assert.equal(w.find('#s2 .section-end button').attributes('aria-pressed'), 'false');
  await w.find('#s2 .section-end button').trigger('click');
  assert.equal(w.find('#s2 .section-end button').attributes('aria-pressed'), 'true');
  assert.equal(stored().sections['intro/s2'].done, true);
  // the table of contents shows the studied chapter
  const items = w.findAll('.toc li');
  assert.deepEqual(items.map((li) => li.classes().includes('is-done')), [false, true, false]);
});

test('chapter marks of another lesson do not leak into this one', async () => {
  saveProgress(JSON.stringify({ done: {}, sections: { 'x-temps/s1': { done: true, at: 1 } } }));
  const { w } = await openApp('/ru/lesson/intro');
  assert.equal(w.find('#s1 .section-end button').attributes('aria-pressed'), 'false');
});

test('a chapter read for a few seconds becomes the reading point of the lesson', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  await openApp('/ru/lesson/intro');
  const toc = useTocStore();
  toc.active = 's3';
  await flushPromises();
  vi.advanceTimersByTime(1000);
  toc.active = 's2'; // scrolled past s3 quickly: not counted
  await flushPromises();
  vi.advanceTimersByTime(3000);
  assert.equal(stored().reading.intro.section, 's2');
});

test('a lesson opened again offers to continue from the reading point', async () => {
  saveProgress(JSON.stringify({ done: {}, reading: { intro: { section: 's3', at: 1 } } }));
  const { w } = await openApp('/ru/lesson/intro');
  const resume = w.find('.resume');
  assert.ok(resume.exists());
  assert.match(resume.text(), /Третий раздел/);
  await resume.find('button').trigger('click');
  assert.ok(scrolled.includes('s3'));
});

test('no offer to continue at the first chapter, in a finished lesson or for a chapter that is gone', async () => {
  for (const saved of [
    { done: {}, reading: { intro: { section: 's1', at: 1 } } },
    { done: { intro: true }, reading: { intro: { section: 's3', at: 1 } } },
    { done: {}, reading: { intro: { section: 'gone', at: 1 } } },
  ]) {
    localStorage.clear();
    saveProgress(JSON.stringify(saved));
    const { w } = await openApp('/ru/lesson/intro');
    assert.equal(w.find('.resume').exists(), false, JSON.stringify(saved));
    wrapper?.unmount();
    wrapper = null;
  }
});

// ---------- the end of a lesson ----------

test('a lesson can be marked as done at its end too', async () => {
  const { w } = await openApp('/ru/lesson/intro');
  const end = w.find('.lesson-end button');
  assert.ok(end.exists());
  await end.trigger('click');
  assert.equal(stored().done.intro, true);
  assert.match(w.find('.head-actions .btn').text(), /Урок пройден/);
});

// ---------- navigation ----------

test('a skip link moves the focus to the content', async () => {
  const { w } = await openApp('/ru/lesson/intro');
  const skip = w.find('a.skip-link');
  assert.ok(skip.exists());
  assert.ok(skip.element === document.querySelector('.app')?.firstElementChild, 'the first thing to tab to');
  await skip.trigger('click');
  assert.equal(document.activeElement?.id, 'main');
});

test('the browser tab names the page', async () => {
  const { router } = await openApp('/ru/lesson/x-temps');
  assert.equal(document.title, 'Els temps · Quadern de català');
  await router.push('/ru/plan');
  await flushPromises();
  assert.equal(document.title, 'nav.plan · Quadern de català');
});

test('narrow screens: the chapters open from a button in the header and close after a jump', async () => {
  const { w } = await openApp('/ru/lesson/intro');
  const toggle = w.find('.toc-toggle');
  assert.ok(toggle.exists());
  assert.equal(w.find('.toc-panel').exists(), false);
  await toggle.trigger('click');
  const panel = w.find('.toc-panel');
  assert.ok(panel.exists());
  assert.equal(panel.findAll('li').length, 3);
  await panel.findAll('a')[2]?.trigger('click');
  assert.ok(scrolled.includes('s3'));
  assert.equal(w.find('.toc-panel').exists(), false);
});

test('the chapters button is only on lesson pages', async () => {
  const { w } = await openApp('/ru/plan');
  assert.equal(w.find('.toc-toggle').exists(), false);
});

test('a lesson tells that Catalan phrases can be heard', async () => {
  const { w } = await openApp('/ru/lesson/intro');
  assert.ok(w.find('.lesson-head .say-tip').exists());
});

// ---------- the plan ----------

test('the plan offers to continue the last opened lesson', async () => {
  saveProgress(JSON.stringify({ done: {}, last: 'x-temps' }));
  const { w } = await openApp('/ru/plan');
  const go = w.find('.continue a');
  assert.ok(go.exists());
  assert.match(go.text(), /Els temps/);
  assert.equal(go.attributes('href'), '/ru/lesson/x-temps');
});

test('without a last lesson the plan suggests the first ready lesson not done yet', async () => {
  saveProgress(JSON.stringify({ done: { intro: true }, last: null }));
  const { w } = await openApp('/ru/plan');
  assert.match(w.find('.continue a').text(), /Els temps/);
});

test('units without a lesson are folded in the plan, the focused one is open', async () => {
  const { w } = await openApp('/ru/plan/b1-02');
  assert.equal(w.find('#u-b1-01 details').exists(), false, 'a ready unit is shown in full');
  const focused = w.find('#u-b1-02 details');
  assert.ok(focused.exists());
  assert.equal((focused.element as HTMLDetailsElement).open, true);
  wrapper?.unmount();
  wrapper = null;
  const { w: plain } = await openApp('/ru/plan');
  assert.equal((plain.find('#u-b1-02 details').element as HTMLDetailsElement).open, false);
});

// ---------- sync ----------

test('the sync page explains the setup in three steps', async () => {
  const { w } = await openApp('/ru/sync');
  assert.equal(w.findAll('.sync-steps li').length, 3);
});
