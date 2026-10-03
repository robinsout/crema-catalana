// Reading progress of this browser: reactive state over services/progress.ts, which owns the
// saved format and its compatibility contract (no persistence plugins: they would change it).
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { PLAN_ID, progress as summarize } from '../services/catalog.ts';
import { markDone, readSavedProgress, recordExercise, writeSavedProgress } from '../services/progress.ts';
import type { ExerciseResult } from '../types/index.ts';
import { useCatalogStore } from './catalog.ts';

export const useProgressStore = defineStore('progress', () => {
  const data = ref(readSavedProgress());
  const save = () => writeSavedProgress(data.value);

  const done = computed(() => data.value.done);
  const last = computed(() => data.value.last);
  const isDone = (id: string): boolean => data.value.done[id] === true;
  // lessons done / written / planned in the current language
  const summary = computed(() => summarize(useCatalogStore().catalog, data.value.done));

  function toggleDone(id: string): boolean {
    const value = markDone(data.value, id, !isDone(id), Date.now());
    save();
    return value;
  }

  const result = (key: string): ExerciseResult | null => data.value.exercises[key] ?? null;

  function saveResult(key: string, score: number, total: number): void {
    recordExercise(data.value, key, score, total, Date.now());
    save();
  }

  function setLast(id: string | typeof PLAN_ID): void {
    if (data.value.last === id) return;
    data.value.last = id;
    save();
  }

  return { data, done, last, summary, isDone, toggleDone, setLast, result, saveResult };
});
