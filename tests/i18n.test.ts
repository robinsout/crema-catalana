import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createT } from '../src/services/i18n.ts';
import type { LocalesIndex } from '../src/types/index.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const portal = join(root, 'content');
// all page sources: index.html and everything under src/
const sources = (): string[] => [
  join(root, 'index.html'),
  ...readdirSync(join(root, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.(ts|js|vue)$/.test(f))
    .map((f) => join(root, 'src', f)),
];
const locales: LocalesIndex = JSON.parse(readFileSync(join(portal, 'locales', 'index.json'), 'utf8'));
const ui = (lang: string): Record<string, string> => JSON.parse(readFileSync(join(portal, 'locales', lang, 'ui.json'), 'utf8'));

test('t returns the string and fills {placeholders}', () => {
  const t = createT({ hello: 'Hola, {name}!', plain: 'Adéu' });
  assert.equal(t('hello', { name: 'Àlex' }), 'Hola, Àlex!');
  assert.equal(t('plain'), 'Adéu');
});

test('t falls back to the key when a string is missing', () => {
  const t = createT({});
  assert.equal(t('nav.plan'), 'nav.plan');
});

test('t leaves unknown placeholders visible', () => {
  assert.equal(createT({ a: '{x} and {y}' })('a', { x: 1 }), '1 and {y}');
});

test('locales/index.json lists the default and available languages', () => {
  assert.ok(locales.available.includes(locales.default));
  for (const lang of locales.available) assert.match(lang, /^[a-z]{2}$/);
});

test('every string the page uses exists in the base language, and none is unused', () => {
  const src = sources().map((f) => readFileSync(f, 'utf8')).join('\n');
  const used = new Set([
    ...[...src.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)].map((m) => m[1] ?? ''),
    ...[...src.matchAll(/data-i18n(?:-[a-z]+)?="([a-zA-Z0-9_.]+)"/g)].map((m) => m[1] ?? ''),
  ]);
  const base = ui(locales.base);
  const keys = Object.keys(base).filter((k) => !k.startsWith('_'));
  assert.deepEqual([...used].filter((k) => !(k in base)).sort(), [], `missing in ${locales.base}/ui.json`);
  assert.deepEqual(keys.filter((k) => !used.has(k)).sort(), [], `unused keys in ${locales.base}/ui.json`);
});

test('every available language has exactly the keys of the base language', () => {
  const baseKeys = Object.keys(ui(locales.base)).sort();
  for (const lang of locales.available) {
    assert.deepEqual(Object.keys(ui(lang)).sort(), baseKeys, `${lang}/ui.json keys differ from ${locales.base}`);
  }
});

test('every language folder is listed as available', () => {
  const dirs = readdirSync(join(portal, 'locales'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  assert.deepEqual(dirs.sort(), [...locales.available].sort());
});
