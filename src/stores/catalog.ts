// Course data in the reader's language: catalog of lessons and interface strings.
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import {
  allLessons, buildCatalog, findLesson, lessonLabel, neighbours, normalizeCatalog, relatedExtras,
} from '../services/catalog.ts';
import { loadCourseBase, loadLanguagePack, pickLanguage, type CourseBase, type LanguagePack } from '../services/content.ts';
import { createT } from '../services/i18n.ts';
import type { Lesson } from '../types/index.ts';

export const useCatalogStore = defineStore('catalog', () => {
  const lang = ref('');
  const base = shallowRef<CourseBase | null>(null);
  const pack = shallowRef<LanguagePack>({ ui: {}, catalog: {} });
  const error = ref(false);
  const packs = new Map<string, Promise<LanguagePack>>();
  let basePromise: Promise<CourseBase> | null = null;

  const ready = computed(() => base.value !== null && lang.value !== '');
  const catalog = computed(() => normalizeCatalog(buildCatalog(base.value?.course ?? {}, pack.value.catalog, lang.value)));
  const ui = computed(() => pack.value.ui);
  const t = computed(() => createT(pack.value.ui));

  // views of the catalog for the interface
  const lessons = computed(() => allLessons(catalog.value));
  const extras = computed(() => lessons.value.filter((l) => l.track === 'extra'));
  const unitsOf = (partId: string): Lesson[] => lessons.value.filter((l) => l.track === 'unit' && l.part.id === partId);
  const find = (id: string): Lesson | null => findLesson(catalog.value, id);
  const relatedTo = (unitId: string): Lesson[] => relatedExtras(catalog.value, unitId);
  const neighboursOf = (id: string) => neighbours(catalog.value, id);
  const label = (lesson: Lesson): string => lessonLabel(lesson, t.value);

  function loadBase(): Promise<CourseBase> {
    basePromise ??= loadCourseBase().catch((e: unknown) => { basePromise = null; throw e; });
    return basePromise;
  }

  function loadPack(code: string): Promise<LanguagePack> {
    let p = packs.get(code);
    if (!p) {
      p = loadLanguagePack(code);
      p.catch(() => packs.delete(code));
      packs.set(code, p);
    }
    return p;
  }

  // Loads a language; an unknown or empty code falls back to the default language.
  async function load(requested: string): Promise<void> {
    try {
      base.value = await loadBase();
      const code = pickLanguage(base.value.locales, requested);
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

  return {
    lang, error, ready, catalog, ui, t,
    lessons, extras, unitsOf, find, relatedTo, neighboursOf, label, load,
  };
});
