// Loading course data: what to fetch for the course, a language, a lesson and the audio.
import { contentApi } from '../api/content.ts';
import { browserLanguages } from '../api/browser.ts';
import { buildVocab } from './vocab.ts';
import { exerciseIds } from './exercises.ts';
import type { AudioIndex, Course, ExerciseSet, Lesson, LocaleCatalog, LocalesIndex, UiStrings, VocabGroup } from '../types/index.ts';

export interface CourseBase {
  locales: LocalesIndex;
  course: Course;
}

export interface LanguagePack {
  ui: UiStrings;
  catalog: LocaleCatalog;
}

export async function loadCourseBase(): Promise<CourseBase> {
  const [locales, course] = await Promise.all([contentApi.locales(), contentApi.course()]);
  return { locales, course };
}

export async function loadLanguagePack(lang: string): Promise<LanguagePack> {
  const [ui, catalog] = await Promise.all([contentApi.ui(lang), contentApi.catalog(lang)]);
  return { ui, catalog };
}

// The language to show: the requested one when it exists, otherwise `fallback` (the default by default)
export const pickLanguage = (locales: LocalesIndex, requested: string, fallback = locales.default): string =>
  (locales.available.includes(requested) ? requested : fallback);

export interface LanguageHints {
  saved: string | null | undefined; // the language of the last page opened on this device
  hasHistory: boolean; // progress saved before languages existed: it was read in the base language
  browser: readonly string[]; // navigator.languages
}

// The language of a visit without one in the link: the saved one, the base one for readers from
// before the languages, the browser's first supported language, otherwise the default.
export function preferredLanguage(locales: LocalesIndex, hints: LanguageHints): string {
  const ok = (code: string | null | undefined): code is string => !!code && locales.available.includes(code);
  if (ok(hints.saved)) return hints.saved;
  if (hints.hasHistory && ok(locales.base)) return locales.base;
  const fromBrowser = hints.browser.map((tag) => tag.split('-')[0]?.toLowerCase()).find(ok);
  return fromBrowser ?? locales.default;
}

export const readerLanguages = browserLanguages;

// Languages (of `candidates`) in which a lesson is written: their catalogs give it a date
export async function languagesWithLesson(candidates: string[], id: string): Promise<string[]> {
  const catalogs = await Promise.all(candidates.map((lang) => contentApi.catalog(lang).catch(() => null)));
  return candidates.filter((_, i) => !!catalogs[i]?.lessons?.[id]?.date);
}

export function loadLessonHtml(lesson: Pick<Lesson, 'id' | 'file'>): Promise<string> {
  if (!lesson.file) return Promise.reject(new Error(`lesson ${lesson.id} is not written in this language`));
  return contentApi.lesson(lesson.file);
}

// No audio is not an error: phrases just stay plain text
export const loadAudioIndex = (): Promise<AudioIndex | null> => contentApi.audioIndex().catch(() => null);

// The vocabulary of a lesson in a language; null when the lesson has none.
// Missing translations do not hide the Catalan words.
export async function loadVocab(lesson: Pick<Lesson, 'id' | 'hasVocab'>, lang: string): Promise<VocabGroup[] | null> {
  if (!lesson.hasVocab) return null;
  const [source, locale] = await Promise.all([
    contentApi.vocab(lesson.id),
    contentApi.localeVocab(lang, lesson.id).catch(() => null),
  ]);
  return buildVocab(source, locale);
}

// Exercises placed in a lesson; nothing is fetched when the lesson has no placeholders.
export async function loadExercises(lesson: Pick<Lesson, 'id'>, lang: string, html: string): Promise<ExerciseSet> {
  if (!exerciseIds(html).length) return {};
  return contentApi.exercises(lang, lesson.id);
}
