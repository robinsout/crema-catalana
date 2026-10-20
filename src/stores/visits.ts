// Visit counting (robinsout/counter): page views, chapters read, exercise results, listening, sync.
// Each event is built by services/visits.ts from fixed ids; repeats within a visit are not sent again.
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { countVisit, setVisitsOff, visitsOff, type VisitEventName } from '../services/visits.ts';
import { useCatalogStore } from './catalog.ts';

export const useVisitsStore = defineStore('visits', () => {
  const off = ref(visitsOff());
  const once = new Set<string>();

  function send(name: VisitEventName, props: Record<string, unknown>, onceKey?: string): void {
    if (off.value) return;
    if (onceKey !== undefined) {
      if (once.has(onceKey)) return;
      once.add(onceKey);
    }
    countVisit(name, { ...props, lang: useCatalogStore().lang });
  }

  const view = (page: string) => send('view', { page });
  const chapter = (lesson: string, chapter: string) => send('chapter', { lesson, chapter }, `chapter:${lesson}/${chapter}`);
  function exercise(key: string, score: number, total: number): void {
    const [lesson, id] = key.split('/');
    send('exercise', { lesson, exercise: id, score, total });
  }
  const audio = (lesson: string) => send('audio', { lesson }, `audio:${lesson}`);
  const syncOn = () => send('sync', {});

  function setOff(value: boolean): void {
    setVisitsOff(value);
    off.value = value;
  }

  return { off, setOff, view, chapter, exercise, audio, syncOn };
});
