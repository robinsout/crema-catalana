// Loads the catalog of one language from disk, for tests and scripts.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildCatalog, normalizeCatalog, lessonPath } from '../../portal/js/model.js';

export { lessonPath };

export function loadCatalog(portal, lang) {
  const course = JSON.parse(readFileSync(join(portal, 'course.json'), 'utf8'));
  const locPath = join(portal, 'locales', lang, 'catalog.json');
  const locale = existsSync(locPath) ? JSON.parse(readFileSync(locPath, 'utf8')) : {};
  return normalizeCatalog(buildCatalog(course, locale, lang));
}

export function loadLocales(portal) {
  return JSON.parse(readFileSync(join(portal, 'locales', 'index.json'), 'utf8'));
}
