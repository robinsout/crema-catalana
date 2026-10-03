// Reading progress of this browser. A thin reactive layer over lib/storage.ts, which owns the
// saved format and its compatibility contract (no persistence plugins: they would change it).
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { PLAN_ID } from '../lib/model.ts';
import { loadProgress, markDone, saveProgress, type StorageBackend } from '../lib/storage.ts';

function browserStorage(): StorageBackend | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export const useProgressStore = defineStore('progress', () => {
  const backend = browserStorage();
  const data = ref(loadProgress(backend));
  const save = () => saveProgress(backend, data.value);

  const done = computed(() => data.value.done);
  const last = computed(() => data.value.last);
  const isDone = (id: string): boolean => data.value.done[id] === true;

  function toggleDone(id: string): boolean {
    const value = markDone(data.value, id, !isDone(id), Date.now());
    save();
    return value;
  }

  function setLast(id: string | typeof PLAN_ID): void {
    if (data.value.last === id) return;
    data.value.last = id;
    save();
  }

  return { data, done, last, isDone, toggleDone, setLast };
});
