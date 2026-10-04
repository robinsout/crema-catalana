// @vitest-environment node
// GitHub Actions workflows must be valid YAML with jobs; a broken file only shows up on GitHub otherwise.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '.github', 'workflows');

test('every workflow parses and has jobs with steps', () => {
  const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
  assert.ok(files.length >= 2);
  for (const f of files) {
    const doc = parseDocument(readFileSync(join(dir, f), 'utf8'), { strict: true, uniqueKeys: true });
    assert.deepEqual(doc.errors.map((e) => e.message), [], `${f}: YAML errors`);
    const wf = doc.toJS() as { on?: unknown; jobs?: Record<string, { steps?: unknown[] }> };
    assert.ok(wf.on, `${f}: no "on"`);
    assert.ok(wf.jobs && Object.keys(wf.jobs).length, `${f}: no jobs`);
    for (const [name, job] of Object.entries(wf.jobs ?? {})) {
      if (job.steps) for (const step of job.steps) assert.equal(typeof step, 'object', `${f}/${name}: a step is not a mapping`);
    }
  }
});

// A tag can be moved to other code; a commit hash cannot. The comment keeps the version readable for Dependabot.
test('every action is pinned to a commit hash', () => {
  for (const f of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
    for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) {
      const uses = line.match(/^\s*(?:-\s*)?uses:\s*(\S+)(.*)$/);
      if (!uses) continue;
      assert.match(uses[1]!, /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/, `${f}: ${line.trim()}`);
      assert.match(uses[2]!, /^\s+# v\d/, `${f}: ${line.trim()} needs a "# vX" comment`);
    }
  }
});

test('Dependabot watches npm packages and actions', () => {
  const cfg = parseDocument(readFileSync(join(dir, '..', 'dependabot.yml'), 'utf8')).toJS() as { version: number; updates: { 'package-ecosystem': string }[] };
  assert.equal(cfg.version, 2);
  assert.deepEqual(cfg.updates.map((u) => u['package-ecosystem']).sort(), ['github-actions', 'npm']);
});
