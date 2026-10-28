// Verb reference (BACKLOG I-11): the tenses of a verb, built from the simple forms stored in
// content/verbs/verbs.json; compound tenses take haver, periphrastic ones anar. Also the pronoun of
// pronominal verbs, search over infinitives, forms and translations, and the choice of tenses.
import type { CompoundTense, Mood, PersonForms, SimpleTense, TenseId, TenseInfo, VerbDef, VerbsData, VerbTranslations } from '../types/index.ts';

export type { Mood, TenseId };

// In the order of the verb page: the tenses of daily speech first within each mood
export const TENSES: readonly TenseInfo[] = [
  { id: 'ind.pres', mood: 'ind', ca: 'Present' },
  { id: 'ind.perf', mood: 'ind', ca: 'Perfet' },
  { id: 'ind.perif', mood: 'ind', ca: 'Passat perifràstic' },
  { id: 'ind.imperf', mood: 'ind', ca: 'Imperfet' },
  { id: 'ind.plusq', mood: 'ind', ca: 'Plusquamperfet' },
  { id: 'ind.fut', mood: 'ind', ca: 'Futur' },
  { id: 'ind.futPerf', mood: 'ind', ca: 'Futur perfet' },
  { id: 'ind.cond', mood: 'ind', ca: 'Condicional' },
  { id: 'ind.condPerf', mood: 'ind', ca: 'Condicional perfet' },
  { id: 'ind.simple', mood: 'ind', ca: 'Passat simple' },
  { id: 'ind.ant', mood: 'ind', ca: 'Passat anterior' },
  { id: 'ind.antPerif', mood: 'ind', ca: 'Passat anterior perifràstic' },
  { id: 'subj.pres', mood: 'subj', ca: 'Present' },
  { id: 'subj.perf', mood: 'subj', ca: 'Perfet' },
  { id: 'subj.imperf', mood: 'subj', ca: 'Imperfet' },
  { id: 'subj.plusq', mood: 'subj', ca: 'Plusquamperfet' },
  { id: 'subj.perif', mood: 'subj', ca: 'Passat perifràstic' },
  { id: 'imp', mood: 'imp', ca: 'Imperatiu' },
  { id: 'nonpers', mood: 'nonpers', ca: 'Formes no personals' },
];

export const MOODS: Record<Mood, string> = { ind: 'Indicatiu', subj: 'Subjuntiu', imp: 'Imperatiu', nonpers: 'Formes no personals' };

// On until the reader chooses: the tenses of the A1–A2 level
export const DEFAULT_TENSES: TenseId[] = ['ind.pres', 'ind.perf', 'ind.perif', 'ind.imperf', 'ind.fut', 'ind.cond', 'subj.pres', 'imp', 'nonpers'];

const KNOWN = new Set<string>(TENSES.map((t) => t.id));

// The saved choice (progress field `verbTenses`) is untrusted: only known tense ids are kept
export function enabledTenses(saved: unknown): TenseId[] {
  if (!Array.isArray(saved)) return DEFAULT_TENSES;
  return saved.filter((t): t is TenseId => typeof t === 'string' && KNOWN.has(t));
}

// jo, tu, ell/ella, nosaltres, vosaltres, ells/elles; in the imperative 2 and 5 are vostè, vostès
export const PERSONS = ['jo', 'tu', 'ell, ella', 'nosaltres', 'vosaltres', 'ells, elles'];
export const IMPERATIVE_PERSONS = ['', 'tu', 'vostè', 'nosaltres', 'vosaltres', 'vostès'];

type Six = readonly [string, string, string, string, string, string];
const HAVER: Record<'pres' | 'imperf' | 'simple' | 'fut' | 'cond' | 'subjPres' | 'subjImperf', Six> = {
  pres: ['he', 'has', 'ha', 'hem', 'heu', 'han'],
  imperf: ['havia', 'havies', 'havia', 'havíem', 'havíeu', 'havien'],
  simple: ['haguí', 'hagueres', 'hagué', 'haguérem', 'haguéreu', 'hagueren'],
  fut: ['hauré', 'hauràs', 'haurà', 'haurem', 'haureu', 'hauran'],
  cond: ['hauria', 'hauries', 'hauria', 'hauríem', 'hauríeu', 'haurien'],
  subjPres: ['hagi', 'hagis', 'hagi', 'hàgim', 'hàgiu', 'hagin'],
  subjImperf: ['hagués', 'haguessis', 'hagués', 'haguéssim', 'haguéssiu', 'haguessin'],
};
const COMPOUND: Record<CompoundTense, Six> = {
  'ind.perf': HAVER.pres, 'ind.plusq': HAVER.imperf, 'ind.ant': HAVER.simple, 'ind.futPerf': HAVER.fut,
  'ind.condPerf': HAVER.cond, 'subj.perf': HAVER.subjPres, 'subj.plusq': HAVER.subjImperf,
};
// "vaig cantar"; the forms in -r- are older and literary
const ANAR_PERIF: Six = ['vaig', 'vas/vares', 'va', 'vam/vàrem', 'vau/vàreu', 'van/varen'];
const ANAR_SUBJ_PERIF: Six = ['vagi', 'vagis', 'vagi', 'vàgim', 'vàgiu', 'vagin'];

