// Checking answers of interactive exercises.
import type { AnswerCheck, Exercise, ExerciseSet } from '../types/index.ts';

// lower case, single spaces, one apostrophe style, a dot typed for the middle dot (l.l → l·l),
// no final punctuation
export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/l\.l/g, 'l·l')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?…;:,]+$/u, '')
    .trim();
}

const withoutAccents = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '');

export function checkAnswer(given: string, accepted: string[]): AnswerCheck {
  const g = normalizeAnswer(given);
  if (!g) return 'empty';
  const ok = accepted.map(normalizeAnswer);
  if (ok.includes(g)) return 'correct';
  // the right words with wrong or missing accents (és / es, demà / dema)
  if (ok.map(withoutAccents).includes(withoutAccents(g))) return 'accent';
  return 'wrong';
}

export function scoreOf(checks: AnswerCheck[]): { score: number; total: number } {
  return { score: checks.filter((c) => c === 'correct').length, total: checks.length };
}

export const exerciseKey = (lessonId: string, exerciseId: string): string => `${lessonId}/${exerciseId}`;

// ids of the exercise placeholders in a lesson, in order
export const exerciseIds = (html: string): string[] =>
  [...html.matchAll(/data-exercise="([^"]+)"/g)].map((m) => m[1] ?? '');

export function validateExercises(html: string, set: ExerciseSet): string[] {
  const errors: string[] = [];
  const placed = exerciseIds(html);
  for (const id of placed) if (!set[id]) errors.push(`"${id}": no exercise data`);
  for (const [id, ex] of Object.entries(set) as [string, Exercise][]) {
    if (!placed.includes(id)) errors.push(`"${id}": not placed in the lesson`);
    if (ex.type !== 'fill' && ex.type !== 'choice') { errors.push(`"${id}": unknown type`); continue; }
    if (!ex.items.length) errors.push(`"${id}": no items`);
    ex.items.forEach((item, i) => {
      const at = `"${id}" item ${i + 1}`;
      if (!item.prompt) errors.push(`${at}: missing prompt`);
      if (ex.type === 'fill' && 'answers' in item && !item.answers.filter(Boolean).length) errors.push(`${at}: no accepted answers`);
      if (ex.type === 'choice' && 'options' in item) {
        if (item.options.length < 2) errors.push(`${at}: needs at least 2 options`);
        if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer >= item.options.length) errors.push(`${at}: answer index out of range`);
      }
    });
  }
  return errors;
}
