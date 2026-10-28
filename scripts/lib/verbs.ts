// Verb reference data (BACKLOG I-11): the simple tenses of central Catalan for the verbs of
// authoring/verbs.txt, taken from the Softcatalà dictionary (catalan-dict-tools, resultats/lt/diccionari.txt:
// lines "form lemma tag", Freeling tags). Compound and periphrastic tenses are built on the site.
import type { PersonForms, SimpleTense, VerbDef, VerbsData } from '../../src/types/index.ts';

export interface VerbEntry {
  id: string;
  inf: string;
  pron?: true;
}

// One infinitive per line in frequency order; "adonar-se", "asseure's" are pronominal verbs; "#" starts a comment.
export function parseVerbList(text: string): VerbEntry[] {
  const out: VerbEntry[] = [];
  const seen = new Set<string>();
  for (const line of text.split('\n')) {
    const id = line.replace(/#.*/, '').trim();
    if (!id) continue;
    if (seen.has(id)) throw new Error(`verb list: ${id} is listed twice`);
    seen.add(id);
    const inf = id.replace(/(-se|'s)$/, '');
    out.push(inf === id ? { id, inf } : { id, inf, pron: true });
  }
  return out;
}

// Tag positions: V, kind (M main, A auxiliary, S ser), mood, tense, person, number, gender, variant.
const TENSES: Record<string, SimpleTense> = {
  IP: 'ind.pres', II: 'ind.imperf', IS: 'ind.simple', IF: 'ind.fut', IC: 'ind.cond',
  SP: 'subj.pres', SI: 'subj.imperf', M0: 'imp',
};

// The eighth position marks the dialect: 0 all, C central, X central + Valencian, Y central + Balearic.
// In the imperfect subjunctive it is a set of endings; central Catalan uses 1 (-és) and 2 (-essis, -éssim…).
const isCentral = (tag: string): boolean => (tag.startsWith('VMSI') || tag.startsWith('VSSI') || tag.startsWith('VASI')
  ? /[12]/.test(tag[7] ?? '') : /[0CXY]/.test(tag[7] ?? ''));

const PARTICIPLE = ['SM', 'SF', 'PM', 'PF'];

interface Raw {
  inf: boolean;
  ger: string[];
  part: string[][];
  forms: Partial<Record<SimpleTense, string[][]>>;
}

const emptyRaw = (): Raw => ({ inf: false, ger: [], part: [[], [], [], []], forms: {} });
const add = (list: string[], form: string): void => { if (!list.includes(form)) list.push(form); };

export interface BuildOptions {
  freq: Map<string, number>; // corpus frequency of a form
  models: Record<string, string>; // verb → the verb it is conjugated like
  source?: string;
}

export function buildVerbs(lines: Iterable<string>, list: VerbEntry[], { freq, models, source = '' }: BuildOptions): VerbsData {
  const wanted = new Set(list.map((v) => v.inf));
  const raw = new Map<string, Raw>();
  for (const line of lines) {
    const [form, lemma, tag] = line.trim().split(/\s+/);
    if (!form || !lemma || !tag || !wanted.has(lemma) || tag[0] !== 'V') continue;
    if (lemma === 'anar' && tag[1] === 'A') continue; // "vaig cantar": the periphrastic auxiliary
    if (!isCentral(tag)) continue;
    let r = raw.get(lemma);
    if (!r) raw.set(lemma, (r = emptyRaw()));
    const mood = tag[2];
    if (mood === 'N') r.inf = true;
    else if (mood === 'G') add(r.ger, form);
    else if (mood === 'P') {
      const i = PARTICIPLE.indexOf(tag.slice(5, 7));
      if (i >= 0) add(r.part[i]!, form);
    } else {
      const tense = TENSES[tag.slice(2, 4)];
      const person = Number(tag[4]) - 1 + (tag[5] === 'P' ? 3 : 0);
      if (!tense || !(person >= 0 && person < 6)) continue;
      const slots = (r.forms[tense] ??= [[], [], [], [], [], []]);
      add(slots[person]!, form);
    }
  }

  const verbs = list.map((entry): VerbDef => {
    const r = raw.get(entry.inf);
    if (!r?.inf) throw new Error(`verb ${entry.inf} is not in the dictionary`);
    const clean = (slots: string[][], tense?: SimpleTense): string[][] =>
      slots.map((s) => spelling(s).filter((f) => !(tense && DROPPED[tense]?.has(f))));
    const tenses = Object.values(TENSES).map((tense) => [tense, clean(r.forms[tense] ?? [[], [], [], [], [], []], tense)] as const);
    // one series for the whole verb: its most frequent form with alternatives
    const seed = seedOf([...tenses.flatMap(([, slots]) => slots), clean([r.ger])[0]!, ...clean(r.part)], freq);
    const order = (slots: string[][]): string[] => orderSeries(slots, freq, seed).map((alts) => alts.join('/'));
    const forms = {} as Record<SimpleTense, PersonForms>;
    for (const [tense, slots] of tenses) forms[tense] = order(slots) as PersonForms;
    const model = models[entry.inf];
    return {
      ...entry,
      ...(model ? { model } : {}),
      ger: order(clean([r.ger]))[0]!,
      part: order(clean(r.part)) as VerbDef['part'],
      forms,
    };
  });
  return { source, verbs };
}

const plain = (s: string): string => s.normalize('NFD').replace(/[\u0300\u0301]/g, '').normalize('NFC');

// The dictionary also accepts spellings that central Catalan of the IEC 2016 norm does not use:
// - a diacritic lost in 2016 (sóc, dóna, véns, fóra) next to the plain form (soc, dona, vens, fora);
// - the Valencian é next to the central è (entés / entès, aprén / aprèn, féiem / fèiem).
export function spelling(forms: string[]): string[] {
  return forms.filter((f) => {
    if (f !== plain(f) && forms.includes(plain(f))) return false;
    return !(f.includes('é') && forms.includes(f.replaceAll('é', 'è')));
  });
}

// Forms put first by hand: corpus counts mislead where a form is also another word (fora "outside",
// té "he has", mort "death") or another verb (ves of anar).
const PREFERRED = new Set([
  'seria', 'series', 'seríem', 'seríeu', 'serien', 'estat', 'estada', 'estats', 'estades', 'aniran',
  ...['tingues', 'tingueu'].flatMap((f) => ['', 'man', 'ob', 'con', 'sos', 'de', 're'].map((p) => p + f)),
  'duus', 'duu', 'veges', 'vegeu', 'prevegeu', ...['veié', 'veieres', 'veiérem', 'veiéreu', 'veieren'].flatMap((f) => [f, `pre${f}`]), 'matat', 'matada', 'matats', 'matades',
]);

// Alternatives an A2 learner should not meet as equals: the Valencian conditional of haver
// (haguera), the literary havem, haveu, the archaic future of anar (iré), the rare imperative ten.
const DROPPED: Partial<Record<SimpleTense, Set<string>>> = {
  'ind.cond': new Set(['haguera', 'hagueres', 'haguérem', 'haguéreu', 'hagueren', 'iria', 'iries', 'iríem', 'iríeu', 'irien']),
  'ind.pres': new Set(['havem', 'haveu']),
  'ind.fut': new Set(['iré', 'iràs', 'irà', 'irem', 'ireu', 'iran']),
  imp: new Set(['ten', 'mantén', 'obtén', 'contén', 'sostén', 'detén', 'retén']),
};

const commonPrefix = (a: string, b: string): number => {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return i;
};

// The form that decides the series of a verb: a preferred one, else the most frequent form that has alternatives
export function seedOf(slots: string[][], freq: Map<string, number>): string {
  const multi = slots.filter((s) => s.length > 1).flat();
  return multi.find((f) => PREFERRED.has(f)) ?? [...multi].sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0))[0] ?? '';
}

// Orders the alternatives of each slot: preferred forms first, then the series of the seed form of
// the verb (cresqué → cresquí before creixí; acut → acudo, acudi before acudeixo, acudeixi), then by frequency.
export function orderSeries(slots: string[][], freq: Map<string, number>, seed = seedOf(slots, freq)): string[][] {
  const n = (f: string): number => freq.get(f) ?? 0;
  return slots.map((alts) => alts
    .map((f, i) => ({ f, i, pref: Number(PREFERRED.has(f)), near: commonPrefix(f, seed), eix: Number(f.includes('eix') === seed.includes('eix')), n: n(f) }))
    .sort((a, b) => b.pref - a.pref || b.near - a.near || b.eix - a.eix || b.n - a.n || a.i - b.i)
    .map((x) => x.f));
}

// "anar=categories: V;model:anar;fonts: LT;" (diccionari-arrel/verbs-fdic.txt)
export function parseModels(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/^([^=\s]+)=.*?model:([^;\s]+)/gm)) out[m[1]!] = m[2]!;
  return out;
}

// "cantaré, 1234" (frequencies/frequencies-dict-forms.txt); the first count of a form is kept
export function parseFrequencies(text: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const line of text.split('\n')) {
    const m = /^(.+?),\s*(\d+)\s*$/.exec(line);
    if (m && !out.has(m[1]!)) out.set(m[1]!, Number(m[2]));
  }
  return out;
}
