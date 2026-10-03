// Lesson content (HTML) of the current language, cached per lesson file.
import { defineStore } from 'pinia';
import { shallowReactive } from 'vue';
import { loadLessonHtml } from '../services/content.ts';
import type { Lesson } from '../types/index.ts';

export type LessonContent =
  | { state: 'loading' }
  | { state: 'ready'; html: string }
  | { state: 'error' };

export const useLessonsStore = defineStore('lessons', () => {
  const byFile = shallowReactive(new Map<string, LessonContent>());

  const content = (lesson: Pick<Lesson, 'file'>): LessonContent =>
    (lesson.file && byFile.get(lesson.file)) || { state: 'loading' };

  async function load(lesson: Pick<Lesson, 'id' | 'file'>): Promise<void> {
    const file = lesson.file;
    if (!file) return;
    if (byFile.get(file)?.state === 'ready') return;
    byFile.set(file, { state: 'loading' });
    try {
      byFile.set(file, { state: 'ready', html: await loadLessonHtml(lesson) });
    } catch {
      byFile.set(file, { state: 'error' });
    }
  }

  return { content, load };
});