const alts = (slot: string): string[] => (slot ? slot.split('/') : []);

// a vowel, after a silent h, but not i/u before a vowel (a semivowel: "es iodar")
const VOWEL = /^h?(?![iu][aeiouàèéíòóú])[aeiouàèéíïòóúü]/i;
const PROCLITIC = ['em', 'et', 'es', 'ens', 'us', 'es'];
// "m'adono", "em dutxo", "m'he adonat", "em vaig dutxar"
function withPronoun(form: string, person: number): string {
  const p = PROCLITIC[person]!;
  return person !== 3 && person !== 4 && VOWEL.test(form) ? `${p[1]}'${form}` : `${p} ${form}`;
}
// "dutxa't", "asseu-te", "dutxem-nos", "adonant-se", "asseure's"
const ENCLITIC = ['me', 'te', 'se', 'nos', 'vos', 'se'];
function pronounAfter(form: string, person: number): string {
  const p = ENCLITIC[person]!;
  return p.length === 2 && /[aeioàèéíïòóú]$/.test(form) ? `${form}'${p[0]}` : `${form}-${p}`;
}

export interface PersonRow {
  person: number; // 0–5
  forms: string[]; // alternatives, the usual one first; empty when the verb has none (impersonal verbs)
}

// Weather verbs and caldre have only the third persons ("plou", "cal", "calen"); the dictionary
// gives weather verbs all six, as if they were said of a person.
const IMPERSONAL = new Set(['ploure', 'nevar', 'pedregar', 'calamarsejar', 'llampegar', 'tronar', 'gelar', 'caldre']);
const hasPerson = (verb: VerbDef, person: number): boolean =>
  !(IMPERSONAL.has(verb.inf) || !verb.forms['ind.pres'][0]) || person === 2 || person === 5;

function personRows(verb: VerbDef, build: (person: number) => string[], persons: number[] = [0, 1, 2, 3, 4, 5]): PersonRow[] {
  return persons.map((person) => {
    const forms = hasPerson(verb, person) ? build(person) : [];
    return { person, forms: verb.pron ? forms.map((f) => withPronoun(f, person)) : forms };
  });
}

// "he cantat / he cantada…": every auxiliary form with every participle form (the usual ones first)
const combine = (aux: string, rest: string[]): string[] => alts(aux).flatMap((a) => rest.map((r) => `${a} ${r}`));
const participle = (verb: VerbDef): string[] => alts(verb.part[0]);

export function conjugate(verb: VerbDef, tense: Exclude<TenseId, 'nonpers'>): PersonRow[] {
  if (tense === 'imp') {
    return [1, 2, 3, 4, 5].map((person) => {
      const forms = IMPERSONAL.has(verb.inf) ? [] : alts(verb.forms.imp[person]!);
      return { person, forms: verb.pron ? forms.map((f) => pronounAfter(f, person)) : forms };
    });
  }
  if (tense === 'ind.perif') return personRows(verb, (p) => combine(ANAR_PERIF[p]!, [verb.inf]));
  if (tense === 'subj.perif') return personRows(verb, (p) => combine(ANAR_SUBJ_PERIF[p]!, [verb.inf]));
  if (tense === 'ind.antPerif') return personRows(verb, (p) => combine(ANAR_PERIF[p]!, participle(verb).map((part) => `haver ${part}`)));
  if (tense in COMPOUND) {
    const aux = COMPOUND[tense as CompoundTense];
    return personRows(verb, (p) => combine(aux[p]!, participle(verb)));
  }
  const simple = verb.forms[tense as SimpleTense] as PersonForms;
  return personRows(verb, (p) => alts(simple[p]!));
}

