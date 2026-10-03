// Checks the real lesson catalog and content files.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { normalizeCatalog, allLessons, validateCatalog } from '../src/services/catalog.ts';
import { loadCatalog, lessonPath } from '../scripts/lib/catalog.ts';
import { clipFor } from '../src/services/audio.ts';
import type { AudioIndex } from '../src/services/audio.ts';
import type { Course, LocaleCatalog, LocalesIndex } from '../src/types/index.ts';
import { extractSayTexts } from '../scripts/lib/say-texts.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const portal = join(root, 'content');
const locales: LocalesIndex = JSON.parse(readFileSync(join(portal, 'locales', 'index.json'), 'utf8'));
const catalog = loadCatalog(portal, locales.base);
// Every id that was ever published. Saved progress refers to these ids, so they may never disappear.
const published: string[] = JSON.parse(readFileSync(join(root, 'tests', 'published-ids.json'), 'utf8'));

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

test('course.json with every language is valid', () => {
  for (const lang of locales.available) assert.deepEqual(validateCatalog(loadCatalog(portal, lang)), [], lang);
});

test('a lesson file exists exactly when the language marks the lesson as written (date)', () => {
  for (const lang of locales.available) {
    const c = loadCatalog(portal, lang);
    const ids = new Set(allLessons(c).map((l) => l.id));
    const dir = join(portal, 'locales', lang, 'lessons');
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.html')) : [];
    for (const f of files) {
      const id = f.replace(/\.html$/, '');
      assert.ok(ids.has(id), `${lang}: lessons/${f} is not in course.json`);
      assert.ok(allLessons(c).find((l) => l.id === id)?.file, `${lang}: lessons/${f} exists but has no date in catalog.json`);
    }
    for (const l of allLessons(c).filter((x) => x.file)) {
      assert.ok(existsSync(join(portal, lessonPath(lang, l.id))), `${lang}: ${l.id} has a date but no lessons/${l.id}.html`);
    }
  }
});

test('language texts mention only lessons and parts that exist in course.json', () => {
  const course: Course = JSON.parse(readFileSync(join(portal, 'course.json'), 'utf8'));
  const ids = new Set([...course.extras.map((x) => x.id), ...course.parts.flatMap((p) => p.units.map((u) => u.id))]);
  const parts = new Set(course.parts.map((p) => p.id));
  for (const lang of locales.available) {
    const loc: LocaleCatalog = JSON.parse(readFileSync(join(portal, 'locales', lang, 'catalog.json'), 'utf8'));
    for (const id of Object.keys(loc.lessons || {})) assert.ok(ids.has(id), `${lang}: unknown lesson "${id}"`);
    for (const id of Object.keys(loc.parts || {})) assert.ok(parts.has(id), `${lang}: unknown part "${id}"`);
  }
});

test('every lesson file exists and is a fragment with sections', () => {
  for (const l of allLessons(catalog).filter((x) => x.file)) {
    const path = join(portal, l.file ?? '');
    assert.ok(existsSync(path), `${l.id}: ${l.file} not found`);
    const html = readFileSync(path, 'utf8');
    assert.doesNotMatch(html, /<html|<head|<body/i, `${l.file} must be a fragment`);
    assert.match(html, /<section id="[^"]+">\s*<h2>/, `${l.file} needs <section id> with <h2>`);
  }
});

// Shared audio store: audio/index.json maps a phrase to clips/<hash>.mp3, one file per phrase.
const audioDir = join(portal, 'audio');
const audioIndex: AudioIndex | null = existsSync(join(audioDir, 'index.json')) ? JSON.parse(readFileSync(join(audioDir, 'index.json'), 'utf8')) : null;

test('audio index exists (run: npm run audio)', () => {
  assert.ok(audioIndex, 'audio/index.json missing — run npm run audio');
});

test('every Catalan phrase in a lesson has a recorded clip (run: npm run audio)', () => {
  for (const l of allLessons(catalog).filter((x) => x.file)) {
    const missing = extractSayTexts(readFileSync(join(portal, l.file ?? ''), 'utf8')).filter((t) => !clipFor(audioIndex, t));
    assert.deepEqual(missing, [], `${l.id}: phrases without audio — run npm run audio`);
  }
});

test('every lesson title on the study plan has a recorded clip (run: npm run audio)', () => {
  const missing = allLessons(catalog).map((l) => l.title).filter((t) => !clipFor(audioIndex, t));
  assert.deepEqual(missing, [], 'titles without audio — run npm run audio');
});

test('audio store holds each phrase once: every clip file exists and nothing is orphaned', () => {
  const files = Object.values(audioIndex?.clips ?? {});
  assert.equal(new Set(files).size, files.length, 'two phrases share one clip file');
  for (const f of files) assert.ok(existsSync(join(audioDir, f)), `audio/${f} missing`);
  const onDisk = readdirSync(join(audioDir, 'clips')).filter((f) => f.endsWith('.mp3')).map((f) => `clips/${f}`);
  const orphans = onDisk.filter((f) => !files.includes(f));
  assert.deepEqual(orphans, [], 'clips not in audio/index.json — run npm run audio');
  assert.deepEqual(readdirSync(audioDir).sort(), ['clips', 'index.json'], 'audio/ must contain only index.json and clips/');
});

test('published lesson ids are never removed', () => {
  const ids = new Set(allLessons(catalog).map((l) => l.id));
  for (const id of published) assert.ok(ids.has(id), `published id "${id}" disappeared from course.json`);
});

test('every lesson with a file is listed as published', () => {
  for (const l of allLessons(catalog).filter((x) => x.file)) {
    assert.ok(published.includes(l.id), `add "${l.id}" to tests/published-ids.json`);
  }
});
