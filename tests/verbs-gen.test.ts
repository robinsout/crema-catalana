// The verb reference data (BACKLOG I-11): simple tenses of central Catalan taken from the Softcatalà
// dictionary (lines "form lemma tag"), alternatives ordered by corpus frequency.
// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { buildVerbs, parseVerbList } from '../scripts/lib/verbs.ts';

const DICT = `
canto cantar VMIP1S0C
cante cantar VMIP1S0V
cant cantar VMIP1S0B
cantes cantar VMIP2S00
canta cantar VMIP3S00
cantem cantar VMIP1P00
cantam cantar VMIP1P0B
canteu cantar VMIP2P00
canten cantar VMIP3P00
cantava cantar VMII1S00
cantés cantar VMSI1S01
cantara cantar VMSI1S03
cantàs cantar VMSI1S07
cantessis cantar VMSI2S02
cantesses cantar VMSI2S05
canta cantar VMM02S00
canti cantar VMM03S0Y
cante cantar VMM03S0V
cantar cantar VMN00000
cantant cantar VMG00000
cantat cantar VMP00SM0
cantada cantar VMP00SF0
cantats cantar VMP00PM0
cantades cantar VMP00PF0
cant cant NCMS000
vaig anar VAIP1S00
vaig anar VMIP1S00
anaré anar VMIF1S00
aniré anar VMIF1S00
anar anar VMN00000
anant anar VMG00000
anat anar VMP00SM0
anada anar VMP00SF0
anats anar VMP00PM0
anades anar VMP00PF0
`;

const FREQ = new Map([['aniré', 900], ['anaré', 40]]);

test('the verb list: frequency order, pronominal verbs, comments', () => {
  assert.deepEqual(parseVerbList("# top verbs\nanar\n\nadonar-se  # only pronominal\nasseure's\ncantar\n"), [
    { id: 'anar', inf: 'anar' },
    { id: 'adonar-se', inf: 'adonar', pron: true },
    { id: "asseure's", inf: 'asseure', pron: true },
    { id: 'cantar', inf: 'cantar' },
  ]);
  assert.throws(() => parseVerbList('anar\nanar\n'), /twice/);
});

test('only central forms; the imperfect subjunctive with -és, -essis', () => {
  const { verbs } = buildVerbs(DICT.split('\n'), parseVerbList('cantar'), { freq: FREQ, models: { cantar: 'cantar' } });
  const v = verbs[0]!;
  assert.equal(v.id, 'cantar');
  assert.equal(v.model, 'cantar');
  assert.deepEqual(v.forms['ind.pres'], ['canto', 'cantes', 'canta', 'cantem', 'canteu', 'canten']);
  assert.equal(v.forms['subj.imperf'][0], 'cantés');
  assert.equal(v.forms['subj.imperf'][1], 'cantessis');
  assert.deepEqual(v.forms.imp, ['', 'canta', 'canti', '', '', '']);
  assert.equal(v.ger, 'cantant');
  assert.deepEqual(v.part, ['cantat', 'cantada', 'cantats', 'cantades']);
});

test('alternatives go most frequent first; the periphrastic auxiliary is not a form of anar', () => {
  const { verbs } = buildVerbs(DICT.split('\n'), parseVerbList('anar'), { freq: FREQ, models: {} });
  const v = verbs[0]!;
  assert.equal(v.forms['ind.fut'][0], 'aniré/anaré');
  assert.equal(v.forms['ind.pres'][0], 'vaig');
  assert.equal(v.model, undefined);
});

test('a verb missing from the dictionary is an error, not an empty table', () => {
  assert.throws(() => buildVerbs(DICT.split('\n'), parseVerbList('ballar'), { freq: FREQ, models: {} }), /ballar/);
});

const one = (dict: string, freq: Array<[string, number]> = [], verb = 'cantar') =>
  buildVerbs(`cantar cantar VMN00000\nanar anar VMN00000\n${dict}`.split('\n'), parseVerbList(verb), { freq: new Map(freq), models: {} }).verbs[0]!;

test('spelling of the 2016 reform: a lost diacritic goes when the plain form is there', () => {
  const v = one('sóc cantar VMIP1S00\nsoc cantar VMIP1S00\nés cantar VMIP3S00\ndóna cantar VMIP3S00\ndona cantar VMIP3S00', [['sóc', 99]]);
  assert.equal(v.forms['ind.pres'][0], 'soc');
  assert.equal(v.forms['ind.pres'][2], 'és/dona');
  assert.ok(!v.forms['ind.pres'][2].includes('dóna'));
});

test('central è over Valencian é', () => {
  const v = one('entès cantar VMP00SM0\nentés cantar VMP00SM0\ndesprès cantar VMP00SF0\ndesprés cantar VMP00SF0', [['després', 9999]]);
  assert.equal(v.part[0], 'entès');
  assert.equal(v.part[1], 'desprès');
});

test('alternatives keep one order through a tense: the series of its most frequent form first', () => {
  const v = one(['creixí VMIS1S00', 'cresquí VMIS1S00', 'cresqué VMIS3S00', 'creixé VMIS3S00'].map((l) => l.replace(' ', ' cantar ')).join('\n'),
    [['creixí', 30], ['cresquí', 20], ['cresqué', 500], ['creixé', 1]]);
  assert.equal(v.forms['ind.simple'][0], 'cresquí/creixí');
  assert.equal(v.forms['ind.simple'][2], 'cresqué/creixé');
});

test('a few forms are preferred by hand, where homographs mislead the corpus counts', () => {
  const v = one('fora anar VMIC3S00\nseria anar VMIC3S00', [['fora', 9000], ['seria', 100]], 'anar');
  assert.equal(v.forms['ind.cond'][2], 'seria/fora');
});

test('with or without -eix- (mento / menteixo): the series of the most frequent form', () => {
  const v = one(['menteixo VMIP1S00', 'mento VMIP1S00', 'ment VMIP3S00', 'menteix VMIP3S00'].map((l) => l.replace(' ', ' cantar ')).join('\n'),
    [['menteixo', 50], ['mento', 10], ['ment', 900], ['menteix', 5]]);
  assert.equal(v.forms['ind.pres'][0], 'mento/menteixo');
  assert.equal(v.forms['ind.pres'][2], 'ment/menteix');
});

test('one series for the whole verb: the subjunctive follows the present (acudo → acudi)', () => {
  const v = one(['acudo VMIP1S00', 'acudeixo VMIP1S00', 'acut VMIP3S00', 'acudeix VMIP3S00', 'acudeixi VMSP1S00', 'acudi VMSP1S00']
    .map((l) => l.replace(' ', ' cantar ')).join('\n'), [['acut', 900], ['acudeixi', 50], ['acudi', 5]]);
  assert.equal(v.forms['subj.pres'][0], 'acudi/acudeixi');
});

test('literary and Valencian alternatives of haver and anar are left out', () => {
  const v = one('hauria anar VMIC1S00\nhaguera anar VMIC1S00\nhem anar VMIP1P00\nhavem anar VMIP1P00\naniré anar VMIF1S00\niré anar VMIF1S00\nhagueres anar VMIS2S00', [], 'anar');
  assert.equal(v.forms['ind.cond'][0], 'hauria');
  assert.equal(v.forms['ind.pres'][3], 'hem');
  assert.equal(v.forms['ind.fut'][0], 'aniré');
  assert.equal(v.forms['ind.simple'][1], 'hagueres', 'the same form stays in another tense');
});
