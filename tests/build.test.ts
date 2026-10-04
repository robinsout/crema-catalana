import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('vite builds a standalone site with all course data', { timeout: 60_000 }, async () => {
  const out = mkdtempSync(join(tmpdir(), 'quadern-'));
  try {
    await build({ root, logLevel: 'silent', build: { outDir: out, emptyOutDir: true } });
    const index = readFileSync(join(out, 'index.html'), 'utf8');
    assert.match(index, /^<!doctype html>/i);
    assert.match(index, /<title>Quadern de català<\/title>/);
    assert.match(index, /<script type="module"[^>]*src="\.\/assets\/[^"]+\.js"/, 'relative asset paths for GitHub Pages');
    assert.match(index, /<link rel="icon" type="image\/svg\+xml" href="favicon\.svg">/);
    assert.match(index, /<link rel="icon" type="image\/png" sizes="32x32" href="favicon-32\.png">/);
    assert.match(index, /<link rel="apple-touch-icon" href="apple-touch-icon\.png">/);
    const csp = index.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1]?.replaceAll('&#39;', "'");
    assert.ok(csp, 'Content-Security-Policy meta tag');
    assert.match(csp, /script-src 'self'/);
    assert.match(csp, /connect-src 'self' https:\/\/188\.245\.182\.47/);
    assert.ok(index.indexOf('Content-Security-Policy') < index.indexOf('<script'), 'the policy comes before any script');
    for (const f of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'course.json', 'locales/index.json', 'locales/ru/ui.json', 'locales/ru/catalog.json', 'locales/ru/lessons/intro.html', 'audio/index.json']) {
      assert.ok(existsSync(join(out, f)), `${f} missing in build`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
