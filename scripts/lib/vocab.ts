// Reads lesson vocabularies from content/ on disk, for tests and scripts.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeSayText } from '../../src/services/audio.ts';
import type { LocaleVocab, VocabSource } from '../../src/types/index.ts';

export function loadVocabSource(contentDir: string, lessonId: string): VocabSource {
  return JSON.parse(readFileSync(join(contentDir, 'vocab', `${lessonId}.json`), 'utf8')) as VocabSource;
}

export function loadLocaleVocab(contentDir: string, lang: string, lessonId: string): LocaleVocab | null {
  const path = join(contentDir, 'locales', lang, 'vocab', `${lessonId}.json`);
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as LocaleVocab) : null;
}

// Catalan texts that need a recording: every word (and its plural)
export const vocabTexts = (source: VocabSource): string[] =>
  source.groups.flatMap((g) => g.words.flatMap((w) => [w.ca, w.plural ?? ''])).map(normalizeSayText).filter(Boolean);