export interface NonPersonalRow {
  id: 'inf' | 'ger' | 'part' | 'infPerf' | 'gerPerf';
  ca: string;
  forms: string[];
}

export function nonPersonal(verb: VerbDef): NonPersonalRow[] {
  const pron = (f: string): string => (verb.pron ? pronounAfter(f, 2) : f);
  const part = participle(verb);
  return [
    { id: 'inf', ca: 'Infinitiu', forms: [verb.id] },
    { id: 'ger', ca: 'Gerundi', forms: alts(verb.ger).map(pron) },
    { id: 'part', ca: 'Participi', forms: [verb.part.map((p) => alts(p)[0]).filter(Boolean).join(', ')] },
    { id: 'infPerf', ca: 'Infinitiu compost', forms: part.map((p) => `${pron('haver')} ${p}`) },
    { id: 'gerPerf', ca: 'Gerundi compost', forms: part.map((p) => `${pron('havent')} ${p}`) },
  ];
}

// Search -------------------------------------------------------------------------------------

// lowercase, without accents, "l·l" and "l.l" as "ll", typographic apostrophes as "'"
export const normalizeQuery = (q: string): string => q.trim().toLowerCase()
  .replace(/[’`´]/g, "'")
  .replace(/l[·.•]l/g, 'll')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');

export interface VerbEntry extends VerbDef {
  tr: string; // translation into the reader's language ('' when missing)
  rank: number; // place in the frequency list, from 1
}

export interface VerbIndex {
  verbs: VerbEntry[];
  byId: Map<string, VerbEntry>;
  forms: Map<string, { verb: VerbEntry; form: string; tense: TenseId }[]>; // normalized form → where it is
}

export function verbIndex(data: VerbsData, tr: VerbTranslations | null): VerbIndex {
  const verbs = data.verbs.map((v, i): VerbEntry => ({ ...v, tr: tr?.[v.id] ?? '', rank: i + 1 }));
  const forms: VerbIndex['forms'] = new Map();
  const add = (verb: VerbEntry, form: string, tense: TenseId): void => {
    const key = normalizeQuery(form);
    const list = forms.get(key) ?? [];
    if (!list.some((x) => x.verb === verb)) list.push({ verb, form, tense });
    forms.set(key, list);
  };
  for (const v of verbs) {
    for (const [tense, slots] of Object.entries(v.forms) as [SimpleTense, PersonForms][]) {
      for (const slot of slots) for (const f of alts(slot)) add(v, f, tense);
    }
    for (const f of [...alts(v.ger), ...v.part.flatMap(alts)]) add(v, f, 'nonpers');
  }
  return { verbs, byId: new Map(verbs.map((v) => [v.id, v])), forms };
}

export interface SearchHit {
  verb: VerbEntry;
  form?: string; // the form the query matched, when it is not the infinitive
  tense?: TenseId;
}

// The whole list for an empty query. Otherwise: the infinitive itself and infinitives starting with
// the query, then verbs having the query as a form ("vaig" → anar), then translations containing it,
// then infinitives containing it; each group in frequency order.
export function searchVerbs(index: VerbIndex, query: string): SearchHit[] {
  const q = normalizeQuery(query);
  if (!q) return index.verbs.map((verb) => ({ verb }));
  // a pronoun typed before the form: "m'adono", "em dutxo"
  const bare = q.replace(/^(?:[mts]'|(?:em|et|es|ens|us) )/, '');
  const name = (v: VerbEntry): string => normalizeQuery(v.id);
  const groups: SearchHit[][] = [[], [], [], [], []];
  const seen = new Set<VerbEntry>();
  const put = (g: number, hit: SearchHit): void => {
    if (seen.has(hit.verb)) return;
    seen.add(hit.verb);
    groups[g]!.push(hit);
  };
  for (const v of index.verbs) if (name(v) === q || normalizeQuery(v.inf) === q) put(0, { verb: v });
  for (const v of index.verbs) if (name(v).startsWith(q)) put(1, { verb: v });
  for (const hit of [...(index.forms.get(q) ?? []), ...(bare !== q ? index.forms.get(bare) ?? [] : [])]
    .sort((a, b) => a.verb.rank - b.verb.rank)) put(2, hit);
  for (const v of index.verbs) if (normalizeQuery(v.tr).includes(q)) put(3, { verb: v });
  for (const v of index.verbs) if (name(v).includes(q)) put(4, { verb: v });
  return groups.flat();
}
