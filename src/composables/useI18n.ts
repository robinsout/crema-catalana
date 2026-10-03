import { computed } from 'vue';
import { useCatalogStore } from '../stores/catalog.ts';
import type { Translate } from '../types/index.ts';

// Interface strings of the current language (reactive inside templates).
export function useI18n() {
  const catalog = useCatalogStore();
  const t: Translate = (key, vars) => catalog.t(key, vars);
  const formatDate = (iso: string): string =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(catalog.ui._dateLocale || catalog.lang, { day: 'numeric', month: 'long', year: 'numeric' });
  // "2 minutes ago" in the reader's language
  const formatRelative = (at: number): string => {
    const minutes = Math.round((at - Date.now()) / 60_000);
    const rtf = new Intl.RelativeTimeFormat(catalog.ui._dateLocale || catalog.lang, { numeric: 'auto' });
    return Math.abs(minutes) < 60 ? rtf.format(minutes, 'minute') : rtf.format(Math.round(minutes / 60), 'hour');
  };
  return { t, formatDate, formatRelative, lang: computed(() => catalog.lang) };
}
