// Progress saved in the viewer's browser.
//
// Compatibility contract: the key and the { done: {id: bool}, last: id } shape never change.
// New data goes into new fields; unknown fields are kept on save. A renamed lesson id is
// added to ID_ALIASES, and old saved data is migrated when it is read.
//
// Versions of the saved data:
//   v1, v2  { done, last }
//   v3      + doneAt: { id: ms timestamp of the last change of done[id] } — used to merge devices
//   v4      + exercises: { "<lesson>/<exercise>": { score, total, at } } — the latest result

import { browserStorage } from '../api/storage.ts';
import type { ExerciseResult, StorageBackend } from '../types/index.ts';

export const STORAGE_KEY = 'quadern-catala';

export const ID_ALIASES: Record<string, string> = {
  l01: 'intro', // v1: the intro lesson was "l01"
};

export interface Progress {
  done: Record<string, boolean>;
  doneAt: Record<string, number>;
  exercises: Record<string, ExerciseResult>;
  last: string | null;
  [field: string]: unknown; // fields written by future versions are kept
}

export type { StorageBackend };

export const canonicalId = (id: string): string => ID_ALIASES[id] ?? id;

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => v !== null && typeof v === 'object' && !Array.isArray(v);

// Reads an { id: value } map, migrating old ids. Entries under old ids go first,
// so a value stored under the current id wins.
function readIdMap<T>(map: unknown, accept: (v: unknown) => T | undefined): Record<string, T> {
  const out: Record<string, T> = {};
  if (!isObject(map)) return out;
  const entries = Object.entries(map).sort(([a], [b]) => Number(b in ID_ALIASES) - Number(a in ID_ALIASES));
  for (const [id, value] of entries) {
    const v = accept(value);
    if (v !== undefined) out[canonicalId(id)] = v;
  }
  return out;
}

export function parseProgress(raw: string | null | undefined): Progress {
  let data: unknown = null;
  try { data = JSON.parse(raw ?? ''); } catch { data = null; }
  const src: Loose = isObject(data) ? data : {};

  const done = readIdMap(src.done, (v) => v === true);
  const doneAt = readIdMap(src.doneAt, (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined));
  const exercises: Record<string, ExerciseResult> = {};
  if (isObject(src.exercises)) {
    for (const [key, r] of Object.entries(src.exercises)) {
      if (isObject(r) && [r.score, r.total, r.at].every((n) => typeof n === 'number' && Number.isFinite(n))) {
        exercises[key] = { score: r.score as number, total: r.total as number, at: r.at as number };
      }
    }
  }
  const last = typeof src.last === 'string' && src.last ? canonicalId(src.last) : null;
  return { ...src, done, doneAt, exercises, last };
}

export function serializeProgress(state: Partial<Progress>): string {
  return JSON.stringify(state);
}

export function loadProgress(backend: StorageBackend | null | undefined): Progress {
  let raw: string | null = null;
  try { raw = backend ? backend.getItem(STORAGE_KEY) : null; } catch { raw = null; }
  return parseProgress(raw);
}

export function saveProgress(backend: StorageBackend | null | undefined, state: Progress): void {
  try { if (backend) backend.setItem(STORAGE_KEY, serializeProgress(state)); } catch { /* storage unavailable */ }
}

// Saves the latest result of an exercise. Mutates `state`.
export function recordExercise(state: Progress, key: string, score: number, total: number, at: number): void {
  state.exercises[key] = { score, total, at };
}

// Sets a done mark and stamps the time of the change. Mutates `state` (it may be a reactive store).
export function markDone(state: Progress, id: string, value: boolean, at: number): boolean {
  state.done[id] = value === true;
  state.doneAt[id] = at;
  return state.done[id];
}

// Merges progress from another device into the local one. For each lesson the later change
// wins; a mark without a timestamp (saved before v3) counts as the oldest; on a tie "done" wins.
// `last` and any other fields stay local: they describe this device.
export function mergeProgress(local: Partial<Progress>, remote: Partial<Progress>): Progress {
  const ld = local.done ?? {};
  const rd = remote.done ?? {};
  const lt = local.doneAt ?? {};
  const rt = remote.doneAt ?? {};
  const done: Record<string, boolean> = {};
  const doneAt: Record<string, number> = {};
  for (const id of new Set([...Object.keys(ld), ...Object.keys(rd)])) {
    const a = { done: ld[id] === true, at: lt[id] ?? -1, has: id in ld };
    const b = { done: rd[id] === true, at: rt[id] ?? -1, has: id in rd };
    const win = !b.has ? a : !a.has ? b
      : a.at > b.at ? a : b.at > a.at ? b
      : (a.done ? a : b);
    done[id] = win.done;
    if (win.at >= 0) doneAt[id] = win.at;
  }
  const exercises: Record<string, ExerciseResult> = { ...(remote.exercises ?? {}) };
  for (const [key, r] of Object.entries(local.exercises ?? {})) {
    const other = exercises[key];
    if (!other || r.at >= other.at) exercises[key] = r;
  }
  return { last: null, ...local, done, doneAt, exercises };
}

// Progress of this browser (the Pinia store keeps it reactive)
export const readSavedProgress = (): Progress => loadProgress(browserStorage());
export const writeSavedProgress = (state: Progress): void => saveProgress(browserStorage(), state);

// Plain (non-reactive) store with an injected backend, used by tests and scripts.
export function createStore(backend: StorageBackend | null | undefined, { now = () => Date.now() } = {}) {
  const state = loadProgress(backend);
  return {
    state,
    setDone(id: string, value: boolean) { markDone(state, id, value, now()); saveProgress(backend, state); },
    toggleDone(id: string) { const v = markDone(state, id, !state.done[id], now()); saveProgress(backend, state); return v; },
    setLast(id: string) { state.last = id; saveProgress(backend, state); },
  };
}
