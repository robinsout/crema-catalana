// Loading course data: what to fetch for the course, a language, a lesson and the audio.
import { contentApi } from '../api/content.ts';
import { buildVocab } from './vocab.ts';
import type { AudioIndex, Course, Lesson, LocaleCatalog, LocalesIndex, UiStrings, VocabGroup } from '../types/index.ts';

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

// The language to show: the requested one when it exists, otherwise the default
export const pickLanguage = (locales: LocalesIndex, requested: string): string =>
  (locales.available.includes(requested) ? requested : locales.default);

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
