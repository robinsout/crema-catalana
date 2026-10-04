// Scaffolding for content work (BACKLOG F-4): files and registrations for a new language,
// a new lesson and an adaptation, so writing them is only about the text.
// `root` is the repository root (content/, tests/, authoring/).
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cyrillicLeftovers, lessonOutline } from './lesson-check.ts';
import { withStamp } from './coverage.ts';
import type { Course, LessonKind, LocaleCatalog, LocalesIndex, UiStrings } from '../../src/types/index.ts';

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const writeJson = (path: string, data: unknown): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
};

const paths = (root: string) => ({
  index: join(root, 'content/locales/index.json'),
  course: join(root, 'content/course.json'),
  locale: (lang: string) => join(root, 'content/locales', lang),
  catalog: (lang: string) => join(root, 'content/locales', lang, 'catalog.json'),
  ui: (lang: string) => join(root, 'content/locales', lang, 'ui.json'),
  lesson: (lang: string, id: string) => join(root, 'content/locales', lang, 'lessons', `${id}.html`),
  exercises: (lang: string, id: string) => join(root, 'content/locales', lang, 'exercises', `${id}.json`),
  vocab: (lang: string, id: string) => join(root, 'content/locales', lang, 'vocab', `${id}.json`),
  profile: (lang: string) => join(root, 'authoring/profiles', `${lang}.md`),
  profileTemplate: join(root, 'authoring/PROFILE.template.md'),
  publishedIds: join(root, 'tests/published-ids.json'),
  publishedSections: join(root, 'tests/published-sections.json'),
});

const courseIds = (course: Course): string[] =>
  [...(course.extras ?? []), ...(course.parts ?? []).flatMap((p) => p.units ?? [])].map((l) => l.id ?? '');

// ---------- languages ----------

// A new language as a draft: the interface and the plan copied from the base language to translate,
// no lesson written yet, and a learner profile to fill before adapting lessons.
export function newLanguage(root: string, code: string, name: string): string[] {
  if (!/^[a-z]{2}$/.test(code)) throw new Error(`language code "${code}": two lowercase letters, like "en"`);
  const p = paths(root);
  const index = readJson<LocalesIndex>(p.index);
  if (existsSync(p.locale(code)) || index.available.includes(code)) throw new Error(`language "${code}" exists`);
  const base = index.base;
  writeJson(p.ui(code), readJson<UiStrings>(p.ui(base)));
  const catalog = readJson<LocaleCatalog>(p.catalog(base));
  for (const texts of Object.values(catalog.lessons ?? {})) delete texts.date;
  writeJson(p.catalog(code), catalog);
  mkdirSync(join(p.locale(code), 'lessons'), { recursive: true });
  if (!existsSync(p.profile(code))) {
    mkdirSync(dirname(p.profile(code)), { recursive: true });
    writeFileSync(p.profile(code), readFileSync(p.profileTemplate, 'utf8').replaceAll('{name}', name).replaceAll('{code}', code));
  }
  writeJson(p.index, { ...index, names: { ...index.names, [code]: name }, drafts: [...(index.drafts ?? []), code] });
  return [p.ui(code), p.catalog(code), p.profile(code), p.index];
}

// A draft goes to the language switcher.
export function publishLanguage(root: string, code: string): void {
  const p = paths(root);
  const index = readJson<LocalesIndex>(p.index);
  if (!index.drafts?.includes(code)) throw new Error(`"${code}" is not a draft language`);
  const left = [p.ui(code), p.catalog(code)].flatMap((file) => cyrillicLeftovers(readJson<object>(file), code).map((t) => `${file}: ${t}`));
  if (left.length) throw new Error(`Russian text left, translate it first:\n  ${left.slice(0, 20).join('\n  ')}${left.length > 20 ? `\n  … ${left.length - 20} more` : ''}`);
  const drafts = index.drafts.filter((l) => l !== code);
  const { drafts: _, ...rest } = index;
  writeJson(p.index, { ...rest, available: [...index.available, code], ...(drafts.length ? { drafts } : {}) });
}

// ---------- lessons ----------

export interface NewLesson {
  id: string;
  kind?: LessonKind; // a new topic or overview lesson (extras); a unit is already in the course
  title?: string; // Catalan title, for a new lesson
  related?: string[]; // units the lesson belongs to
  today: string; // YYYY-MM-DD: the date the lesson is published
}

const SKELETON = `<section id="tema">
<h2>1. Тема</h2>
<p>…</p>
</section>

<section id="practica">
<h2>2. Практика</h2>
<div data-exercise="ex1"></div>
</section>
`;

