// The manifest of the service worker (sw/core.ts): what a build is made of. Its version changes with
// any change of the site, code or content, so a deploy reaches the readers.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Manifest } from '../../sw/core.ts';
import { MANIFEST_MARK } from '../../shared/sw-api.ts';

// Hash of the content folder; audio clips are left out (3000 files, named by their own hash, and a
// new clip comes with a new audio/index.json anyway)
export function contentHash(dir: string): string {
  const hash = createHash('sha256');
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => !f.split(/[\\/]/).includes('clips'))
    .sort();
  for (const f of files) {
    try { hash.update(f).update(readFileSync(join(dir, f))); } catch { /* a folder */ }
  }
  return hash.digest('hex');
}

export function swManifest(bundle: string[], content: string, languages: string[]): Manifest {
  const assets = bundle.filter((f) => f.startsWith('assets/')).sort();
  return {
    version: createHash('sha256').update(assets.join('\n')).update(content).digest('hex').slice(0, 12),
    shell: assets.filter((f) => /\.(js|css)$/.test(f)),
    assets,
    data: ['course.json', 'locales/index.json', ...languages.flatMap((l) => [`locales/${l}/ui.json`, `locales/${l}/catalog.json`])],
  };
}

// The manifest as the worker's build constant: URI-encoded (no quotes for a minifier to escape)
// between markers, so the build test can read it back
export const manifestDefine = (m: Manifest): string =>
  JSON.stringify(`${MANIFEST_MARK}:${encodeURIComponent(JSON.stringify(m))}:${MANIFEST_MARK}`);

export function readManifest(sw: string): Manifest | null {
  const m = new RegExp(`${MANIFEST_MARK}:([^:'"\\s]+):${MANIFEST_MARK}`).exec(sw);
  return m?.[1] ? JSON.parse(decodeURIComponent(m[1])) as Manifest : null;
}
