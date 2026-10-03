// Reads lesson exercises from content/ on disk, for tests and scripts.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeSayText } from '../../src/services/audio.ts';
import { extractSayTexts } from './say-texts.ts';
import type { ExerciseSet } from '../../src/types/index.ts';

export function loadExercises(contentDir: string, lang: string, lessonId: string): ExerciseSet {
  const path = join(contentDir, 'locales', lang, 'exercises', `${lessonId}.json`);
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as ExerciseSet) : {};
}

// Catalan texts that need a recording: phrases in prompts and the shown solution of fill-in items
export const exerciseTexts = (set: ExerciseSet): string[] =>
  Object.values(set).flatMap((ex) => ex.items.flatMap((item) => [
    ...extractSayTexts(item.prompt),
    ...('answers' in item && item.answers[0] ? [normalizeSayText(item.answers[0])] : []),
  ]));
