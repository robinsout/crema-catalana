// The verb reference in the current language: verbs, their translations and the search index.
import { defineStore } from 'pinia';
import { shallowRef } from 'vue';
import { loadVerbs } from '../services/content.ts';
import { conjugate, DEFAULT_TENSES, IMPERATIVE_PERSONS, MOODS, nonPersonal, PERSONS, searchVerbs, TENSES, type VerbIndex } from '../services/verbs.ts';

export type VerbsState = { state: 'loading' } | { state: 'ready'; index: VerbIndex } | { state: 'error' };

export const useVerbsStore = defineStore('verbs', () => {
  const current = shallowRef<VerbsState>({ state: 'loading' });
  let lang = '';
  let pending: Promise<void> | null = null;

  function load(language: string): Promise<void> {
    if (language === lang && pending) return pending;
    lang = language;
    current.value = { state: 'loading' };
    pending = loadVerbs(language).then(
      (index) => { if (lang === language) current.value = { state: 'ready', index }; },
      () => { if (lang === language) { current.value = { state: 'error' }; pending = null; } },
    );
    return pending;
  }

  const index = (): VerbIndex | null => (current.value.state === 'ready' ? current.value.index : null);
  const search = (query: string) => { const i = index(); return i ? searchVerbs(i, query) : []; };
  const find = (id: string) => index()?.byId.get(id) ?? null;

  // the grammar of the reference, for the pages
  return { current, load, search, find, conjugate, nonPersonal,
    tenses: TENSES, moods: MOODS, defaultTenses: DEFAULT_TENSES, persons: PERSONS, imperativePersons: IMPERATIVE_PERSONS };
});
