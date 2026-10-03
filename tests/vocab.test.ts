import { test } from 'vitest';
import assert from 'node:assert/strict';
import { buildVocab, validateVocab } from '../src/services/vocab.ts';
import type { LocaleVocab, VocabSource } from '../src/types/index.ts';

const ca: VocabSource = {
  groups: [
    { id: 'dies', words: [
      { id: 'dilluns', ca: 'el dilluns', gender: 'm' },
      { id: 'dimarts', ca: 'el dimarts', gender: 'm' },
    ] },
    { id: 'estacions', words: [
      { id: 'estiu', ca: "l'estiu", gender: 'm' },
      { id: 'tardor', ca: 'la tardor', gender: 'f', plural: 'les tardors' },
    ] },
  ],
};

const ru: LocaleVocab = {
  groups: { dies: 'Дни недели', estacions: 'Времена года' },
  words: {
    dilluns: { tr: 'понедельник' },
    dimarts: { tr: 'вторник' },
    estiu: { tr: 'лето' },
    tardor: { tr: 'осень', note: 'не похоже на otoño' },
  },
};

test('buildVocab merges Catalan words with translations, keeping the order', () => {
  const v = buildVocab(ca, ru);
  assert.deepEqual(v.map((g) => g.title), ['Дни недели', 'Времена года']);
  assert.deepEqual(v[1]?.words.map((w) => [w.ca, w.tr, w.gender]), [["l'estiu", 'лето', 'm'], ['la tardor', 'осень', 'f']]);
  assert.equal(v[1]?.words[1]?.note, 'не похоже на otoño');
  assert.equal(v[1]?.words[1]?.plural, 'les tardors');
});

test('buildVocab: Catalan data wins, a language cannot change a word', () => {
  const evil = { groups: {}, words: { dilluns: { tr: 'x', ca: 'CHANGED' } } } as unknown as LocaleVocab;
  assert.equal(buildVocab(ca, evil)[0]?.words[0]?.ca, 'el dilluns');
});

test('buildVocab without translations falls back to empty texts', () => {
  const v = buildVocab(ca, null);
  assert.equal(v[0]?.title, '');
  assert.equal(v[0]?.words[0]?.tr, '');
});

test('validateVocab: a complete translation is valid', () => {
  assert.deepEqual(validateVocab(ca, ru), []);
});

test('validateVocab reports missing translations, unknown ids, duplicates and bad genders', () => {
  const broken: VocabSource = {
    groups: [{ id: 'g', words: [
      { id: 'a', ca: 'a' }, { id: 'a', ca: 'b' }, { id: 'c', ca: '' },
      { id: 'd', ca: 'd', gender: 'x' as never },
    ] }],
  };
  const loc: LocaleVocab = { groups: {}, words: { a: { tr: 'а' }, ghost: { tr: '?' } } };
  const errors = validateVocab(broken, loc).join('\n');
  assert.match(errors, /duplicate word id "a"/);
  assert.match(errors, /"c": missing Catalan text/);
  assert.match(errors, /"d": gender must be m, f or mf/);
  assert.match(errors, /"c": missing translation/);
  assert.match(errors, /group "g": missing title/);
  assert.match(errors, /unknown word "ghost"/);
});
