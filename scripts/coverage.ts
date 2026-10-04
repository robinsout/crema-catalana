// npm run coverage — which lessons are written in which language (BACKLOG F-4).
//   ✅ written and up to date · ⚠️ adaptation of an older version of the source · — not written
// Only lessons written somewhere are listed; --all lists every lesson of the course.
import { coverageTable, type Status } from './lib/coverage.ts';
import { loadLocales } from './lib/catalog.ts';

const MARK: Record<Status, string> = { ready: '✅', outdated: '⚠️ ', missing: '— ' };
const all = process.argv.includes('--all');

const locales = loadLocales('content');
const { languages, rows } = coverageTable('content');
const shown = all ? rows : rows.filter((r) => Object.values(r.status).some((s) => s !== 'missing'));
const width = Math.max(...shown.map((r) => r.id.length), 6);
const label = (lang: string) => (locales.drafts?.includes(lang) ? `${lang}*` : lang).padEnd(4);

console.log(`${'lesson'.padEnd(width)}  ${languages.map(label).join(' ')}`);
for (const r of shown) console.log(`${r.id.padEnd(width)}  ${languages.map((l) => MARK[r.status[l]!].padEnd(4)).join(' ')}`);

const count = (lang: string, s: Status) => rows.filter((r) => r.status[lang] === s).length;
console.log('');
for (const lang of languages) {
  const outdated = count(lang, 'outdated');
  console.log(`${label(lang)} ${count(lang, 'ready')} ready${outdated ? `, ${outdated} outdated` : ''} of ${rows.length}`);
}
if (locales.drafts?.length) console.log('* draft: not in the language switcher yet');
const stale = rows.flatMap((r) => languages.filter((l) => r.status[l] === 'outdated').map((l) => `${l}/${r.id}`));
if (stale.length) console.log(`\noutdated (source changed since the adaptation): ${stale.join(', ')}\nreview and re-stamp: npm run adapt -- <id> <lang> --restamp`);
