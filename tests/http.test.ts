import { test, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import { getJson, getText } from '../src/api/http.ts';

afterEach(() => vi.unstubAllGlobals());

// GitHub Pages lets the browser keep files for 10 minutes: without revalidation a fresh
// lesson stays "coming soon" after a deploy. no-cache asks the server (304 if unchanged).
test('course files are revalidated with the server on every load', async () => {
  const calls: (RequestInit | undefined)[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    calls.push(init);
    return new Response('{"a":1}');
  }));
  await getJson('course.json');
  await getText('lesson.html');
  assert.deepEqual(calls.map((c) => c?.cache), ['no-cache', 'no-cache']);
});
