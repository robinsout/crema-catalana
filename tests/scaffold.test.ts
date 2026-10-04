// Scaffolding for content work (BACKLOG F-4 part 3): a new language as a draft, a new lesson,
// an adaptation of a lesson, and registering published ids. Runs on a copy of the content.
// @vitest-environment node
import { test, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { adaptLesson, newLanguage, newLesson, publishLanguage, registerPublished } from '../scripts/lib/scaffold.ts';
import { readStamp, fingerprint } from '../scripts/lib/coverage.ts';

let root = '';
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const json = (path: string) => JSON.parse(read(path));
const TODAY = '2026-10-04';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'quadern-'));
  cpSync('content', join(root, 'content'), { recursive: true, filter: (src) => !src.includes('/audio/clips') });
  cpSync('tests/published-ids.json', join(root, 'tests/published-ids.json'));
  cpSync('tests/published-sections.json', join(root, 'tests/published-sections.json'));
  cpSync('authoring', join(root, 'authoring'), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

test('a new language starts as a draft: interface and plan to translate, a profile to fill', () => {
  newLanguage(root, 'xx', 'Xish');
  const index = json('content/locales/index.json');
  assert.ok(index.drafts.includes('xx'));
  assert.equal(index.names.xx, 'Xish');
  assert.ok(!index.available.includes('xx'));
  assert.deepEqual(Object.keys(json('content/locales/xx/ui.json')), Object.keys(json('content/locales/ru/ui.json')));
  const catalog = json('content/locales/xx/catalog.json');
  assert.ok(catalog.lessons['b1-01'].topic, 'plan texts are there to translate');
  assert.ok(Object.values(catalog.lessons).every((l: any) => !l.date), 'no lesson is written yet');
  assert.match(read('authoring/profiles/xx.md'), /Xish/);
  assert.throws(() => newLanguage(root, 'xx', 'Xish'), /exists/);
  assert.throws(() => newLanguage(root, 'EN!', 'x'), /code/);
});

test('publishing a draft moves it to the available languages', () => {
  newLanguage(root, 'xx', 'Xish');
  // translated: no Russian left in the interface and the plan
  writeFileSync(join(root, 'content/locales/xx/ui.json'), JSON.stringify(Object.fromEntries(Object.keys(json('content/locales/xx/ui.json')).map((k) => [k, 'text']))));
  writeFileSync(join(root, 'content/locales/xx/catalog.json'), '{}');
  publishLanguage(root, 'xx');
  const index = json('content/locales/index.json');
  assert.ok(index.available.includes('xx'));
  assert.ok(!index.drafts?.includes('xx'));
  assert.throws(() => publishLanguage(root, 'it'), /not a draft/);
});

test('a new topic lesson: course entry, catalog texts and date, a file with a chapter', () => {
  const file = newLesson(root, { id: 'x-pronoms', kind: 'topic', title: 'Els pronoms febles', related: ['b2-03'], today: TODAY });
  const course = json('content/course.json');
  const entry = course.extras.find((e: any) => e.id === 'x-pronoms');
  assert.deepEqual(entry, { id: 'x-pronoms', kind: 'topic', title: 'Els pronoms febles', related: ['b2-03'] });
  assert.equal(json('content/locales/ru/catalog.json').lessons['x-pronoms'].date, TODAY);
  assert.equal(file, join(root, 'content/locales/ru/lessons/x-pronoms.html'));
  assert.match(read('content/locales/ru/lessons/x-pronoms.html'), /<section id="[a-z-]+">\s*<h2>/);
  assert.throws(() => newLesson(root, { id: 'x-pronoms', kind: 'topic', title: 'x', today: TODAY }), /exists/);
});

test('a lesson for a unit: the unit is already in the course, only the file and the date are added', () => {
  const before = read('content/course.json');
  newLesson(root, { id: 'b1-02', today: TODAY });
  assert.equal(read('content/course.json'), before);
  const texts = json('content/locales/ru/catalog.json').lessons['b1-02'];
  assert.equal(texts.date, TODAY);
  assert.ok(texts.topic, 'the unit plan stays');
  assert.throws(() => newLesson(root, { id: 'x-new', today: TODAY }), /kind and title/);
});

test('an adaptation: the source lesson with a stamp, exercises and vocabulary to translate, the date', () => {
  newLanguage(root, 'xx', 'Xish');
  adaptLesson(root, { id: 'x-temps-verbals', lang: 'xx', today: TODAY });
  const source = read('content/locales/ru/lessons/x-temps-verbals.html');
  const adapted = read('content/locales/xx/lessons/x-temps-verbals.html');
  assert.deepEqual(readStamp(adapted), { lang: 'ru', hash: fingerprint(source) });
  assert.ok(existsSync(join(root, 'content/locales/xx/exercises/x-temps-verbals.json')));
  assert.ok(existsSync(join(root, 'content/locales/xx/vocab/x-temps-verbals.json')));
  const texts = json('content/locales/xx/catalog.json').lessons['x-temps-verbals'];
  assert.equal(texts.date, TODAY);
  assert.throws(() => adaptLesson(root, { id: 'x-temps-verbals', lang: 'xx', today: TODAY }), /exists/);
  assert.throws(() => adaptLesson(root, { id: 'b1-02', lang: 'xx', today: TODAY }), /not written/);
});

test('re-stamping an adaptation after review keeps its text', () => {
  newLanguage(root, 'xx', 'Xish');
  adaptLesson(root, { id: 'intro', lang: 'xx', today: TODAY });
  const path = join(root, 'content/locales/xx/lessons/intro.html');
  writeFileSync(path, read('content/locales/xx/lessons/intro.html').replace('<h2>', '<h2>EN '));
  writeFileSync(join(root, 'content/locales/ru/lessons/intro.html'), read('content/locales/ru/lessons/intro.html') + '\n<!-- changed -->\n');
  adaptLesson(root, { id: 'intro', lang: 'xx', today: TODAY, restamp: true });
  const adapted = readFileSync(path, 'utf8');
  assert.ok(adapted.includes('<h2>EN '));
  assert.equal(readStamp(adapted)?.hash, fingerprint(read('content/locales/ru/lessons/intro.html')));
});

test('registering adds new lesson and chapter ids to the published lists and keeps the old ones', () => {
  newLesson(root, { id: 'x-pronoms', kind: 'topic', title: 'Els pronoms febles', today: TODAY });
  writeFileSync(join(root, 'content/locales/ru/lessons/x-pronoms.html'), '<section id="en-hi"><h2>En i hi</h2></section>\n');
  const added = registerPublished(root);
  assert.deepEqual(added, ['x-pronoms', 'x-pronoms/en-hi']);
  assert.ok(json('tests/published-ids.json').includes('x-pronoms'));
  assert.deepEqual(json('tests/published-sections.json')['x-pronoms'], ['en-hi']);
  assert.deepEqual(registerPublished(root), [], 'nothing new the second time');
});

test('a language with Russian text left in its interface or plan is not published', () => {
  newLanguage(root, 'xx', 'Xish');
  assert.throws(() => publishLanguage(root, 'xx'), /Russian text left/);
});
