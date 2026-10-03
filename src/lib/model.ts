// Lesson catalog: two tracks.
//   units  — one lesson per unit of the course book (parts → units)
//   extras — topic and overview lessons requested on top of the course
//
// Data lives in two layers: course.json (structure: ids, units, links, Catalan titles — the same
// for every language) and locales/<lang>/catalog.json (texts in the reader's language and which
// lessons are written in it). buildCatalog merges them.
import { canonicalId } from './storage.ts';
import type { Catalog, Course, Lesson, LessonData, LocaleCatalog, Part, Translate } from './types.ts';

export const PLAN_ID = 'pla';
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export const lessonPath = (lang: string, id: string): string => `locales/${lang}/lessons/${id}.html`;

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v: unknown): Loose[] => (Array.isArray(v) ? v.filter(isObject) : []);

// Structure wins over texts: a language can add texts but never change ids, units or links.
export function buildCatalog(course: Partial<Course>, locale: LocaleCatalog | null | undefined, lang: string): Catalog {
  const loc = locale || {};
  const texts = loc.lessons || {};
  const lesson = <T extends { id: string }>(l: T): LessonData => {
    const own = texts[l.id] || {};
    const merged = { ...own, ...l } as unknown as LessonData;
    if (own.date) merged.file = lessonPath(lang, l.id);
    return merged;
  };
  return {
    course: { ...(course.course || {}), ...(loc.course || {}) },
    extras: (course.extras || []).map(lesson),
    parts: (course.parts || []).map((p) => ({
      ...((loc.parts || {})[p.id] || {}),
      ...p,
      units: (p.units || []).map(lesson),
    })),
  };
}

// Accepts any JSON (data is checked by validateCatalog in tests) and fills in defaults.
export function normalizeCatalog(json: unknown): Catalog {
  const src: Loose = isObject(json) ? json : {};
  const extras = list(src.extras);
  // legacy shape: a single `intro` lesson outside the extras list
  const intro = src.intro;
  if (isObject(intro) && !extras.some((x) => x.id === intro.id)) {
    extras.unshift({ kind: 'overview', ...intro });
  }
  return {
    course: isObject(src.course) ? src.course : {},
    extras: extras.map((x) => ({ kind: 'topic', ...x }) as unknown as LessonData),
    parts: list(src.parts).map((p) => ({ ...p, units: list(p.units) }) as unknown as Part),
  };
}

export function allLessons(catalog: Catalog): Lesson[] {
  const extras: Lesson[] = catalog.extras.map((x) => ({ ...x, track: 'extra' as const }));
  const units: Lesson[] = catalog.parts.flatMap((p) => p.units.map((u) => ({ ...u, track: 'unit' as const, part: p })));
  return extras.concat(units);
}

export const readyLessons = (catalog: Catalog): Lesson[] => allLessons(catalog).filter((l) => l.file);

export function findLesson(catalog: Catalog, id: string): Lesson | null {
  const key = canonicalId(id);
  return allLessons(catalog).find((l) => l.id === key) || null;
}

export type Route = { view: 'lesson'; id: string } | { view: 'plan'; focus: string | null };

export function resolveRoute(catalog: Catalog, hash: string, last: string | null): Route {
  const id = hash || last || PLAN_ID;
  const lesson = id === PLAN_ID ? null : findLesson(catalog, id);
  if (lesson && lesson.file) return { view: 'lesson', id: lesson.id };
  return { view: 'plan', focus: lesson ? lesson.id : null };
}

export interface ProgressSummary {
  done: number;
  ready: number;
  total: number;
}

export function progress(catalog: Catalog, done: Record<string, boolean> | null | undefined): ProgressSummary {
  const ready = readyLessons(catalog);
  return {
    done: ready.filter((l) => done?.[l.id] === true).length,
    ready: ready.length,
    total: allLessons(catalog).length,
  };
}

export function neighbours(catalog: Catalog, id: string): { prev: Lesson | null; next: Lesson | null } {
  const lesson = findLesson(catalog, id);
  if (!lesson) return { prev: null, next: null };
  const same = readyLessons(catalog).filter((l) => l.track === lesson.track);
  const i = same.findIndex((l) => l.id === lesson.id);
  return { prev: same[i - 1] ?? null, next: i >= 0 ? (same[i + 1] ?? null) : null };
}

export function lessonLabel(lesson: Lesson, t: Translate): string {
  if (lesson.track === 'unit') return t('label.unit', { part: lesson.part.title, unit: lesson.unit ?? '' });
  return lesson.kind === 'overview' ? t('label.overview') : t('label.topic');
}

export const relatedExtras = (catalog: Catalog, unitId: string): Lesson[] =>
  allLessons(catalog).filter((l) => l.track === 'extra' && Array.isArray(l.related) && l.related.includes(unitId));

export function validateCatalog(catalog: Catalog): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const unitIds = new Set(catalog.parts.flatMap((p) => p.units.map((u) => u.id)));
  for (const l of allLessons(catalog)) {
    const where = l.id ? `"${l.id}"` : `(${l.track} "${l.title || '?'}")`;
    if (!l.id) errors.push(`${where}: missing id`);
    else if (!ID_RE.test(l.id)) errors.push(`${where}: id must be lowercase letters, digits and dashes`);
    else if (l.id === PLAN_ID) errors.push(`${where}: id is reserved`);
    else if (seen.has(l.id)) errors.push(`duplicate id "${l.id}"`);
    if (l.id) seen.add(l.id);
    if (!l.title) errors.push(`${where}: missing title`);
    if (l.track === 'unit' && !Number.isInteger(l.unit)) errors.push(`${where}: unit number missing`);
    if (l.track === 'extra' && !['topic', 'overview'].includes(l.kind ?? '')) errors.push(`${where}: kind must be topic or overview`);
    for (const r of l.related || []) if (!unitIds.has(r)) errors.push(`${where}: related unit "${r}" not found`);
  }
  return errors;
}
