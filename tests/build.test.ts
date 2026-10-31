import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { readManifest } from '../scripts/lib/sw.ts';

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
    // the service worker (BACKLOG I-6): one script with the manifest of this build
    const sw = readFileSync(join(out, 'sw.js'), 'utf8');
    assert.ok(!/^\s*(import|export)\s/m.test(sw), 'a classic script: module workers are not everywhere');
    const m = readManifest(sw);
    assert.ok(m, 'the manifest is in sw.js');
    assert.match(m.version, /^[0-9a-f]{12}$/);
    const entry = index.match(/src="\.\/(assets\/[^"]+\.js)"/)?.[1] ?? '';
    assert.ok(m.shell.includes(entry), 'the entry code is kept on install');
    assert.ok(m.shell.every((f) => /^assets\/.+\.(js|css)$/.test(f)), 'only code in the shell, fonts when used');
    assert.ok(m.assets.some((f) => f.endsWith('.woff2')));
    for (const f of [...m.shell, ...m.assets, ...m.data]) assert.ok(existsSync(join(out, f)), `${f} of the manifest is in the build`);
    assert.ok(m.data.includes('course.json') && m.data.includes('locales/ru/catalog.json'));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
