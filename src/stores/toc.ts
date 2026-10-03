// Sections of the current page for the table of contents (filled by the plan and lesson views).
import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface TocSection {
  id: string;
  title: string;
}

export const useTocStore = defineStore('toc', () => {
  const sections = ref<TocSection[]>([]);
  const kind = ref<'plan' | 'lesson'>('lesson');

  // Reads <section id> + <h2> of the rendered content; "1. Фонетика" → "Фонетика".
  function collect(root: HTMLElement | null, pageKind: 'plan' | 'lesson'): void {
    kind.value = pageKind;
    sections.value = root
      ? [...root.querySelectorAll<HTMLElement>('section[id]')].map((s) => {
        const h = s.querySelector('h2');
        const label = h ? (h.querySelector('span') ?? h).textContent ?? '' : s.id;
        return { id: s.id, title: label.replace(/^\d+\.\s*/, '').trim() };
      })
      : [];
  }

  return { sections, kind, collect };
});
