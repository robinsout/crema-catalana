// Sync of this device: the code, the state shown in the interface, and when to sync.
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import {
  clearSyncCode, forgetRemoteProgress, formatCode, generateCode, parseCode, savedSyncCode, saveSyncCode,
  syncFailure, syncProgress, type SyncFailure,
} from '../services/sync.ts';
import { useProgressStore } from './progress.ts';

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'error';

const AFTER_CHANGE_MS = 1500; // a burst of changes is sent once

export const useSyncStore = defineStore('sync', () => {
  const progress = useProgressStore();
  const code = ref<string | null>(savedSyncCode());
  const running = ref(false);
  const failure = ref<SyncFailure | null>(null);
  const lastSyncAt = ref<number | null>(null);
  let again = false;
  let applying = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const enabled = computed(() => code.value !== null);
  const displayCode = computed(() => (code.value ? formatCode(code.value) : ''));
  const status = computed<SyncStatus>(() =>
    !code.value ? 'off' : running.value ? 'syncing' : failure.value ? 'error' : lastSyncAt.value ? 'ok' : 'syncing');

  async function syncNow(): Promise<void> {
    if (!code.value) return;
    if (running.value) { again = true; return; }
    running.value = true;
    try {
      do {
        again = false;
        const merged = await syncProgress(code.value, progress.data);
        applying = true;
        progress.applySynced(merged);
        applying = false;
        failure.value = null;
        lastSyncAt.value = Date.now();
      } while (again && code.value);
    } catch (e) {
      failure.value = syncFailure(e);
    } finally {
      applying = false;
      running.value = false;
    }
  }

  // changes made on this device go out shortly after
  watch(() => [progress.data.done, progress.data.doneAt, progress.data.exercises], () => {
    if (!code.value || applying) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void syncNow(); }, AFTER_CHANGE_MS);
  }, { deep: true });

  async function enable(): Promise<void> {
    code.value = generateCode();
    saveSyncCode(code.value);
    await syncNow();
  }

  // joins the sync of another device; false when the code is wrong
  async function link(input: string): Promise<boolean> {
    const parsed = parseCode(input);
    if (!parsed) return false;
    code.value = parsed;
    saveSyncCode(parsed);
    lastSyncAt.value = null;
    await syncNow();
    return true;
  }

  function disable(): void {
    code.value = null;
    failure.value = null;
    lastSyncAt.value = null;
    clearSyncCode();
  }

  // deletes the shared copy on the server; every device keeps its own progress
  async function forgetEverywhere(): Promise<void> {
    if (code.value) await forgetRemoteProgress(code.value);
    disable();
  }

  // on start, when the tab comes back and when the network returns
  let started = false;
  function start(): void {
    if (started) return;
    started = true;
    void syncNow();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void syncNow());
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void syncNow(); });
    }
  }

  return { code, enabled, displayCode, status, failure, lastSyncAt, syncNow, enable, link, disable, forgetEverywhere, start };
});
