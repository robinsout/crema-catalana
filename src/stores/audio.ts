// Pronunciation clips: the shared audio index, loaded once.
import { defineStore } from 'pinia';
import { computed, shallowRef } from 'vue';
import { clipFor } from '../services/audio.ts';
import { loadAudioIndex } from '../services/content.ts';
import type { AudioIndex } from '../types/index.ts';

export const useAudioStore = defineStore('audio', () => {
  const index = shallowRef<AudioIndex | null>(null);
  let loading: Promise<void> | null = null;

  const available = computed(() => index.value !== null);
  const clip = (text: string | null | undefined): string | null => {
    const file = clipFor(index.value, text);
    return file ? `audio/${file}` : null;
  };

  function load(): Promise<void> {
    loading ??= loadAudioIndex().then((i) => { index.value = i; });
    return loading;
  }

  return { available, clip, load };
});
