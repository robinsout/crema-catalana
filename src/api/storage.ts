// The browser's localStorage, or null when it is unavailable (private mode, blocked site data).
import type { StorageBackend } from '../types/index.ts';

export function browserStorage(): StorageBackend | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

// Sync of this device: its code and when it last synced, kept apart from progress (never synced itself).
const SYNC_KEY = 'quadern-sync';

export interface SyncRecord {
  code: string;
  lastSyncAt?: number;
}

export const syncStorage = {
  read(): SyncRecord | null {
    try {
      const r = JSON.parse(browserStorage()?.getItem(SYNC_KEY) ?? 'null') as Partial<SyncRecord> | null;
      return r && typeof r.code === 'string'
        ? { code: r.code, ...(typeof r.lastSyncAt === 'number' ? { lastSyncAt: r.lastSyncAt } : {}) }
        : null;
    } catch { return null; }
  },
  write(record: SyncRecord): void {
    try { browserStorage()?.setItem(SYNC_KEY, JSON.stringify(record)); } catch { /* storage unavailable */ }
  },
  clear(): void {
    try { (browserStorage() as Storage | null)?.removeItem(SYNC_KEY); } catch { /* storage unavailable */ }
  },
};
