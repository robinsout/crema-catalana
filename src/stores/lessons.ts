// Lesson content (HTML) and vocabulary in the current language, cached per lesson file.
import { defineStore } from 'pinia';
import { shallowReactive } from 'vue';
import { loadLessonHtml, loadVocab } from '../services/content.ts';
import type { Lesson, VocabGroup } from '../types/index.ts';

export type LessonContent =
  | { state: 'loading' }
  | { state: 'ready'; html: string }
  | { state: 'error' };

type LessonRef = Pick<Lesson, 'id' | 'file' | 'hasVocab'>;

export const useLessonsStore = defineStore('lessons', () => {
  const byFile = shallowReactive(new Map<string, LessonContent>());
  const vocabByFile = shallowReactive(new Map<string, VocabGroup[] | null>());

  const content = (lesson: Pick<Lesson, 'file'>): LessonContent =>
    (lesson.file && byFile.get(lesson.file)) || { state: 'loading' };
  const vocab = (lesson: Pick<Lesson, 'file'>): VocabGroup[] | null =>
    (lesson.file && vocabByFile.get(lesson.file)) || null;

  async function load(lesson: LessonRef, lang: string): Promise<void> {
    const file = lesson.file;
    if (!file) return;
    if (byFile.get(file)?.state === 'ready') return;
    byFile.set(file, { state: 'loading' });
    try {
      const [html, words] = await Promise.all([
        loadLessonHtml(lesson),
        loadVocab(lesson, lang).catch(() => null), // a lesson stays readable without its vocabulary
      ]);
      vocabByFile.set(file, words);
      byFile.set(file, { state: 'ready', html });
    } catch {
      byFile.set(file, { state: 'error' });
    }
  }

  return { content, vocab, load };
});
