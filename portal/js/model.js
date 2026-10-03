// Lesson catalog: two tracks.
//   units  — one lesson per unit of the course book (parts → units)
//   extras — topic and overview lessons requested on top of the course
//
// Data lives in two layers: course.json (structure: ids, units, links, Catalan titles — the same
// for every language) and locales/<lang>/catalog.json (texts in the reader's language and which
// lessons are written in it). buildCatalog merges them.
import { canonicalId } from './storage.js';

export const PLAN_ID = 'pla';
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export const lessonPath = (lang, id) => `locales/${lang}/lessons/${id}.html`;

// Structure wins over texts: a language can add texts but never change ids, units or links.
export function buildCatalog(course, locale, lang) {
  const loc = locale || {};
  const texts = loc.lessons || {};
  const lesson = (l) => {
    const own = texts[l.id] || {};
    const merged = { ...own, ...l };
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

export function normalizeCatalog(json) {
  const src = json && typeof json === 'object' ? json : {};
  const extras = Array.isArray(src.extras) ? src.extras.slice() : [];
  // legacy shape: a single `intro` lesson outside the extras list
  if (src.intro && !extras.some((x) => x.id === src.intro.id)) {
    extras.unshift({ kind: 'overview', ...src.intro });
  }
  return {
    course: src.course || {},
    extras: extras.map((x) => ({ kind: 'topic', ...x })),
    parts: Array.isArray(src.parts) ? src.parts.map((p) => ({ ...p, units: Array.isArray(p.units) ? p.units : [] })) : [],
  };
}

export function allLessons(catalog) {
  const extras = catalog.extras.map((x) => ({ ...x, track: 'extra' }));
  const units = catalog.parts.flatMap((p) => p.units.map((u) => ({ ...u, track: 'unit', part: p })));
  return extras.concat(units);
}

export const readyLessons = (catalog) => allLessons(catalog).filter((l) => l.file);

export function findLesson(catalog, id) {
  const key = canonicalId(id);
  return allLessons(catalog).find((l) => l.id === key) || null;
}

export function resolveRoute(catalog, hash, last) {
  const id = hash || last || PLAN_ID;
  const lesson = id === PLAN_ID ? null : findLesson(catalog, id);
  if (lesson && lesson.file) return { view: 'lesson', id: lesson.id };
  return { view: 'plan', focus: lesson ? lesson.id : null };
}

export function progress(catalog, done) {
  const ready = readyLessons(catalog);
  return {
    done: ready.filter((l) => done && done[l.id] === true).length,
    ready: ready.length,
    total: allLessons(catalog).length,
  };
}

export function neighbours(catalog, id) {
  const lesson = findLesson(catalog, id);
  const list = readyLessons(catalog).filter((l) => lesson && l.track === lesson.track);
  const i = list.findIndex((l) => l.id === (lesson && lesson.id));
  return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
}

export function lessonLabel(lesson, t) {
  if (lesson.track === 'unit') return t('label.unit', { part: lesson.part.title, unit: lesson.unit });
  return lesson.kind === 'overview' ? t('label.overview') : t('label.topic');
}

export const relatedExtras = (catalog, unitId) =>
  allLessons(catalog).filter((l) => l.track === 'extra' && Array.isArray(l.related) && l.related.includes(unitId));

export function validateCatalog(catalog) {
  const errors = [];
  const seen = new Set();
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
    if (l.track === 'extra' && !['topic', 'overview'].includes(l.kind)) errors.push(`${where}: kind must be topic or overview`);
    for (const r of l.related || []) if (!unitIds.has(r)) errors.push(`${where}: related unit "${r}" not found`);
  }
  return errors;
}
