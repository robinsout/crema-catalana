// Loading course data: what to fetch for the course, a language, a lesson and the audio.
import { contentApi } from '../api/content.ts';
import type { AudioIndex, Course, Lesson, LocaleCatalog, LocalesIndex, UiStrings } from '../types/index.ts';

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
