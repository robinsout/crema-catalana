// Verb reference (BACKLOG I-11): tenses built from the stored simple forms, pronominal verbs,
// search and the choice of tenses. Runs on the real data (content/verbs/verbs.json).
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_TENSES, TENSES, conjugate, enabledTenses, nonPersonal, normalizeQuery, searchVerbs, verbIndex } from '../src/services/verbs.ts';
import type { VerbsData } from '../src/types/index.ts';

const data: VerbsData = JSON.parse(readFileSync('content/verbs/verbs.json', 'utf8'));
const index = verbIndex(data, { anar: 'идти', cantar: 'петь', 'adonar-se': 'замечать', quedar: 'договариваться', 'quedar-se': 'оставаться' });
const verb = (id: string) => index.byId.get(id)!;
const forms = (id: string, tense: Parameters<typeof conjugate>[1]) => conjugate(verb(id), tense).map((r) => r.forms.join(' / '));

test('the data: 500+ verbs, in order of frequency, with the source named', () => {
  assert.ok(data.verbs.length >= 500);
  assert.deepEqual(data.verbs.slice(0, 4).map((v) => v.id), ['ser', 'haver', 'anar', 'fer']);
  assert.match(data.source, /Softcatalà/);
});

test('simple tenses come from the data; the IEC 2016 spelling', () => {
  assert.deepEqual(forms('ser', 'ind.pres'), ['soc', 'ets', 'és', 'som', 'sou', 'són']);
  assert.deepEqual(forms('venir', 'ind.pres').slice(1, 2), ['vens']);
  assert.deepEqual(forms('anar', 'ind.fut'), ['aniré', 'aniràs', 'anirà', 'anirem', 'anireu', 'aniran']);
  assert.deepEqual(forms('ser', 'ind.cond').slice(0, 2), ['seria / fora', 'series / fores']);
});

test('compound tenses: haver + participle', () => {
  assert.deepEqual(forms('cantar', 'ind.perf'), ['he cantat', 'has cantat', 'ha cantat', 'hem cantat', 'heu cantat', 'han cantat']);
  assert.equal(forms('fer', 'ind.plusq')[0], 'havia fet');
  assert.equal(forms('venir', 'ind.futPerf')[2], 'haurà vingut');
  assert.equal(forms('dir', 'ind.condPerf')[0], 'hauria dit');
  assert.equal(forms('veure', 'subj.perf')[5], 'hagin vist');
  assert.equal(forms('ser', 'subj.plusq')[0], 'hagués estat / hagués sigut');
  assert.equal(forms('cantar', 'ind.ant')[0], 'haguí cantat');
});

test('periphrastic past: anar + infinitive', () => {
  assert.deepEqual(forms('cantar', 'ind.perif'), ['vaig cantar', 'vas cantar / vares cantar', 'va cantar', 'vam cantar / vàrem cantar', 'vau cantar / vàreu cantar', 'van cantar / varen cantar']);
  assert.equal(forms('cantar', 'ind.antPerif')[0], 'vaig haver cantat');
  assert.equal(forms('cantar', 'subj.perif')[3], 'vàgim cantar');
});

test('the imperative has no "jo"; its persons are tu, vostè, nosaltres, vosaltres, vostès', () => {
  const rows = conjugate(verb('cantar'), 'imp');
  assert.deepEqual(rows.map((r) => r.person), [1, 2, 3, 4, 5]);
  assert.deepEqual(rows.map((r) => r.forms[0]), ['canta', 'canti', 'cantem', 'canteu', 'cantin']);
});

test('pronominal verbs: the pronoun before the verb, elided before a vowel or h', () => {
  assert.deepEqual(forms('adonar-se', 'ind.pres'), ["m'adono", "t'adones", "s'adona", 'ens adonem', 'us adoneu', "s'adonen"]);
  assert.deepEqual(forms('dutxar-se', 'ind.pres'), ['em dutxo', 'et dutxes', 'es dutxa', 'ens dutxem', 'us dutxeu', 'es dutxen']);
  assert.equal(forms('adonar-se', 'ind.perf')[0], "m'he adonat");
  assert.equal(forms('dutxar-se', 'ind.perif')[0], 'em vaig dutxar');
});

test('pronominal verbs: the imperative takes the pronoun after it', () => {
  assert.deepEqual(conjugate(verb('dutxar-se'), 'imp').map((r) => r.forms[0]), ["dutxa't", "dutxi's", 'dutxem-nos', 'dutxeu-vos', 'dutxin-se']);
  assert.deepEqual(conjugate(verb("asseure's"), 'imp').map((r) => r.forms[0]), ['asseu-te', "assegui's", 'asseguem-nos', 'asseieu-vos', 'asseguin-se']);
});

test('non-personal forms, with the pronoun after them for pronominal verbs', () => {
  const np = (id: string) => Object.fromEntries(nonPersonal(verb(id)).map((r) => [r.id, r.forms.join(' / ')]));
  assert.deepEqual(np('cantar'), { inf: 'cantar', ger: 'cantant', part: 'cantat, cantada, cantats, cantades', infPerf: 'haver cantat', gerPerf: 'havent cantat' });
  assert.equal(np("asseure's").inf, "asseure's");
  assert.equal(np('adonar-se').ger, 'adonant-se');
  assert.equal(np('adonar-se').infPerf, "haver-se adonat");
});

