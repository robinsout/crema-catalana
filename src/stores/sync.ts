// Sync of this device. It runs only when the reader asks (turn on, join, "sync now"):
// no background requests.
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  clearSync, forgetRemoteProgress, formatCode, generateCode, isFramed, parseCode, savedSync, saveSync,
  syncFailure, syncProgress, type SyncFailure,
} from '../services/sync.ts';
import { useProgressStore } from './progress.ts';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'ok' | 'error';

export const useSyncStore = defineStore('sync', () => {
  const progress = useProgressStore();
  const saved = savedSync();
  const code = ref<string | null>(saved?.code ?? null);
  const lastSyncAt = ref<number | null>(saved?.lastSyncAt ?? null);
  const running = ref(false);
  const failure = ref<SyncFailure | null>(null);
  // a code from a QR link waits here for the reader's "join": it is not kept in the address
  const incoming = ref<string | null>(null);
  // shown inside a frame of another page: every action is refused (clickjacking)
  const framed = ref(isFramed());
  const allowed = () => !(framed.value = isFramed());

  const enabled = computed(() => code.value !== null);
  const displayCode = computed(() => (code.value ? formatCode(code.value) : ''));
  const status = computed<SyncStatus>(() => {
    if (!code.value) return 'off';
    if (running.value) return 'syncing';
    if (failure.value) return 'error';
    return lastSyncAt.value ? 'ok' : 'idle';
  });

  async function syncNow(): Promise<void> {
    if (!code.value || running.value || !allowed()) return;
    running.value = true;
    try {
      progress.applySynced(await syncProgress(code.value, progress.data));
      failure.value = null;
      lastSyncAt.value = Date.now();
      saveSync(code.value, lastSyncAt.value);
    } catch (e) {
      failure.value = syncFailure(e);
    } finally {
      running.value = false;
    }
  }

  async function enable(): Promise<void> {
    if (!allowed()) return;
    code.value = generateCode();
    lastSyncAt.value = null;
    saveSync(code.value, null);
    await syncNow();
  }

  // joins the sync of another device; false when the code is wrong
  async function link(input: string): Promise<boolean> {
    const parsed = parseCode(input);
    if (!parsed || !allowed()) return false;
    incoming.value = null;
    code.value = parsed;
    lastSyncAt.value = null;
    failure.value = null;
    saveSync(parsed, null);
    await syncNow();
    return true;
  }

  function disable(): void {
    if (!allowed()) return;
    code.value = null;
    failure.value = null;
    lastSyncAt.value = null;
    clearSync();
  }

  // deletes the shared copy on the server; every device keeps its own progress
  async function forgetEverywhere(): Promise<void> {
    if (!allowed()) return;
    if (code.value) await forgetRemoteProgress(code.value);
    disable();
  }

  function offer(input: string): void {
    incoming.value = input;
  }

  return { code, incoming, framed, offer, enabled, displayCode, status, failure, lastSyncAt, syncNow, enable, link, disable, forgetEverywhere };
});
