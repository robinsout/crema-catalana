// Content-Security-Policy of the site (set by a <meta> tag: GitHub Pages cannot send headers).
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { contentSecurityPolicy } from '../scripts/lib/csp.ts';
import { DEFAULT_SYNC_URL } from '../shared/sync-api.ts';

const directives = (csp: string) =>
  Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).map(([name, ...values]) => [name, values]));

test('scripts, fonts and media come only from the site itself', () => {
  const d = directives(contentSecurityPolicy(DEFAULT_SYNC_URL));
  assert.deepEqual(d['default-src'], ["'self'"]);
  assert.deepEqual(d['script-src'], ["'self'"]);
  assert.deepEqual(d['font-src'], ["'self'"]);
  assert.deepEqual(d['media-src'], ["'self'"]);
  assert.deepEqual(d['object-src'], ["'none'"]);
  assert.deepEqual(d['base-uri'], ["'self'"]);
  assert.deepEqual(d['form-action'], ["'none'"]);
});

test('requests go only to the site and the sync server it was built for', () => {
  assert.deepEqual(directives(contentSecurityPolicy('https://188.245.182.47'))['connect-src'], ["'self'", 'https://188.245.182.47']);
  assert.deepEqual(directives(contentSecurityPolicy('http://localhost:8787/'))['connect-src'], ["'self'", 'http://localhost:8787']);
});
