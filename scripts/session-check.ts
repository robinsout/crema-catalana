// End-of-session check: is everything committed, tested, pushed, deployed and alive?
// Read-only: it changes nothing, only reports. Used by the /close-session ritual; can be run by hand.
//
// It runs only the checks the changes need (planChecks): the changes are uncommitted files plus
// commits not yet pushed. Nothing changed or only documentation → no tests; the look may have
// changed → screenshot tests too. Pushed code was already verified by the pre-push hook and CI.
//
//   npm run session                  checks the changes need
//   npm run session -- --full        all checks, browser and screenshot tests included
//   npm run session -- --no-build    no tests at all
//   npm run session -- --e2e         also browser tests (the pre-push hook runs them anyway)
//   npm run session -- --visual      also screenshot tests
//   npm run session -- --offline     no GitHub, site, sync server or SSH
//
// Exit code 1 when something must be fixed before closing the session.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { connect } from 'node:tls';
import {
  backlogInProgress, builtEntry, daysUntil, memoryDirFor, memoryIndexProblems, planChecks, summarize, type Level,
} from './lib/session.ts';

const REPO = 'robinsout/crema-catalana';
const SITE = 'https://robinsout.github.io/crema-catalana/';
const SYNC_HOST = '188.245.182.47';
const PERSONAL_EMAIL = 'robinsout@gmail.com';
const SERVICES = ['quadern-sync', 'caddy', 'comoestasbot'];

const args = new Set(process.argv.slice(2));
const online = !args.has('--offline');
const results: { level: Level; title: string; detail: string }[] = [];
const mark: Record<Level, string> = { ok: '✓', warn: '!', fail: '✗', skip: '–' };

function report(level: Level, title: string, detail = ''): void {
  results.push({ level, title, detail });
  console.log(`${mark[level]} ${title}${detail ? `: ${detail}` : ''}`);
}

function run(cmd: string, argv: string[], opts: { quiet?: boolean; timeout?: number } = {}) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8', timeout: opts.timeout ?? 600_000, stdio: opts.quiet === false ? 'inherit' : 'pipe' });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}
const git = (...a: string[]) => run('git', a).out;

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'quadern-session-check' } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch { return null; }
}
async function getText(url: string, headers: Record<string, string> = {}): Promise<{ status: number; text: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers });
    return { status: res.status, text: await res.text() };
  } catch { return null; }
}
function certificateEnd(host: string): Promise<Date | null> {
  return new Promise((resolve) => {
    const socket = connect({ host, port: 443, servername: undefined, rejectUnauthorized: false, timeout: 10_000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      resolve(cert?.valid_to ? new Date(cert.valid_to) : null);
    });
    socket.on('error', () => resolve(null));
    socket.on('timeout', () => { socket.destroy(); resolve(null); });
  });
}

// ---------------------------------------------------------------- environment and git
console.log('\n## Окружение и git');
const nodeWanted = readFileSync('.nvmrc', 'utf8').trim();
const nodeMajor = process.versions.node.split('.')[0];
report(nodeMajor === nodeWanted ? 'ok' : 'fail', 'Node', `${process.versions.node} (нужен ${nodeWanted} из .nvmrc)`);
report(git('config', 'core.hooksPath') === '.githooks' ? 'ok' : 'warn', 'Git-хуки', git('config', 'core.hooksPath') || 'не подключены: git config core.hooksPath .githooks');
const email = git('config', 'user.email');
report(email === PERSONAL_EMAIL ? 'ok' : 'fail', 'Автор коммитов', email);
report(git('config', 'core.sshCommand').includes('mygithub') ? 'ok' : 'warn', 'Ключ для пуша', git('config', 'core.sshCommand') || 'core.sshCommand не задан');

const branch = git('branch', '--show-current');
report(branch === 'master' ? 'ok' : 'warn', 'Ветка', branch);
const dirty = git('status', '--porcelain').split('\n').filter(Boolean);
report(dirty.length ? 'fail' : 'ok', 'Незакоммиченные изменения', dirty.length ? `${dirty.length}\n    ${dirty.slice(0, 15).join('\n    ')}` : 'нет');
if (online) run('git', ['fetch', '--quiet', 'origin'], { timeout: 30_000 });
const ahead = git('rev-list', '--count', '@{upstream}..HEAD');
const behind = git('rev-list', '--count', 'HEAD..@{upstream}');
report(ahead === '0' ? 'ok' : 'fail', 'Незапушенные коммиты', ahead === '0' ? 'нет' : `${ahead}: ${git('log', '--oneline', '@{upstream}..HEAD').split('\n').join('; ')}`);
if (behind !== '0') report('warn', 'На GitHub есть коммиты, которых нет здесь', behind);
const stashes = git('stash', 'list').split('\n').filter(Boolean);
if (stashes.length) report('warn', 'Отложенные изменения (git stash)', String(stashes.length));

