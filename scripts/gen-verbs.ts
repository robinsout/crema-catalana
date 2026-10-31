// Builds the verb reference (content/verbs/verbs.json) from the Softcatalà dictionary:
//   git clone --depth 1 https://github.com/Softcatala/catalan-dict-tools
//   npm run verbs -- <path to catalan-dict-tools>
// The verbs and their order are in authoring/verbs.txt; translations are written by hand
// (content/locales/<lang>/verbs.json, the tests check that none is missing).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVerbs, parseFrequencies, parseModels, parseVerbList } from './lib/verbs.ts';
import { verbList } from '../src/services/verbs.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dict = process.argv[2];
if (!dict) {
  console.error('usage: npm run verbs -- <path to catalan-dict-tools>');
  process.exit(1);
}
const read = (path: string): string => readFileSync(join(dict, path), 'utf8');
const commit = execFileSync('git', ['-C', dict, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();

const data = buildVerbs(read('resultats/lt/diccionari.txt').split('\n'), parseVerbList(readFileSync(join(root, 'authoring/verbs.txt'), 'utf8')), {
  freq: parseFrequencies(read('frequencies/frequencies-dict-forms.txt')),
  models: parseModels(read('diccionari-arrel/verbs-fdic.txt')),
  source: `Softcatalà catalan-dict-tools@${commit} (GPL-2.0+ / LGPL-2.1+)`,
});

// one verb per line: small diffs when the list or the dictionary changes
const out = join(root, 'content/verbs/verbs.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `{"source":${JSON.stringify(data.source)},"verbs":[\n${data.verbs.map((v) => JSON.stringify(v)).join(',\n')}\n]}\n`);
// the infinitives alone: the list page shows them before the forms arrive
const list = verbList(data);
writeFileSync(join(root, 'content/verbs/list.json'), `{"verbs":[\n${list.verbs.map((v) => JSON.stringify(v)).join(',\n')}\n]}\n`);
console.log(`${data.verbs.length} verbs → content/verbs/verbs.json, list.json`);