// The lesson in the base language: a course entry for a new topic lesson, the date, a file with chapters.
export function newLesson(root: string, lesson: NewLesson): string {
  const p = paths(root);
  const index = readJson<LocalesIndex>(p.index);
  const lang = index.base;
  const course = readJson<Course>(p.course);
  const file = p.lesson(lang, lesson.id);
  if (existsSync(file)) throw new Error(`lesson ${lesson.id} exists: ${file}`);
  if (!courseIds(course).includes(lesson.id)) {
    if (!lesson.kind || !lesson.title) throw new Error(`a new lesson needs kind and title (${lesson.id} is not in course.json)`);
    if (!/^x-[a-z0-9-]+$/.test(lesson.id)) throw new Error(`a topic lesson id looks like "x-pronoms-febles": ${lesson.id}`);
    course.extras = [...(course.extras ?? []), {
      id: lesson.id, kind: lesson.kind, title: lesson.title, ...(lesson.related?.length ? { related: lesson.related } : {}),
    }];
    writeJson(p.course, course);
  }
  const catalog = readJson<LocaleCatalog>(p.catalog(lang));
  catalog.lessons = { ...catalog.lessons, [lesson.id]: { ...(lesson.kind ? { subtitle: '…' } : {}), ...catalog.lessons?.[lesson.id], date: lesson.today } };
  writeJson(p.catalog(lang), catalog);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, SKELETON);
  return file;
}

export interface Adaptation {
  id: string;
  lang: string;
  today: string;
  restamp?: boolean; // the adaptation was reviewed against the changed source: only renew its stamp
}

// A lesson of the base language for another language: the source with its stamp (to rewrite for the
// new reader), the exercises and the vocabulary translation (to translate), the plan texts and the date.
export function adaptLesson(root: string, { id, lang, today, restamp = false }: Adaptation): string {
  const p = paths(root);
  const base = readJson<LocalesIndex>(p.index).base;
  if (lang === base) throw new Error(`${lang} is the base language: lessons are written in it, not adapted`);
  if (!existsSync(p.locale(lang))) throw new Error(`no language "${lang}" (npm run new-language)`);
  const sourceFile = p.lesson(base, id);
  if (!existsSync(sourceFile)) throw new Error(`lesson ${id} is not written in ${base}`);
  const source = readFileSync(sourceFile, 'utf8');
  const file = p.lesson(lang, id);
  if (restamp) {
    if (!existsSync(file)) throw new Error(`no adaptation ${lang}/${id} to re-stamp`);
    writeFileSync(file, withStamp(readFileSync(file, 'utf8'), base, source));
    return file;
  }
  if (existsSync(file)) throw new Error(`adaptation ${lang}/${id} exists (after reviewing changes of the source: --restamp)`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, withStamp(source, base, source));
  for (const copy of [p.exercises, p.vocab]) {
    if (existsSync(copy(base, id)) && !existsSync(copy(lang, id))) {
      mkdirSync(dirname(copy(lang, id)), { recursive: true });
      copyFileSync(copy(base, id), copy(lang, id));
    }
  }
  const sourceTexts = readJson<LocaleCatalog>(p.catalog(base)).lessons?.[id] ?? {};
  const catalog = readJson<LocaleCatalog>(p.catalog(lang));
  catalog.lessons = { ...catalog.lessons, [id]: { ...sourceTexts, ...catalog.lessons?.[id], date: today } };
  writeJson(p.catalog(lang), catalog);
  return file;
}

// ---------- published ids ----------

// Adds lessons and chapters written in the base language to the published lists (tests/published-*.json).
// Those lists only grow: saved progress refers to the ids. Returns what was added.
export function registerPublished(root: string): string[] {
  const p = paths(root);
  const base = readJson<LocalesIndex>(p.index).base;
  const ids = readJson<string[]>(p.publishedIds);
  const sections = readJson<Record<string, string[]>>(p.publishedSections);
  const added: string[] = [];
  const dir = join(root, 'content/locales', base, 'lessons');
  const order = courseIds(readJson<Course>(p.course));
  const files = readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5))
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  for (const id of files) {
    if (!ids.includes(id)) { ids.push(id); added.push(id); }
    const known = sections[id] ?? [];
    const fresh = lessonOutline(readFileSync(join(dir, `${id}.html`), 'utf8')).sections.filter((s) => !known.includes(s));
    if (fresh.length) { sections[id] = [...known, ...fresh]; added.push(...fresh.map((s) => `${id}/${s}`)); }
  }
  if (added.length) {
    writeJson(p.publishedIds, ids);
    // one line per lesson, as the file is kept
    const lines = Object.entries(sections).map(([id, list]) => `  ${JSON.stringify(id)}: [${list.map((s) => JSON.stringify(s)).join(', ')}]`);
    writeFileSync(p.publishedSections, `{\n${lines.join(',\n')}\n}\n`);
  }
  return added;
}
