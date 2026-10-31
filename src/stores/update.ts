// A new version of the site arrived while the page is open (the service worker said so): the page
// offers a reload. Without it, the next visit opens the new version.
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { registerServiceWorker, reloadPage } from '../services/offline.ts';

export const useUpdateStore = defineStore('update', () => {
  const available = ref(false);
  let started = false;

  function start(): void {
    if (started) return;
    started = true;
    registerServiceWorker(() => { available.value = true; });
  }

  const reload = (): void => reloadPage();

  return { available, start, reload };
});
