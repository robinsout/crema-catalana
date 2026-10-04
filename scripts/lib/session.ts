// Pure parts of the end-of-session check (scripts/session-check.ts): what to report and how.

export type Level = 'ok' | 'warn' | 'fail' | 'skip';

// Items of the backlog status table marked 🚧, as "ID title (status note)".
export function backlogInProgress(md: string): string[] {
  const items: string[] = [];
  for (const line of md.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 6) continue;
    const id = cells[1]?.match(/^\[([A-Z]-\d+)\]/)?.[1];
    const status = cells[4] ?? '';
    if (!id || !status.includes('🚧')) continue;
    const note = status.replace('🚧', '').trim();
    items.push(`${id} ${cells[2]}${note ? ` (${note})` : ''}`);
  }
  return items;
}

// The entry script of a built index.html: compared between dist/ and the live site.
export function builtEntry(html: string): string | null {
  return html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"/)?.[1] ?? null;
}

// Claude Code keeps the memory of a project in ~/.claude/projects/<path with "/" as "-">/memory.
export function memoryDirFor(projectDir: string, home: string): string {
  return `${home}/.claude/projects/${projectDir.replace(/[/.]/g, '-')}/memory`;
}

// MEMORY.md must list every memory file and link only to existing ones.
export function memoryIndexProblems(files: string[], index: string): string[] {
  const linked = new Set([...index.matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => m[1]!));
  const memories = files.filter((f) => f.endsWith('.md') && f !== 'MEMORY.md');
  return [
    ...memories.filter((f) => !linked.has(f)).map((f) => `${f} is not in MEMORY.md`),
    ...[...linked].filter((f) => !memories.includes(f)).map((f) => `MEMORY.md links to a missing ${f}`),
  ];
}

export const daysUntil = (date: Date, now = Date.now()): number => Math.floor((date.getTime() - now) / 86_400_000);

export function summarize(results: { level: Level }[]): { exitCode: number; line: string } {
  const fails = results.filter((r) => r.level === 'fail').length;
  const warns = results.filter((r) => r.level === 'warn').length;
  if (fails) return { exitCode: 1, line: `Не готово: ошибок ${fails}, предупреждений ${warns}` };
  return { exitCode: 0, line: warns ? `Готово к закрытию, есть предупреждения: ${warns}` : 'Всё в порядке' };
}
