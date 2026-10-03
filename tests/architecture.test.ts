// Layered architecture: api → services → stores → UI (components, views, composables).
// Imports go only downward; types (src/types) are shared contracts usable everywhere.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

type Layer = 'types' | 'api' | 'services' | 'stores' | 'ui' | 'app';

function layerOf(file: string): Layer {
  const rel = relative(src, file);
  if (rel.startsWith(`..${'/'}shared${'/'}`) || rel.startsWith('..\\shared\\')) return 'types'; // contracts shared with the server
  const top = rel.split(/[\\/]/)[0] ?? '';
  if (top === 'types') return 'types';
  if (top === 'api') return 'api';
  if (top === 'services') return 'services';
  if (top === 'stores') return 'stores';
  if (['components', 'views', 'composables', 'App.vue'].includes(top)) return 'ui';
  return 'app'; // main.ts, router.ts: wiring of the app
}

// which layers each layer may import
const allowed: Record<Layer, Layer[]> = {
  types: ['types'],
  api: ['types', 'api'],
  services: ['types', 'api', 'services'],
  stores: ['types', 'services', 'stores'],
  ui: ['types', 'stores', 'ui'],
  app: ['types', 'services', 'stores', 'ui', 'app'],
};

// packages a layer must not depend on
const forbiddenPackages: Partial<Record<Layer, string[]>> = {
  types: ['vue', 'pinia', 'vue-router'],
  api: ['vue', 'pinia', 'vue-router'],
  services: ['vue', 'pinia', 'vue-router'],
};

const files = readdirSync(src, { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.(ts|vue)$/.test(f) && !f.endsWith('.d.ts'))
  .map((f) => join(src, f));

const importsOf = (code: string): string[] =>
  [...code.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)]
    .map((m) => m[1] ?? m[2] ?? '');

test('every source file belongs to a known layer', () => {
  assert.ok(files.length > 10);
  for (const f of files) assert.ok(layerOf(f));
});

test('imports go only downward through the layers', () => {
  const problems: string[] = [];
  for (const file of files) {
    const from = layerOf(file);
    for (const spec of importsOf(readFileSync(file, 'utf8'))) {
      if (spec.startsWith('.')) {
        const to = layerOf(resolve(dirname(file), spec));
        if (!allowed[from].includes(to)) problems.push(`${relative(src, file)} (${from}) → ${spec} (${to})`);
      } else if (forbiddenPackages[from]?.some((p) => spec === p || spec.startsWith(`${p}/`))) {
        problems.push(`${relative(src, file)} (${from}) → package ${spec}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

const withoutComments = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('network and browser storage are touched only in the api layer', () => {
  const problems = files
    .filter((f) => layerOf(f) !== 'api')
    .filter((f) => /\bfetch\(|\blocalStorage\b|\bsessionStorage\b/.test(withoutComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(src, f));
  assert.deepEqual(problems, []);
});
