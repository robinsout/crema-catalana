// Follows which section of the page is being read and keeps it in the toc store.
import { nextTick, onBeforeUnmount, watch } from 'vue';
import { useTocStore } from '../stores/toc.ts';

export function useSectionSpy(): void {
  const toc = useTocStore();
  let spy: IntersectionObserver | null = null;

  function observe(): void {
    spy?.disconnect();
    if (typeof IntersectionObserver === 'undefined') return;
    spy = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) toc.active = e.target.id;
    }, { rootMargin: '-20% 0px -70% 0px' });
    for (const id of toc.ids) {
      const el = document.getElementById(id);
      if (el) spy.observe(el);
    }
  }

  watch(() => toc.sections, () => nextTick(observe));
  onBeforeUnmount(() => spy?.disconnect());
}
