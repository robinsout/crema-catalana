// Coverage of lessons by languages (BACKLOG F-4 part 2): an adaptation names the version of its
// source; when the source changes later, the adaptation is reported as outdated.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fingerprint, readStamp, withStamp, lessonStatus, coverageTable } from '../scripts/lib/coverage.ts';
import { loadLocales } from '../scripts/lib/catalog.ts';

const source = '<section id="a"><h2>A</h2></section>\n';

test('fingerprint: short, stable, changes with the text', () => {
  assert.match(fingerprint(source), /^[0-9a-f]{12}$/);
  assert.equal(fingerprint(source), fingerprint(source));
  assert.notEqual(fingerprint(source), fingerprint(source.replace('A</h2>', 'B</h2>')));
});

test('a stamp is the first line of an adaptation, and replacing it keeps the rest', () => {
  const adapted = withStamp('<section id="a"><h2>A (en)</h2></section>\n', 'ru', source);
  assert.ok(adapted.startsWith(`<!-- source: ru@${fingerprint(source)} -->\n`));
  assert.deepEqual(readStamp(adapted), { lang: 'ru', hash: fingerprint(source) });
  assert.equal(withStamp(adapted, 'ru', 'new'), withStamp('<section id="a"><h2>A (en)</h2></section>\n', 'ru', 'new'));
  assert.equal(readStamp(source), null);
});

test('status of a lesson in a language', () => {
  const fresh = withStamp('<p>en</p>', 'ru', source);
  assert.equal(lessonStatus({ html: null, source }), 'missing');
  assert.equal(lessonStatus({ html: source, source: null }), 'ready'); // the original
  assert.equal(lessonStatus({ html: fresh, source }), 'ready');
  assert.equal(lessonStatus({ html: fresh, source: source + '<p>more</p>' }), 'outdated');
  assert.equal(lessonStatus({ html: '<p>no stamp</p>', source }), 'outdated');
});

test('the real course: a row per lesson, a column per language, the base language complete where written', () => {
  const locales = loadLocales('content');
  const table = coverageTable('content');
  assert.deepEqual(table.languages, [locales.base, ...(locales.available.concat(locales.drafts ?? [])).filter((l) => l !== locales.base)]);
  const intro = table.rows.find((r) => r.id === 'intro');
  assert.equal(intro?.status[locales.base], 'ready');
  assert.equal(table.rows.find((r) => r.id === 'b3-09')?.status[locales.base], 'missing');
});

test('every adaptation names its source (npm run adapt writes the stamp)', () => {
  const { rows, languages } = coverageTable('content');
  const base = languages[0]!;
  for (const row of rows) {
    for (const lang of languages.slice(1)) {
      const file = row.files[lang];
      if (!file || !row.files[base]) continue;
      assert.ok(readStamp(readFileSync(file, 'utf8')), `${lang}/${row.id}: no "<!-- source: … -->" line`);
    }
  }
});
