// Loads course data from content/ on disk, for tests and scripts.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildCatalog, normalizeCatalog, lessonPath } from '../../src/services/catalog.ts';
import type { Catalog, Course, LocaleCatalog, LocalesIndex } from '../../src/types/index.ts';

export { lessonPath };

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

export function loadCourse(contentDir: string): Course {
  return readJson<Course>(join(contentDir, 'course.json'));
}

export function loadLocaleCatalog(contentDir: string, lang: string): LocaleCatalog {
  const path = join(contentDir, 'locales', lang, 'catalog.json');
  return existsSync(path) ? readJson<LocaleCatalog>(path) : {};
}

export function loadCatalog(contentDir: string, lang: string): Catalog {
  return normalizeCatalog(buildCatalog(loadCourse(contentDir), loadLocaleCatalog(contentDir, lang), lang));
}

export function loadLocales(contentDir: string): LocalesIndex {
  return readJson<LocalesIndex>(join(contentDir, 'locales', 'index.json'));
}
