// Checks of a lesson fragment for writing and adapting lessons: markup rules the page and the
// audio rely on, and the outline (chapters, exercises) an adaptation must keep from its source.
import { exerciseIds } from '../../src/services/exercises.ts';
import { findClose, text } from './say-texts.ts';

const CYRILLIC = /[Ѐ-ӿ]/;

export function lintLesson(html: string): string[] {
  const problems: string[] = [];
  const tags = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = tags.exec(html))) {
    const [open, tag = '', attrs = ''] = m;
    const name = tag.toLowerCase();
    const start = m.index + open.length;
    if (/\blang="ca"/.test(attrs)) {
      const inner = html.slice(start, findClose(html, name, start));
      if (/\blang="ca"/.test(inner)) problems.push(`nested lang="ca" inside <${name}>: "${text(inner)}"`);
      // what the page voices: the element, or every cell of a Catalan table (headers stay silent)
      const phrases = name === 'table' ? [...inner.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((td) => text(td[1] ?? '')) : [text(inner)];
      for (const phrase of phrases.filter((x) => CYRILLIC.test(x))) {
        problems.push(`Russian text inside lang="ca" — keep explanations outside: "${phrase}"`);
      }
    }
    if (name === 'section') {
      const id = /\bid="([^"]+)"/.exec(attrs)?.[1];
      const inner = html.slice(start, findClose(html, 'section', start));
      if (!id) problems.push(`a <section> without an id: "${text(inner).slice(0, 40)}…"`);
      else if (!/<h2\b/i.test(inner)) problems.push(`section "${id}" has no <h2> heading`);
    }
  }
  return problems;
}

export interface LessonOutline {
  sections: string[]; // chapter ids in order
  exercises: string[]; // exercise placeholders
}

export const lessonOutline = (html: string): LessonOutline => ({
  sections: [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/gi)].map((m) => m[1]!),
  exercises: exerciseIds(html),
});

// Progress is saved under chapter and exercise ids, shared by all languages of a lesson:
// an adaptation has the same chapters in the same order and the same exercises as its source.
export function compareOutlines(source: LessonOutline, adapted: LessonOutline): string[] {
  const problems: string[] = [];
  if (source.sections.join() !== adapted.sections.join()) {
    problems.push(`chapters differ from the source: [${adapted.sections.join(', ')}], expected [${source.sections.join(', ')}]`);
  }
  const sorted = (ids: string[]) => [...ids].sort().join();
  if (sorted(source.exercises) !== sorted(adapted.exercises)) {
    problems.push(`exercises differ from the source: [${adapted.exercises.join(', ')}], expected [${source.exercises.join(', ')}]`);
  }
  return problems;
}

// Languages written in Cyrillic; in any other language Cyrillic text is a leftover of the Russian source.
const CYRILLIC_LANGUAGES = ['ru', 'uk', 'be', 'bg', 'sr', 'mk'];

// Russian text left untranslated in an adaptation: runs of Cyrillic words in HTML or in JSON values.
export function cyrillicLeftovers(content: string | object, lang: string): string[] {
  if (CYRILLIC_LANGUAGES.includes(lang)) return [];
  const raw = typeof content === 'string' ? text(content) : JSON.stringify(content);
  return [...raw.matchAll(/[Ѐ-ӿ][Ѐ-ӿ\s,.!?;:«»—-]*[Ѐ-ӿ]|[Ѐ-ӿ]/g)].map((m) => m[0].trim());
}
