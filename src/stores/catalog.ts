// Course data in the reader's language: catalog of lessons and interface strings.
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { buildCatalog, findLesson, normalizeCatalog } from '../lib/model.ts';
import { createT } from '../lib/i18n.ts';
import type { Course, Lesson, LocaleCatalog, LocalesIndex, UiStrings } from '../lib/types.ts';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await res.json()) as T;
}

interface LanguagePack {
  ui: UiStrings;
  catalog: LocaleCatalog;
}

export const useCatalogStore = defineStore('catalog', () => {
  const lang = ref('');
  const locales = shallowRef<LocalesIndex | null>(null);
  const course = shallowRef<Course | null>(null);
  const pack = shallowRef<LanguagePack>({ ui: {}, catalog: {} });
  const error = ref(false);
  const packs = new Map<string, Promise<LanguagePack>>();
  let base: Promise<void> | null = null;

  const ready = computed(() => course.value !== null && lang.value !== '');
  const catalog = computed(() => normalizeCatalog(buildCatalog(course.value ?? {}, pack.value.catalog, lang.value)));
  const ui = computed(() => pack.value.ui);
  const t = computed(() => createT(pack.value.ui));
  const find = (id: string): Lesson | null => findLesson(catalog.value, id);

  function loadBase(): Promise<void> {
    base ??= Promise.all([getJson<LocalesIndex>('locales/index.json'), getJson<Course>('course.json')])
      .then(([l, c]) => { locales.value = l; course.value = c; })
      .catch((e: unknown) => { base = null; throw e; });
    return base;
  }

  function loadPack(code: string): Promise<LanguagePack> {
    let p = packs.get(code);
    if (!p) {
      p = Promise.all([getJson<UiStrings>(`locales/${code}/ui.json`), getJson<LocaleCatalog>(`locales/${code}/catalog.json`)])
        .then(([u, c]) => ({ ui: u, catalog: c }));
      p.catch(() => packs.delete(code));
      packs.set(code, p);
    }
    return p;
  }

  // Loads a language; an unknown or empty code falls back to the default language.
  async function load(requested: string): Promise<void> {
    try {
      await loadBase();
      const index = locales.value as LocalesIndex;
      const code = index.available.includes(requested) ? requested : index.default;
      if (code !== lang.value) {
        pack.value = await loadPack(code);
        lang.value = code;
      }
      error.value = false;
    } catch (e) {
      error.value = true;
      throw e;
    }
  }

  return { lang, locales, course, error, ready, catalog, ui, t, find, load };
});