test('every tense of every verb has a row per person (an impersonal verb has blanks)', () => {
  for (const v of data.verbs) {
    for (const t of TENSES) {
      if (t.id === 'nonpers') continue;
      const rows = conjugate(index.byId.get(v.id)!, t.id);
      assert.equal(rows.length, t.id === 'imp' ? 5 : 6, `${v.id} ${t.id}`);
    }
  }
  assert.ok(forms('caldre', 'ind.pres')[2]);
});

test('search: by infinitive without accents, by any form, by translation', () => {
  const ids = (q: string) => searchVerbs(index, q).map((r) => r.verb.id);
  assert.deepEqual(ids('anar').slice(0, 1), ['anar']);
  assert.ok(ids('coneixer').includes('conèixer'));
  assert.ok(ids('instal.lar').includes('instal·lar'));
  const vaig = searchVerbs(index, 'vaig')[0]!;
  assert.equal(vaig.verb.id, 'anar');
  assert.equal(vaig.form, 'vaig');
  assert.equal(searchVerbs(index, 'fet')[0]?.verb.id, 'fer');
  assert.equal(searchVerbs(index, 'tingués')[0]?.verb.id, 'tenir');
  assert.ok(ids('петь').includes('cantar'));
  assert.ok(ids('Оставаться').includes('quedar-se'));
  assert.deepEqual(ids(''), data.verbs.map((v) => v.id), 'no query: the whole list in frequency order');
  assert.deepEqual(ids('qqqq'), []);
});

test('search: the infinitive first, then forms, then the rest', () => {
  const ids = searchVerbs(index, 'que').map((r) => r.verb.id);
  assert.equal(ids[0], 'quedar');
  assert.ok(ids.indexOf('quedar-se') < ids.indexOf('queixar-se'));
});

test('normalized queries: case, accents, apostrophes, l·l', () => {
  assert.equal(normalizeQuery('  Conèixer '), 'coneixer');
  assert.equal(normalizeQuery('M’adono'), "m'adono");
  assert.equal(normalizeQuery('INSTAL·LAR'), 'installar');
  assert.equal(normalizeQuery('instal.lar'), 'installar');
});

test('tenses on by default: the A1–A2 ones; a saved choice keeps only known tenses', () => {
  assert.deepEqual([...DEFAULT_TENSES].sort(), ['imp', 'ind.cond', 'ind.fut', 'ind.imperf', 'ind.perf', 'ind.perif', 'ind.pres', 'nonpers', 'subj.pres'].sort());
  assert.deepEqual(enabledTenses(undefined), DEFAULT_TENSES);
  assert.deepEqual(enabledTenses(['ind.pres', 'bogus', 7, 'imp']), ['ind.pres', 'imp']);
  assert.deepEqual(enabledTenses([]), []);
  assert.deepEqual(enabledTenses('ind.pres'), DEFAULT_TENSES);
  assert.equal(new Set(TENSES.map((t) => t.id)).size, TENSES.length);
});

test('impersonal verbs (ploure, nevar, caldre): only the third persons, in every tense', () => {
  for (const id of ['ploure', 'nevar', 'caldre']) {
    for (const tense of ['ind.pres', 'ind.perf', 'ind.perif', 'ind.antPerif', 'subj.perif'] as const) {
      const rows = conjugate(verb(id), tense);
      assert.deepEqual(rows.filter((r) => r.forms.length).map((r) => r.person).filter((p) => p !== 5), [2], `${id} ${tense}`);
    }
  }
  assert.equal(forms('ploure', 'ind.perif')[2], 'va ploure');
  assert.equal(nonPersonal(verb('ploure')).find((r) => r.id === 'part')?.forms[0], 'plogut');
});

test('pronouns: elided before a vowel but not before a semivowel; enclitic apostrophe after ï', () => {
  const v = { ...verb('adonar-se'), id: 'iodar-se', inf: 'iodar' };
  v.forms = { ...v.forms, 'ind.pres': ['iodo', 'iodes', 'ioda', 'iodem', 'iodeu', 'ioden'], imp: ['', 'ioda', 'iodi', 'iodem', 'iodeu', 'iodin'] };
  assert.equal(conjugate(v, 'ind.pres')[0]!.forms[0], 'em iodo');
  const d = { ...verb('adonar-se'), forms: { ...verb('adonar-se').forms, imp: ['', 'divorcia', 'divorciï', 'divorciem', 'divorcieu', 'divorciïn'] as typeof v.forms.imp } };
  assert.equal(conjugate(d, 'imp')[1]!.forms[0], "divorciï's");
});

test('one order of alternatives through the whole verb; literary and Valencian alternatives left out', () => {
  const first = (id: string, tense: Parameters<typeof conjugate>[1], p: number) => conjugate(verb(id), tense).find((r) => r.person === p)!.forms;
  const inchoative = (f: string) => f.includes('eix');
  for (const id of ['acudir', 'mentir']) {
    const series = [first(id, 'ind.pres', 0)[0]!, first(id, 'subj.pres', 0)[0]!, first(id, 'imp', 2)[0]!].map(inchoative);
    assert.ok(series.every((s) => s === series[0]), `${id}: ${series}`);
  }
  assert.deepEqual(first('dur', 'ind.pres', 2), ['duu', 'du']);
  assert.deepEqual(first('haver', 'ind.cond', 0), ['hauria']);
  assert.deepEqual(first('haver', 'ind.pres', 3), ['hem']);
  assert.deepEqual(first('anar', 'ind.fut', 0), ['aniré']);
  assert.deepEqual(first('tenir', 'imp', 1), ['tingues', 'té']);
  assert.deepEqual(first('mantenir', 'imp', 1), ['mantingues', 'manté']);
  assert.deepEqual(first('veure', 'imp', 4), ['vegeu', 'veieu']);
});
