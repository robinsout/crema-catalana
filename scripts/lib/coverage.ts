// Which lessons are written in which language, and which adaptations are outdated.
// An adaptation starts with a stamp of the source it was made from: <!-- source: ru@<hash> -->.
// When the source lesson changes, its hash changes and the adaptation is reported as outdated.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allLessons } from '../../src/services/catalog.ts';
import { contentLanguages, loadCatalog, loadLocales } from './catalog.ts';

const STAMP = /^<!-- source: ([a-z-]+)@([0-9a-f]+) -->\n?/;

export const fingerprint = (html: string): string => createHash('sha256').update(html.replace(STAMP, '')).digest('hex').slice(0, 12);

export function readStamp(html: string): { lang: string; hash: string } | null {
  const m = STAMP.exec(html);
  return m ? { lang: m[1]!, hash: m[2]! } : null;
}

// the adaptation with a (new) stamp of its source
export const withStamp = (html: string, sourceLang: string, source: string): string =>
  `<!-- source: ${sourceLang}@${fingerprint(source)} -->\n${html.replace(STAMP, '')}`;

export type Status = 'ready' | 'outdated' | 'missing';

// `source`: the lesson in the base language (null when this is the base language or it has no such lesson)
export function lessonStatus({ html, source }: { html: string | null; source: string | null }): Status {
  if (html === null) return 'missing';
  if (source === null) return 'ready';
  return readStamp(html)?.hash === fingerprint(source) ? 'ready' : 'outdated';
}

export interface CoverageRow {
  id: string;
  title: string;
  status: Record<string, Status>;
  files: Record<string, string | null>; // path of the lesson file in each language
}

// languages: the base one first, then the published ones and drafts
export function coverageTable(contentDir: string): { languages: string[]; rows: CoverageRow[] } {
  const locales = loadLocales(contentDir);
  const languages = [locales.base, ...contentLanguages(locales).filter((l) => l !== locales.base)];
  const catalogs = Object.fromEntries(languages.map((lang) => [lang, loadCatalog(contentDir, lang)]));
  const read = (path: string | null): string | null => (path && existsSync(path) ? readFileSync(path, 'utf8') : null);
  const rows = allLessons(catalogs[locales.base]!).map((lesson) => {
    const files: Record<string, string | null> = {};
    for (const lang of languages) {
      const file = allLessons(catalogs[lang]!).find((l) => l.id === lesson.id)?.file ?? null;
      files[lang] = file ? join(contentDir, file) : null;
    }
    const source = read(files[locales.base] ?? null);
    const status = Object.fromEntries(languages.map((lang) =>
      [lang, lessonStatus({ html: read(files[lang] ?? null), source: lang === locales.base ? null : source })])) as Record<string, Status>;
    return { id: lesson.id, title: lesson.title, status, files };
  });
  return { languages, rows };
}
