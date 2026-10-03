import type { RouteLocationRaw } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.ts';
import type { Lesson } from '../lib/types.ts';

// Where a lesson link leads: the lesson when it is written, otherwise its place in the study plan.
export function useLessonLink() {
  const catalog = useCatalogStore();
  return (l: Pick<Lesson, 'id' | 'file'>): RouteLocationRaw =>
    l.file
      ? { name: 'lesson', params: { lang: catalog.lang, id: l.id } }
      : { name: 'plan', params: { lang: catalog.lang, focus: l.id } };
}
