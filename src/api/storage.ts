// The browser's localStorage, or null when it is unavailable (private mode, blocked site data).
import type { StorageBackend } from '../types/index.ts';

export function browserStorage(): StorageBackend | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
