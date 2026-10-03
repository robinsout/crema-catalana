// Checks the real lesson catalog and content files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { normalizeCatalog, allLessons, validateCatalog } from '../portal/js/model.js';
import { clipFor } from '../portal/js/say.js';
import { extractSayTexts } from '../scripts/lib/say-texts.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const portal = join(root, 'portal');
const raw = JSON.parse(readFileSync(join(portal, 'lessons.json'), 'utf8'));
const catalog = normalizeCatalog(raw);
// Every id that was ever published. Saved progress refers to these ids, so they may never disappear.
const published = JSON.parse(readFileSync(join(root, 'tests', 'published-ids.json'), 'utf8'));

test('validateCatalog reports broken entries', () => {
  const errors = validateCatalog(normalizeCatalog({
    extras: [{ id: 'a', title: 'A' }, { id: 'a', title: 'dup' }, { title: 'no id' }],
    parts: [{ id: 'p', title: 'P', units: [{ id: 'bad id', unit: 1 }] }],
  }));
  assert.ok(errors.some((e) => e.includes('duplicate id "a"')), errors.join('\n'));
  assert.ok(errors.some((e) => e.includes('missing id')), errors.join('\n'));
  assert.ok(errors.some((e) => e.includes('"bad id"')), errors.join('\n'));
  assert.ok(errors.some((e) => e.includes('missing title')), errors.join('\n'));
});

test('lessons.json is valid', () => {
  assert.deepEqual(validateCatalog(catalog), []);
});

test('every lesson file exists and is a fragment with sections', () => {
  for (const l of allLessons(catalog).filter((x) => x.file)) {
    const path = join(portal, l.file);
    assert.ok(existsSync(path), `${l.id}: ${l.file} not found`);
    const html = readFileSync(path, 'utf8');
    assert.doesNotMatch(html, /<html|<head|<body/i, `${l.file} must be a fragment`);
    assert.match(html, /<section id="[^"]+">\s*<h2>/, `${l.file} needs <section id> with <h2>`);
  }
});

test('every Catalan phrase in a lesson has a recorded clip (run: npm run audio)', () => {
  for (const l of allLessons(catalog).filter((x) => x.file)) {
    const manifestPath = join(portal, 'audio', `${l.id}.json`);
    assert.ok(existsSync(manifestPath), `${l.id}: audio/${l.id}.json missing — run npm run audio`);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const missing = extractSayTexts(readFileSync(join(portal, l.file), 'utf8')).filter((t) => !clipFor(manifest, t));
    assert.deepEqual(missing, [], `${l.id}: phrases without audio — run npm run audio`);
    for (const file of Object.values(manifest.clips)) {
      assert.ok(existsSync(join(portal, 'audio', file)), `${l.id}: audio/${file} missing`);
    }
  }
});

test('every lesson title on the study plan has a recorded clip (run: npm run audio)', () => {
  const manifestPath = join(portal, 'audio', 'pla.json');
  assert.ok(existsSync(manifestPath), 'audio/pla.json missing — run npm run audio');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const missing = allLessons(catalog).map((l) => l.title).filter((t) => !clipFor(manifest, t));
  assert.deepEqual(missing, [], 'titles without audio — run npm run audio');
});

test('published lesson ids are never removed', () => {
  const ids = new Set(allLessons(catalog).map((l) => l.id));
  for (const id of published) assert.ok(ids.has(id), `published id "${id}" disappeared from lessons.json`);
});

test('every lesson with a file is listed as published', () => {
  for (const l of allLessons(catalog).filter((x) => x.file)) {
    assert.ok(published.includes(l.id), `add "${l.id}" to tests/published-ids.json`);
  }
});
