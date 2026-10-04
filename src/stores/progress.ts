// Reading progress of this browser: reactive state over services/progress.ts, which owns the
// saved format and its compatibility contract (no persistence plugins: they would change it).
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { PLAN_ID, progress as summarize } from '../services/catalog.ts';
import { markDone, markSection, readSavedProgress, recordExercise, recordReading, writeSavedProgress, type Progress } from '../services/progress.ts';
import type { ExerciseResult } from '../types/index.ts';
import { useCatalogStore } from './catalog.ts';

export const useProgressStore = defineStore('progress', () => {
  const data = ref(readSavedProgress());
  const save = () => writeSavedProgress(data.value);

  const done = computed(() => data.value.done);
  const last = computed(() => data.value.last);
  // before v5 only the last view was saved; when it was a lesson, it is the last lesson
  const lastLesson = computed(() => data.value.lastLesson ?? (data.value.last !== PLAN_ID ? data.value.last : null));
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

  // chapters (<section id>) of a lesson: marked as studied by hand, and the furthest one read
  const isSectionDone = (lesson: string, section: string): boolean => data.value.sections[`${lesson}/${section}`]?.done === true;

  function toggleSection(lesson: string, section: string): boolean {
    const value = markSection(data.value, `${lesson}/${section}`, !isSectionDone(lesson, section), Date.now());
    save();
    return value;
  }

  const readingPoint = (lesson: string): string | null => data.value.reading[lesson]?.section ?? null;

  function reachSection(lesson: string, section: string, order: string[]): void {
    if (recordReading(data.value, lesson, section, order, Date.now())) save();
  }

  // takes marks, exercise results, chapter marks and reading points merged with other devices; `last` stays local
  function applySynced(merged: Pick<Progress, 'done' | 'doneAt' | 'exercises' | 'sections' | 'reading'>): void {
    data.value.done = merged.done;
    data.value.doneAt = merged.doneAt;
    data.value.exercises = merged.exercises;
    data.value.sections = merged.sections;
    data.value.reading = merged.reading;
    save();
  }

  function setLast(id: string | typeof PLAN_ID): void {
    if (data.value.last === id) return;
    if (id !== PLAN_ID) data.value.lastLesson = id;
    else data.value.lastLesson ??= lastLesson.value ?? undefined; // keep the lesson of data saved before v5
    data.value.last = id;
    save();
  }

  return { data, done, last, lastLesson, summary, isDone, toggleDone, setLast, result, saveResult, applySynced,
    isSectionDone, toggleSection, readingPoint, reachSection };
});
