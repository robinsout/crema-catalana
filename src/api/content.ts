// Course data published with the site (content/ → site root).
import { getJson, getText } from './http.ts';
import type { AudioIndex, Course, LocaleCatalog, LocaleVocab, LocalesIndex, UiStrings, VocabSource } from '../types/index.ts';

export const contentApi = {
  locales: () => getJson<LocalesIndex>('locales/index.json'),
  course: () => getJson<Course>('course.json'),
  ui: (lang: string) => getJson<UiStrings>(`locales/${lang}/ui.json`),
  catalog: (lang: string) => getJson<LocaleCatalog>(`locales/${lang}/catalog.json`),
  lesson: (file: string) => getText(file),
  audioIndex: () => getJson<AudioIndex>('audio/index.json'),
  vocab: (lessonId: string) => getJson<VocabSource>(`vocab/${lessonId}.json`),
  localeVocab: (lang: string, lessonId: string) => getJson<LocaleVocab>(`locales/${lang}/vocab/${lessonId}.json`),
};