// ---------------------------------------------------------------- what changed → what to check
const changed = [...new Set([
  ...git('diff', '--name-only', 'HEAD').split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n'),
  ...git('diff', '--name-only', '@{upstream}', 'HEAD').split('\n'),
].filter(Boolean))];
const full = args.has('--full');
const plan = planChecks(changed);
const runTests = !args.has('--no-build') && (full || plan.tests);
const runE2e = full || args.has('--e2e');
const runVisual = full || args.has('--visual') || (plan.visual && !args.has('--no-build'));
console.log('\n## Что изменилось');
report('ok', 'Изменённые файлы', changed.length ? `${changed.length}: ${changed.slice(0, 12).join(', ')}${changed.length > 12 ? ', …' : ''}` : 'нет — код уже проверен при пуше и в CI');
if (changed.length && !plan.tests) report('ok', 'Только документация', 'тесты не нужны');
if (plan.audio) report('warn', 'Тексты уроков', 'новые фразы нужно озвучить: npm run audio (тесты проверят полноту)');
if (plan.server) report('warn', 'Код сервера синхронизации', 'после пуша выложить на сервер: npm run deploy:sync');

// ---------------------------------------------------------------- quality
console.log('\n## Проверки');
if (!runTests) report('skip', 'Типы, тесты, сборка', args.has('--no-build') ? '--no-build' : 'не нужны: код не менялся');
else {
  const check = run('npm', ['run', 'check', '--silent']);
  const tests = (check.out + check.err).match(/Tests\s+(.*)/)?.[1]?.trim() ?? '';
  report(check.ok ? 'ok' : 'fail', 'Типы, тесты, сборка', check.ok ? tests : `упало\n${(check.out + check.err).split('\n').slice(-25).join('\n')}`);
}
if (runE2e) {
  const e2e = run('npm', ['run', 'e2e', '--silent']);
  report(e2e.ok ? 'ok' : 'fail', 'Тесты в браузере', (e2e.out.match(/\d+ (passed|failed).*/g) ?? []).join(', '));
}
if (runVisual) {
  const visual = run('npm', ['run', 'e2e:visual', '--silent']);
  report(visual.ok ? 'ok' : 'fail', 'Скриншоты', visual.ok ? 'совпадают с эталонами' : 'есть отличия: посмотреть test-results/, при намеренном изменении — npm run e2e:visual:update');
}
const audit = run('npm', ['audit', '--omit=dev', '--json'], { timeout: 60_000 });
try {
  const v = (JSON.parse(audit.out) as { metadata: { vulnerabilities: Record<string, number> } }).metadata.vulnerabilities;
  const serious = (v.high ?? 0) + (v.critical ?? 0);
  report(serious ? 'fail' : v.total ? 'warn' : 'ok', 'Уязвимости в зависимостях сайта', `${v.total ?? 0} (высоких и критических: ${serious})`);
} catch { report('skip', 'Уязвимости в зависимостях сайта', 'npm audit не ответил'); }

