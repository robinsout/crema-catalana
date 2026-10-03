import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { createAppRouter, legacyHashToPath, scrollFor } from '../src/router.ts';
import { useProgressStore } from '../src/stores/progress.ts';
import { stubSite, saveProgress } from './helpers.ts';

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  stubSite();
});
afterEach(() => vi.unstubAllGlobals());

async function open(path: string): Promise<string> {
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  return router.currentRoute.value.fullPath;
}

test('old links of the form #id become router paths', () => {
  assert.equal(legacyHashToPath('#b1-04'), '/b1-04');
  assert.equal(legacyHashToPath('#intro'), '/intro');
  assert.equal(legacyHashToPath('#pla'), '/pla');
  assert.equal(legacyHashToPath('#/ru/plan'), null);
  assert.equal(legacyHashToPath(''), null);
  assert.equal(legacyHashToPath('#'), null);
});

test('first visit opens the study plan', async () => {
  assert.equal(await open('/'), '/ru/plan');
});

test('without a link the last opened view comes back', async () => {
  saveProgress('{"done":{},"last":"x-temps"}');
  assert.equal(await open('/'), '/ru/lesson/x-temps');
});

test('the last view saved as v1 id l01 opens the intro', async () => {
  saveProgress('{"done":{"l01":true},"last":"l01"}');
  assert.equal(await open('/'), '/ru/lesson/intro');
});

test('the last view "pla" opens the plan', async () => {
  saveProgress('{"done":{},"last":"pla"}');
  assert.equal(await open('/'), '/ru/plan');
});

test('old links keep working', async () => {
  assert.equal(await open('/intro'), '/ru/lesson/intro');
  assert.equal(await open('/l01'), '/ru/lesson/intro');
  assert.equal(await open('/b1-01'), '/ru/lesson/b1-01');
  assert.equal(await open('/pla'), '/ru/plan');
});

test('a unit without a lesson opens the plan focused on it', async () => {
  assert.equal(await open('/b1-02'), '/ru/plan/b1-02');
  assert.equal(await open('/ru/lesson/b1-02'), '/ru/plan/b1-02');
});

test('unknown lessons and paths open the plan', async () => {
  assert.equal(await open('/nope'), '/ru/plan');
  assert.equal(await open('/ru/lesson/nope'), '/ru/plan');
  assert.equal(await open('/a/b/c/d'), '/ru/plan');
});

test('an unknown language falls back to the default one', async () => {
  assert.equal(await open('/xx/lesson/intro'), '/ru/lesson/intro');
  assert.equal(await open('/xx/plan'), '/ru/plan');
});

test('opening a view remembers it as the last one', async () => {
  await open('/ru/lesson/b1-01');
  assert.equal(useProgressStore().last, 'b1-01');
  await open('/ru/plan');
  assert.equal(useProgressStore().last, 'pla');
});

test('scrolling: the plan scrolls to a focused unit itself, other pages start at the top', () => {
  assert.equal(scrollFor({ name: 'plan', path: '/ru/plan/b1-02', params: { focus: 'b1-02' } }, { path: '/ru/plan' }), false);
  assert.deepEqual(scrollFor({ name: 'lesson', path: '/ru/lesson/intro', params: { id: 'intro' } }, { path: '/ru/plan' }), { top: 0 });
  assert.equal(scrollFor({ name: 'lesson', path: '/ru/lesson/intro', params: { id: 'intro' } }, { path: '/ru/lesson/intro' }), false);
});
