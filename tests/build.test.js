import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../scripts/build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('build produces a standalone site for GitHub Pages', () => {
  const out = mkdtempSync(join(tmpdir(), 'quadern-'));
  try {
    build({ src: join(root, 'portal'), out });
    const index = readFileSync(join(out, 'index.html'), 'utf8');
    assert.match(index, /^<!doctype html>/i);
    assert.match(index, /<meta charset="utf-8">/);
    assert.match(index, /<meta name="viewport"/);
    assert.match(index, /<title>Quadern de català<\/title>/);
    assert.equal((index.match(/<body>/g) || []).length, 1);
    assert.equal(existsSync(join(out, 'lessons.json')), false, 'old lessons.json must be gone');
    for (const f of ['course.json', 'locales/index.json', 'locales/ru/ui.json', 'locales/ru/catalog.json', 'locales/ru/lessons/intro.html', 'js/app.js', 'js/model.js', 'js/storage.js', 'js/say.js', 'js/i18n.js', 'audio/index.json', '.nojekyll']) {
      assert.ok(existsSync(join(out, f)), `${f} missing in build`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