// ---------------------------------------------------------------- GitHub and the live site
console.log('\n## GitHub и сайт');
if (!online) report('skip', 'GitHub, сайт, сервер', '--offline');
else {
  type Run = { name: string; status: string; conclusion: string | null; html_url: string };
  // CI skips documentation-only commits (paths-ignore): look at the last pushed commit it runs for
  const head = git('log', '-1', '--format=%H', '@{upstream}', '--', '.', ':(exclude)*.md', ':(exclude).claude', ':(exclude)LICENSE');
  const runs = await getJson<{ workflow_runs: Run[] }>(`https://api.github.com/repos/${REPO}/actions/runs?head_sha=${head}&event=push`);
  const ci = runs?.workflow_runs[0];
  if (!runs) report('skip', 'CI', 'GitHub API не ответил (лимит 60 запросов в час без входа)');
  else if (!ci) report('warn', 'CI', `для ${head.slice(0, 7)} ещё не запускался`);
  else if (ci.status !== 'completed') report('warn', 'CI', `${ci.status}, ещё идёт: ${ci.html_url}`);
  else report(ci.conclusion === 'success' ? 'ok' : 'fail', 'CI', `${ci.conclusion} для ${head.slice(0, 7)}${ci.conclusion === 'success' ? '' : `: ${ci.html_url}`}`);

  const prs = await getJson<{ number: number; title: string; user: { login: string } }[]>(`https://api.github.com/repos/${REPO}/pulls?state=open`);
  if (prs) report(prs.length ? 'warn' : 'ok', 'Открытые PR', prs.length ? prs.map((p) => `#${p.number} ${p.title} (${p.user.login})`).join('; ') : 'нет');

  const live = await getText(`${SITE}?nocache=${Date.now()}`);
  const local = existsSync('dist/index.html') ? builtEntry(readFileSync('dist/index.html', 'utf8')) : null;
  const deployed = live ? builtEntry(live.text) : null;
  if (!live || live.status !== 200) report('fail', 'Сайт', `не отвечает (${live?.status ?? 'нет связи'})`);
  else if (!local || !runTests) report('ok', 'Сайт', `отвечает, ${deployed}`);
  else report(local === deployed ? 'ok' : 'warn', 'Сайт', local === deployed ? 'отвечает и совпадает с локальной сборкой' : `на сайте ${deployed}, локально ${local}: деплой ещё не прошёл или есть незапушенные изменения`);

  // ------------------------------------------------------------ sync server
  console.log('\n## Сервер синхронизации');
  const health = await getText(`https://${SYNC_HOST}/v1/health`, { Origin: 'https://robinsout.github.io' });
  report(health?.status === 200 ? 'ok' : 'fail', 'Health', health ? `${health.status} ${health.text}` : 'нет связи');
  const end = await certificateEnd(SYNC_HOST);
  const left = end ? daysUntil(end) : null;
  report(left === null ? 'fail' : left >= 3 ? 'ok' : 'warn', 'Сертификат', left === null ? 'не получен' : `ещё ${left} дн. (Caddy продлевает сам)`);
  const ssh = run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', 'hetzner',
    `systemctl is-active ${SERVICES.join(' ')}; test -f /var/run/reboot-required && echo REBOOT || echo NOREBOOT; df -P / | awk 'NR==2{print $5}'`], { timeout: 30_000 });
  if (!ssh.ok && !ssh.out) report('skip', 'Сервер по SSH', 'нет доступа');
  else {
    const lines = ssh.out.split('\n');
    const states = SERVICES.map((s, i) => `${s} ${lines[i]}`);
    report(lines.slice(0, SERVICES.length).every((l) => l === 'active') ? 'ok' : 'fail', 'Сервисы', states.join(', '));
    if (lines[SERVICES.length] === 'REBOOT') report('warn', 'Перезагрузка', 'обновления ждут перезагрузки (автоматически в 04:30)');
    const disk = parseInt(lines[SERVICES.length + 1] ?? '', 10);
    if (Number.isFinite(disk)) report(disk < 80 ? 'ok' : disk < 90 ? 'warn' : 'fail', 'Диск', `занято ${disk}%`);
  }
}

// ---------------------------------------------------------------- backlog and memory
console.log('\n## Бэклог и память');
const inProgress = backlogInProgress(readFileSync('BACKLOG.md', 'utf8'));
report('ok', 'В работе', inProgress.length ? inProgress.join('; ') : 'ничего');
const memoryDir = memoryDirFor(process.cwd(), homedir());
if (!existsSync(memoryDir)) report('skip', 'Память', `нет папки ${memoryDir}`);
else {
  const files = readdirSync(memoryDir);
  const index = existsSync(`${memoryDir}/MEMORY.md`) ? readFileSync(`${memoryDir}/MEMORY.md`, 'utf8') : '';
  const problems = memoryIndexProblems(files, index);
  report(problems.length ? 'warn' : 'ok', 'Индекс памяти', problems.length ? problems.join('; ') : `${files.length - 1} заметок`);
  const state = `${memoryDir}/session-state.md`;
  if (existsSync(state)) {
    const hours = Math.round((Date.now() - statSync(state).mtimeMs) / 3_600_000);
    report(hours < 12 ? 'ok' : 'warn', 'Состояние сессии (session-state.md)', hours < 12 ? `обновлено ${hours} ч назад` : `не обновлялось ${hours} ч`);
  } else report('warn', 'Состояние сессии', 'нет session-state.md');
}

const { exitCode, line } = summarize(results);
console.log(`\n${exitCode ? '✗' : '✓'} ${line}`);
process.exit(exitCode);
