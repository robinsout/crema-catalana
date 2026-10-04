// @vitest-environment node
// End-of-session check (scripts/session-check.ts): the pure parts that decide what to report.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  backlogInProgress, builtEntry, memoryDirFor, memoryIndexProblems, summarize, daysUntil, planChecks, isDocsOnly,
} from '../scripts/lib/session.ts';

test('the backlog table lists the items still in progress', () => {
  const md = [
    '| ID | Фича | Этап | Статус | Зависит от |',
    '|---|---|---|---|---|',
    '| [I-1](#i-1) | Общее хранилище озвучки | 0 | ✅ | — |',
    '| [F-1](#f-1) | Уроки для носителей испанского | 0 → 3 | 🚧 шаги 1–2 ✅ | I-1 |',
    '| [I-3](#i-3) | Повторение слов с интервалами | 4 | 💡 | I-2 |',
    '',
    '## F-1. Уроки 🚧',
  ].join('\n');
  assert.deepEqual(backlogInProgress(md), ['F-1 Уроки для носителей испанского (шаги 1–2 ✅)']);
});

test('the real backlog parses', () => {
  const items = backlogInProgress(readFileSync('BACKLOG.md', 'utf8'));
  assert.ok(Array.isArray(items));
  for (const item of items) assert.match(item, /^[A-Z]-\d+ /);
});

test('the entry script of a built page is found, so the live site can be compared with the build', () => {
  assert.equal(builtEntry('<script type="module" crossorigin src="./assets/index-DxRObJn1.js"></script>'), 'assets/index-DxRObJn1.js');
  assert.equal(builtEntry('<html>no script</html>'), null);
});

test('the memory folder of a project follows Claude Code naming', () => {
  assert.equal(memoryDirFor('/Users/vk/Pet-projects/catala', '/Users/vk'), '/Users/vk/.claude/projects/-Users-vk-Pet-projects-catala/memory');
});

test('memory index: every memory file is listed and every link points to a file', () => {
  const index = [
    '- [Learner](user-catalan-learner.md) — who',
    '- [Gone](gone.md) — deleted file',
  ].join('\n');
  assert.deepEqual(memoryIndexProblems(['MEMORY.md', 'user-catalan-learner.md', 'session-state.md'], index), [
    'session-state.md is not in MEMORY.md',
    'MEMORY.md links to a missing gone.md',
  ]);
  assert.deepEqual(memoryIndexProblems(['MEMORY.md', 'a.md'], '- [A](a.md) — a'), []);
});

test('days until a date, rounded down', () => {
  const now = Date.UTC(2026, 9, 4, 12);
  assert.equal(daysUntil(new Date(Date.UTC(2026, 9, 10, 11)), now), 5);
  assert.equal(daysUntil(new Date(Date.UTC(2026, 9, 3)), now), -2);
});

test('the summary fails on any failed check and only warns otherwise', () => {
  assert.deepEqual(summarize([{ level: 'ok' }, { level: 'warn' }]), { exitCode: 0, line: 'Готово к закрытию, есть предупреждения: 1' });
  assert.deepEqual(summarize([{ level: 'ok' }]), { exitCode: 0, line: 'Всё в порядке' });
  assert.deepEqual(summarize([{ level: 'fail' }, { level: 'warn' }, { level: 'fail' }]), { exitCode: 1, line: 'Не готово: ошибок 2, предупреждений 1' });
});

// Only the checks the changes need: no tests for a backlog edit, screenshots only when the look may change.
test('no changes need no checks', () => {
  assert.deepEqual(planChecks([]), { tests: false, visual: false, audio: false, server: false });
});

test('documentation and Claude settings need no tests', () => {
  for (const f of ['BACKLOG.md', 'CLAUDE.md', 'deploy/README.md', '.claude/skills/close-session/SKILL.md', 'LICENSE']) {
    assert.equal(planChecks([f]).tests, false, f);
    assert.equal(isDocsOnly([f]), true, f);
  }
});

test('code, content, configuration and workflows need tests', () => {
  for (const f of ['src/router.ts', 'tests/storage.test.ts', 'scripts/gen-audio.ts', 'content/course.json', 'package-lock.json',
    'vite.config.ts', '.github/workflows/pages.yml', '.githooks/pre-push', 'e2e/site.spec.ts', 'index.html', '.nvmrc']) {
    assert.equal(planChecks([f]).tests, true, f);
    assert.equal(isDocsOnly(['BACKLOG.md', f]), false, f);
  }
});

test('screenshots only when the look may change', () => {
  for (const f of ['src/styles/main.css', 'src/components/SideNav.vue', 'src/views/PlanView.vue', 'src/App.vue', 'index.html',
    'content/locales/ru/lessons/intro.html', 'content/locales/ru/catalog.json', 'content/locales/ru/ui.json', 'package-lock.json']) {
    assert.equal(planChecks([f]).visual, true, f);
  }
  for (const f of ['src/services/progress.ts', 'src/stores/sync.ts', 'server/app.ts', 'tests/app.test.ts', 'content/audio/index.json']) {
    assert.equal(planChecks([f]).visual, false, f);
  }
});

test('new lesson text needs recordings; server code needs a deploy to the server', () => {
  for (const f of ['content/locales/ru/lessons/b1-01.html', 'content/vocab/intro.json', 'content/locales/ru/vocab/intro.json', 'content/locales/ru/exercises/intro.json']) {
    assert.equal(planChecks([f]).audio, true, f);
  }
  assert.equal(planChecks(['src/router.ts']).audio, false);
  for (const f of ['server/app.ts', 'shared/sync-api.ts', 'deploy/Caddyfile', 'deploy/quadern-sync.service']) assert.equal(planChecks([f]).server, true, f);
  assert.equal(planChecks(['deploy/README.md']).server, false);
});
