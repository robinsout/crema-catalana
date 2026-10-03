import { computed } from 'vue';
import { useCatalogStore } from '../stores/catalog.ts';
import type { Translate } from '../types/index.ts';

// Interface strings of the current language (reactive inside templates).
export function useI18n() {
  const catalog = useCatalogStore();
  const t: Translate = (key, vars) => catalog.t(key, vars);
  const formatDate = (iso: string): string =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(catalog.ui._dateLocale || catalog.lang, { day: 'numeric', month: 'long', year: 'numeric' });
  return { t, formatDate, lang: computed(() => catalog.lang) };
}
