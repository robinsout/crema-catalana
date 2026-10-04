// Lesson checks for writing and adapting lessons (BACKLOG F-4): markup rules, and an adaptation
// keeping the chapters and exercises of its source (progress is saved under their ids).
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { compareOutlines, cyrillicLeftovers, lessonOutline, lintLesson } from '../scripts/lib/lesson-check.ts';

const lesson = (body: string): string => `<section id="a"><h2>1. A</h2>${body}</section>`;

test('a well-formed lesson has no problems', () => {
  assert.deepEqual(lintLesson(lesson('<p><span lang="ca">Bon dia</span> — добрый день</p><table lang="ca"><tr><td>u</td></tr></table>')), []);
});

test('lint: Catalan text must not contain Russian explanations', () => {
  const problems = lintLesson(lesson('<p lang="ca">Bon dia — добрый день</p>'));
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /Bon dia — добрый день/);
});

test('lint: in a Catalan table only the voiced cells count, headers may be Russian', () => {
  assert.deepEqual(lintLesson(lesson('<table lang="ca"><tr><th>Глагол</th></tr><tr><td>beure</td></tr></table>')), []);
  assert.equal(lintLesson(lesson('<table lang="ca"><tr><td>beure (пить)</td></tr></table>')).length, 1);
});

test('lint: no lang="ca" inside lang="ca"', () => {
  const problems = lintLesson(lesson('<p lang="ca">Diu <span lang="ca">hola</span></p>'));
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /nested/);
});

test('lint: every section has an id and a heading', () => {
  assert.equal(lintLesson('<section><h2>A</h2></section>').length, 1);
  assert.equal(lintLesson('<section id="a"><p>no heading</p></section>').length, 1);
});

test('outline: chapters in order and exercises', () => {
  const html = '<section id="a"><h2>A</h2><div data-exercise="x"></div></section><section id="b"><h2>B</h2></section>';
  assert.deepEqual(lessonOutline(html), { sections: ['a', 'b'], exercises: ['x'] });
});

test('an adaptation keeps the chapters (same order) and the exercises of its source', () => {
  const source = { sections: ['a', 'b'], exercises: ['x', 'y'] };
  assert.deepEqual(compareOutlines(source, { sections: ['a', 'b'], exercises: ['y', 'x'] }), []);
  const problems = compareOutlines(source, { sections: ['b', 'a', 'c'], exercises: ['x'] });
  assert.ok(problems.some((p) => p.includes('chapters')), problems.join('\n'));
  assert.ok(problems.some((p) => p.includes('exercises')), problems.join('\n'));
});

test('leftovers: Russian text left in a language without Cyrillic', () => {
  assert.deepEqual(cyrillicLeftovers('<p>Hello <span lang="ca">hola</span></p>', 'en'), []);
  assert.deepEqual(cyrillicLeftovers('<p>Hello, как дела</p>', 'en'), ['как дела']);
  assert.deepEqual(cyrillicLeftovers('<p>Привет</p>', 'ru'), [], 'Russian is fine in Russian');
  assert.deepEqual(cyrillicLeftovers({ a: { tr: 'день' } }, 'es'), ['день']);
});
