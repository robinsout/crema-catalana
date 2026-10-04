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
//   v5      + sections: { "<lesson>/<section>": { done, at } } — chapters marked as studied
//           + reading: { "<lesson>": { section, at } } — the furthest chapter the reader got to
//           + lastLesson: id — the last lesson opened (`last` may be the plan); stays on the device
//   v6      + locale: language code of the last page opened; stays on the device

import { browserStorage } from '../api/storage.ts';
import type { ExerciseResult, ReadingPoint, SectionMark, StorageBackend } from '../types/index.ts';

export const STORAGE_KEY = 'quadern-catala';

export const ID_ALIASES: Record<string, string> = {
  l01: 'intro', // v1: the intro lesson was "l01"
};

export interface Progress {
  done: Record<string, boolean>;
  doneAt: Record<string, number>;
  exercises: Record<string, ExerciseResult>;
  sections: Record<string, SectionMark>;
  reading: Record<string, ReadingPoint>;
  last: string | null;
  lastLesson?: string;
  locale?: string;
  [field: string]: unknown; // fields written by future versions are kept
}

export type { StorageBackend };

export const canonicalId = (id: string): string => (Object.hasOwn(ID_ALIASES, id) ? ID_ALIASES[id]! : id);

// Lesson and exercise ids: lowercase latin letters, digits and dashes. Saved and synced progress
// is untrusted, so keys of any other shape (__proto__, constructor, …) are dropped when it is read.
export const isLessonId = (id: string): boolean => /^[a-z0-9][a-z0-9-]*$/.test(id) && !(id in Object.prototype);
// "ru", "en", "pt-br"
export const isLanguageCode = (code: string): boolean => /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(code);
// "<lesson>/<exercise>" and "<lesson>/<section>"
const isLessonPartKey = (key: string): boolean => {
  const [lesson, exercise, ...rest] = key.split('/');
  return rest.length === 0 && exercise !== undefined && isLessonId(lesson!) && isLessonId(exercise);
};

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => v !== null && typeof v === 'object' && !Array.isArray(v);
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// Reads an { id: value } map, migrating old ids. Entries under old ids go first,
// so a value stored under the current id wins.
function readIdMap<T>(map: unknown, accept: (v: unknown) => T | undefined): Record<string, T> {
  const out: Record<string, T> = {};
  if (!isObject(map)) return out;
  const isAlias = (id: string) => Number(Object.hasOwn(ID_ALIASES, id));
  const entries = Object.entries(map).sort(([a], [b]) => isAlias(b) - isAlias(a));
  for (const [id, value] of entries) {
    if (!isLessonId(id)) continue;
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
      if (isLessonPartKey(key) && isObject(r) && [r.score, r.total, r.at].every((n) => typeof n === 'number' && Number.isFinite(n))) {
        exercises[key] = { score: r.score as number, total: r.total as number, at: r.at as number };
      }
    }
  }
  const sections: Record<string, SectionMark> = {};
  if (isObject(src.sections)) {
    for (const [key, m] of Object.entries(src.sections)) {
      if (isLessonPartKey(key) && isObject(m) && typeof m.done === 'boolean' && isTime(m.at)) sections[key] = { done: m.done, at: m.at };
    }
  }
  const reading = readIdMap(src.reading, (r) =>
    (isObject(r) && typeof r.section === 'string' && isLessonId(r.section) && isTime(r.at) ? { section: r.section, at: r.at } : undefined));
  const last = typeof src.last === 'string' && isLessonId(src.last) ? canonicalId(src.last) : null;
  const out: Progress = { ...src, done, doneAt, exercises, sections, reading, last };
  delete out.lastLesson;
  if (typeof src.lastLesson === 'string' && isLessonId(src.lastLesson)) out.lastLesson = canonicalId(src.lastLesson);
  delete out.locale;
  if (typeof src.locale === 'string' && isLanguageCode(src.locale)) out.locale = src.locale;
  return out;
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

// Marks a chapter ("<lesson>/<section>") as studied or not. Mutates `state`.
export function markSection(state: Progress, key: string, value: boolean, at: number): boolean {
  state.sections[key] = { done: value, at };
  return value;
}

// Moves the reading point of a lesson to `section` when it is further in `order` (the chapters of
// the lesson) than the saved one, so going back to re-read a chapter keeps the place. A saved
// chapter that is no longer in the lesson is replaced. Mutates `state`; returns whether it moved.
export function recordReading(state: Progress, lesson: string, section: string, order: string[], at: number): boolean {
  const next = order.indexOf(section);
  if (next < 0) return false;
  const saved = state.reading[lesson];
  if (saved && order.indexOf(saved.section) >= next) return false;
  state.reading[lesson] = { section, at };
  return true;
}

// Sets a done mark and stamps the time of the change. Mutates `state` (it may be a reactive store).
export function markDone(state: Progress, id: string, value: boolean, at: number): boolean {
  state.done[id] = value === true;
  state.doneAt[id] = at;
  return state.done[id];
}

// Merges progress from another device into the local one. For each lesson the later change
// wins; a mark without a timestamp (saved before v3) counts as the oldest; on a tie "done" wins.
// `last`, `lastLesson`, `locale` and any other fields stay local: they describe this device.
export function mergeProgress(local: Partial<Progress>, remote: Partial<Progress>): Progress {
  const ld = local.done ?? {};
  const rd = remote.done ?? {};
  const lt = local.doneAt ?? {};
  const rt = remote.doneAt ?? {};
  const done: Record<string, boolean> = {};
  const doneAt: Record<string, number> = {};
  for (const id of new Set([...Object.keys(ld), ...Object.keys(rd)])) {
    const a = { done: ld[id] === true, at: Object.hasOwn(lt, id) ? lt[id]! : -1, has: Object.hasOwn(ld, id) };
    const b = { done: rd[id] === true, at: Object.hasOwn(rt, id) ? rt[id]! : -1, has: Object.hasOwn(rd, id) };
    const win = !b.has ? a : !a.has ? b
      : a.at > b.at ? a : b.at > a.at ? b
      : (a.done ? a : b);
    done[id] = win.done;
    if (win.at >= 0) doneAt[id] = win.at;
  }
  return { last: null, ...local, done, doneAt,
    exercises: laterWins(local.exercises, remote.exercises, () => true),
    sections: laterWins(local.sections, remote.sections, (a, b) => a.done || !b.done),
    reading: laterWins(local.reading, remote.reading, () => true) };
}

// Per key the entry with the later `at` wins; on a tie `localWinsTie(local, remote)` decides.
function laterWins<T extends { at: number }>(local: Record<string, T> = {}, remote: Record<string, T> = {},
  localWinsTie: (a: T, b: T) => boolean): Record<string, T> {
  const out: Record<string, T> = { ...remote };
  for (const [key, a] of Object.entries(local)) {
    const b = Object.hasOwn(out, key) ? out[key] : undefined;
    if (!b || a.at > b.at || (a.at === b.at && localWinsTie(a, b))) out[key] = a;
  }
  return out;
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
