import { test } from 'vitest';
import assert from 'node:assert/strict';
import { checkAnswer, normalizeAnswer, scoreOf, validateExercises, exerciseIds } from '../src/services/exercises.ts';
import type { ExerciseSet } from '../src/types/index.ts';

test('normalizeAnswer ignores case, extra spaces, apostrophe style and final punctuation', () => {
  assert.equal(normalizeAnswer('  Ahir  VAIG anar al mercat. '), 'ahir vaig anar al mercat');
  assert.equal(normalizeAnswer('He d’estudiar!'), "he d'estudiar");
  assert.equal(normalizeAnswer('col.legi'), 'col·legi'); // a dot typed instead of the middle dot
  assert.equal(normalizeAnswer('col·legi'), 'col·legi');
});

test('checkAnswer: any accepted variant is correct', () => {
  assert.equal(checkAnswer('vam sopar amb els amics', ['Vam sopar amb els amics.', 'Vàrem sopar amb els amics.']), 'correct');
  assert.equal(checkAnswer('Vàrem sopar amb els amics', ['Vam sopar amb els amics.', 'Vàrem sopar amb els amics.']), 'correct');
});

test('checkAnswer: only accents differ → "accent"', () => {
  assert.equal(checkAnswer('On es el metro?', ['On és el metro?']), 'accent');
  assert.equal(checkAnswer('dema fara sol', ['Demà farà sol.']), 'accent');
});

test('checkAnswer: anything else is wrong, empty is empty', () => {
  assert.equal(checkAnswer('On està el metro?', ['On és el metro?']), 'wrong');
  assert.equal(checkAnswer('   ', ['és']), 'empty');
});

test('scoreOf counts correct answers out of all items', () => {
  assert.deepEqual(scoreOf(['correct', 'accent', 'wrong', 'correct']), { score: 2, total: 4 });
});

const set: ExerciseSet = {
  tenses: {
    type: 'fill',
    items: [
      { prompt: '<span lang="ca">Ahir (anar) al mercat.</span>', answers: ['Ahir vaig anar al mercat.'] },
      { prompt: 'Сегодня', answers: ['avui'], hint: 'perfet' },
    ],
  },
  which: {
    type: 'choice',
    items: [{ prompt: '<span lang="ca">Avui he menjat.</span>', options: ['perfet', 'imperfet'], answer: 0 }],
  },
};

test('exercise ids are read from the lesson placeholders', () => {
  assert.deepEqual(exerciseIds('<p>x</p><div data-exercise="tenses"></div><div class="a" data-exercise="which"></div>'), ['tenses', 'which']);
});

test('validateExercises: placeholders and data match, items are well formed', () => {
  assert.deepEqual(validateExercises('<div data-exercise="tenses"></div><div data-exercise="which"></div>', set), []);
  const errors = validateExercises('<div data-exercise="tenses"></div><div data-exercise="ghost"></div>', {
    ...set,
    bad: { type: 'fill', items: [{ prompt: '', answers: [] }] },
    worse: { type: 'choice', items: [{ prompt: 'p', options: ['a'], answer: 3 }] },
    odd: { type: 'nope', items: [] } as never,
  }).join('\n');
  assert.match(errors, /"ghost": no exercise data/);
  assert.match(errors, /"which": not placed in the lesson/);
  assert.match(errors, /"bad" item 1: missing prompt/);
  assert.match(errors, /"bad" item 1: no accepted answers/);
  assert.match(errors, /"worse" item 1: needs at least 2 options/);
  assert.match(errors, /"worse" item 1: answer index out of range/);
  assert.match(errors, /"odd": unknown type/);
});
