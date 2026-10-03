// The browser's localStorage, or null when it is unavailable (private mode, blocked site data).
import type { StorageBackend } from '../types/index.ts';

export function browserStorage(): StorageBackend | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

// The sync code of this device, kept apart from progress (it is never synced itself).
const SYNC_KEY = 'quadern-sync';

export const syncCodeStorage = {
  read(): string | null {
    try { return (JSON.parse(browserStorage()?.getItem(SYNC_KEY) ?? 'null') as { code?: string } | null)?.code ?? null; } catch { return null; }
  },
  write(code: string): void {
    try { browserStorage()?.setItem(SYNC_KEY, JSON.stringify({ code })); } catch { /* storage unavailable */ }
  },
  clear(): void {
    try { (browserStorage() as Storage | null)?.removeItem(SYNC_KEY); } catch { /* storage unavailable */ }
  },
};
