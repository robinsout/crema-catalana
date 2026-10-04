// For the pre-push hook: reads the refs git is pushing (stdin: "<local ref> <local sha> <remote ref> <remote sha>")
// and prints "tests" when the pushed commits need the checks, "skip" when they change only documentation.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isDocsOnly } from './lib/session.ts';

const ZERO = /^0+$/;
const files: string[] = [];
let unknown = false;
for (const line of readFileSync(0, 'utf8').split('\n').filter(Boolean)) {
  const [, local, , remote] = line.split(' ');
  if (!local || ZERO.test(local)) continue; // a deleted branch: nothing to check
  if (!remote || ZERO.test(remote)) { unknown = true; continue; } // a new branch: check everything
  const diff = spawnSync('git', ['diff', '--name-only', remote, local], { encoding: 'utf8' });
  if (diff.status !== 0) { unknown = true; continue; }
  files.push(...diff.stdout.split('\n').filter(Boolean));
}
console.log(!unknown && isDocsOnly(files) ? 'skip' : 'tests');
