// Lesson vocabulary: Catalan words merged with their translation into the reader's language.
import type { LocaleVocab, VocabGroup, VocabSource } from '../types/index.ts';

const GENDERS = ['m', 'f', 'mf'];

// Catalan data wins: a language adds translations but never changes a word.
export function buildVocab(source: VocabSource, locale: LocaleVocab | null | undefined): VocabGroup[] {
  const loc = locale ?? { groups: {}, words: {} };
  return source.groups.map((g) => ({
    id: g.id,
    title: loc.groups[g.id] ?? '',
    words: g.words.map((w) => {
      const tr = loc.words[w.id];
      return { tr: '', ...(tr ?? {}), ...w };
    }),
  }));
}

export function validateVocab(source: VocabSource, locale: LocaleVocab): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const g of source.groups) {
    if (!locale.groups[g.id]) errors.push(`group "${g.id}": missing title`);
    for (const w of g.words) {
      if (seen.has(w.id)) errors.push(`duplicate word id "${w.id}"`);
      seen.add(w.id);
      if (!w.ca) errors.push(`"${w.id}": missing Catalan text`);
      if (w.gender !== undefined && !GENDERS.includes(w.gender)) errors.push(`"${w.id}": gender must be m, f or mf`);
      if (!locale.words[w.id]?.tr) errors.push(`"${w.id}": missing translation`);
    }
  }
  for (const id of Object.keys(locale.words)) if (!seen.has(id)) errors.push(`unknown word "${id}"`);
  return errors;
}
