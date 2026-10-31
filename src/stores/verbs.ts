// The verb reference in the current language: verbs, their translations and the search index.
// The list shows as soon as the small file of infinitives is there; the forms (search by a form,
// a verb page) follow. The forms and the list are the same in every language and load once.
import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { loadVerbData, loadVerbList, loadVerbTranslations } from '../services/content.ts';
import {
  conjugate, DEFAULT_TENSES, IMPERATIVE_PERSONS, listIndex, MOODS, nonPersonal, PERSONS, searchVerbs, TENSES, verbIndex,
  type SearchIndex, type VerbIndex, type VerbSummary,
} from '../services/verbs.ts';
import type { VerbListData, VerbsData } from '../types/index.ts';

type State<T> = { state: 'loading' } | { state: 'ready'; index: T } | { state: 'error' };
export type VerbsState = State<VerbIndex>;
export type VerbListState = State<SearchIndex<VerbSummary>>;

export const useVerbsStore = defineStore('verbs', () => {
  const current = shallowRef<VerbsState>({ state: 'loading' }); // with the forms: verb pages
  const list = shallowRef<VerbListState>({ state: 'loading' }); // the list page
  // the tense choice is open (the right column and the chapters panel open it)
  const settingsOpen = ref(false);
  let lang = '';
  let pending: Promise<void> | null = null;
  let data: Promise<VerbsData> | null = null;
  let infinitives: Promise<VerbListData> | null = null;

  // loaded once for every language; a failed load is tried again next time
  function once<T>(get: () => Promise<T>, drop: () => void): Promise<T> {
    const p = get();
    p.catch(drop);
    return p;
  }

  function load(language: string): Promise<void> {
    if (language === lang && pending) return pending;
    lang = language;
    current.value = { state: 'loading' };
    list.value = { state: 'loading' };
    const mine = <T>(f: (x: T) => void) => (x: T) => { if (lang === language) f(x); };
    const tr = loadVerbTranslations(language);
    data ??= once(loadVerbData, () => { data = null; });
    infinitives ??= once(loadVerbList, () => { infinitives = null; });
    // without the list file the list waits for the full reference
    Promise.all([infinitives, tr]).then(mine(([l, t]) => {
      if (list.value.state === 'loading') list.value = { state: 'ready', index: listIndex(l, t) };
    }), () => {});
    pending = Promise.all([data, tr]).then(
      mine(([d, t]) => {
        const index = verbIndex(d, t);
        current.value = { state: 'ready', index };
        list.value = { state: 'ready', index };
      }),
      mine(() => {
        current.value = { state: 'error' };
        if (list.value.state === 'loading') list.value = { state: 'error' };
        pending = null;
      }),
    );
    return pending;
  }

  const index = (): VerbIndex | null => (current.value.state === 'ready' ? current.value.index : null);
  const search = (query: string) => (list.value.state === 'ready' ? searchVerbs(list.value.index, query) : []);
  const find = (id: string) => index()?.byId.get(id) ?? null;

  // the grammar of the reference, for the pages
  return { current, list, settingsOpen, load, search, find, conjugate, nonPersonal,
    tenses: TENSES, moods: MOODS, defaultTenses: DEFAULT_TENSES, persons: PERSONS, imperativePersons: IMPERATIVE_PERSONS };
});
