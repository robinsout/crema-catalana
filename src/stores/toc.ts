// Sections of the current page for the table of contents (filled by the plan, lesson and verb views),
// the section being read (useSectionSpy) and the chapters panel of narrow screens.
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export interface TocSection {
  id: string;
  title: string;
  group?: string; // a heading above the sections of one group (the mood of a tense)
}

export type TocKind = 'plan' | 'lesson' | 'verb';

export const useTocStore = defineStore('toc', () => {
  const sections = ref<TocSection[]>([]);
  const kind = ref<TocKind>('lesson');
  const lesson = ref<string | null>(null); // the lesson whose chapters these are
  const active = ref('');
  const panelOpen = ref(false);
  const ids = computed(() => sections.value.map((s) => s.id));

  // Reads <section id> + <h2> of the rendered content; "1. Фонетика" → "Фонетика".
  function collect(root: HTMLElement | null, pageKind: 'plan' | 'lesson', lessonId: string | null = null): void {
    kind.value = pageKind;
    lesson.value = lessonId;
    active.value = '';
    sections.value = root
      ? [...root.querySelectorAll<HTMLElement>('section[id]')].map((s) => {
        const h = s.querySelector('h2');
        const label = h ? (h.querySelector('span') ?? h).textContent ?? '' : s.id;
        return { id: s.id, title: label.replace(/^\d+\.\s*/, '').trim() };
      })
      : [];
  }

  // sections known without reading the page (the tenses of a verb); none for a page without them
  function show(list: TocSection[], pageKind: TocKind): void {
    kind.value = pageKind;
    lesson.value = null;
    active.value = '';
    sections.value = list;
  }

  const titleOf = (id: string): string => sections.value.find((s) => s.id === id)?.title ?? '';
  const jump = (id: string): void => {
    panelOpen.value = false;
    document.getElementById(id)?.scrollIntoView();
  };

  return { sections, kind, lesson, active, panelOpen, ids, collect, show, titleOf, jump };
});
