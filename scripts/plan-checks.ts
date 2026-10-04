// For the git hooks: prints "tests" when the changes need the checks, "skip" when they touch only documentation.
//   pre-push:   node scripts/plan-checks.ts            (stdin: "<local ref> <local sha> <remote ref> <remote sha>")
//   pre-commit: node scripts/plan-checks.ts --staged   (the files staged for the commit)
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isDocsOnly } from './lib/session.ts';

const ZERO = /^0+$/;
const files: string[] = [];
let unknown = false;
const staged = process.argv.includes('--staged');
if (staged) files.push(...spawnSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean));
for (const line of staged ? [] : readFileSync(0, 'utf8').split('\n').filter(Boolean)) {
  const [, local, , remote] = line.split(' ');
  if (!local || ZERO.test(local)) continue; // a deleted branch: nothing to check
  if (!remote || ZERO.test(remote)) { unknown = true; continue; } // a new branch: check everything
  const diff = spawnSync('git', ['diff', '--name-only', remote, local], { encoding: 'utf8' });
  if (diff.status !== 0) { unknown = true; continue; }
  files.push(...diff.stdout.split('\n').filter(Boolean));
}
console.log(!unknown && isDocsOnly(files) ? 'skip' : 'tests');
