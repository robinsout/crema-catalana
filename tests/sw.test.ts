// @vitest-environment node
// The service worker (BACKLOG I-6): instant repeat visits and the lessons already opened offline.
// A version is one build: the page and its code; data is cached when read and refreshed when a new
// version arrives (the page then offers to reload). Audio, the sync server and the counter are left alone.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { activate, DATA_CACHE, install, respond, routeOf, SHELL_PREFIX, type Manifest, type SwDeps } from '../sw/core.ts';

const SCOPE = 'https://robinsout.github.io/crema-catalana/';

// Cache Storage in memory: caches in the order of creation, like the browser's
class FakeCache {
  readonly entries = new Map<string, Response>();
  async match(req: RequestInfo | URL) { return this.entries.get(key(req))?.clone(); }
  async put(req: RequestInfo | URL, res: Response) { this.entries.set(key(req), res.clone()); }
  async delete(req: RequestInfo | URL) { return this.entries.delete(key(req)); }
  async keys() { return [...this.entries.keys()].map((u) => new Request(u)); }
}
const key = (req: RequestInfo | URL): string => (typeof req === 'string' ? req : req instanceof URL ? req.href : req.url);
class FakeCaches {
  readonly all = new Map<string, FakeCache>();
  async open(name: string) { let c = this.all.get(name); if (!c) { c = new FakeCache(); this.all.set(name, c); } return c; }
  async keys() { return [...this.all.keys()]; }
  async delete(name: string) { return this.all.delete(name); }
  async has(name: string) { return this.all.has(name); }
  async match(req: RequestInfo | URL) {
    for (const c of this.all.values()) { const hit = await c.match(req); if (hit) return hit; }
    return undefined;
  }
}

// The site on the network: path → body; fetched urls are recorded
function site(files: Record<string, string>) {
  const fetched: string[] = [];
  const fetch = async (req: RequestInfo | URL): Promise<Response> => {
    const url = key(req);
    fetched.push(url.slice(SCOPE.length));
    const path = url.slice(SCOPE.length);
    if (files.offline) throw new TypeError('Failed to fetch');
    return path in files ? new Response(files[path], { status: 200 }) : new Response('not found', { status: 404 });
  };
  return { fetch, fetched };
}

const manifest = (version: string, extra: Partial<Manifest> = {}): Manifest => ({
  version,
  shell: ['assets/index-a.js', 'assets/index-a.css'],
  assets: ['assets/index-a.js', 'assets/index-a.css', 'assets/font.woff2', 'assets/Verbs-a.js'],
  data: ['course.json', 'locales/ru/ui.json'],
  ...extra,
});

function deps(files: Record<string, string>, caches = new FakeCaches()) {
  const net = site(files);
  const d: SwDeps = { caches: caches as unknown as CacheStorage, fetch: net.fetch, scope: SCOPE };
  return { d, caches, net };
}

const get = (path: string, mode: RequestMode = 'cors') => ({ method: 'GET', url: SCOPE + path, mode });

test('what the worker handles: the page, the code, the data; not audio, other sites or other servers', () => {
  assert.equal(routeOf(get('', 'navigate'), SCOPE), 'page');
  assert.equal(routeOf(get('index.html', 'navigate'), SCOPE), 'page');
  assert.equal(routeOf(get('assets/index-a.js'), SCOPE), 'asset');
  assert.equal(routeOf(get('course.json'), SCOPE), 'data');
  assert.equal(routeOf(get('locales/ru/lessons/b1-01.html'), SCOPE), 'data');
  assert.equal(routeOf(get('verbs/verbs.json'), SCOPE), 'data');
  assert.equal(routeOf(get('audio/index.json'), SCOPE), 'data');
  assert.equal(routeOf(get('audio/clips/abc.mp3'), SCOPE), 'pass', 'Safari plays audio through a worker unreliably');
  assert.equal(routeOf(get('sw.js'), SCOPE), 'pass');
  assert.equal(routeOf(get('course.json', 'navigate'), SCOPE), 'pass', 'a data file opened in a tab');
  assert.equal(routeOf({ method: 'POST', url: `${SCOPE}course.json`, mode: 'cors' }, SCOPE), 'pass');
  assert.equal(routeOf({ method: 'GET', url: 'https://188.245.182.47/v1/blob/x', mode: 'cors' }, SCOPE), 'pass', 'sync server');
  assert.equal(routeOf({ method: 'GET', url: 'https://robinsout.github.io/other-site/', mode: 'navigate' }, SCOPE), 'pass', 'another site of the origin');
});

test('install keeps the page, its code and the main data of this version', async () => {
  const { d, caches, net } = deps({ '': '<html>v1', 'assets/index-a.js': 'js', 'assets/index-a.css': 'css', 'course.json': '{}', 'locales/ru/ui.json': '{}' });
  await install(manifest('v1'), d);
  const shell = caches.all.get(`${SHELL_PREFIX}v1`)!;
  assert.deepEqual([...shell.entries.keys()].map((u) => u.slice(SCOPE.length)).sort(), ['', 'assets/index-a.css', 'assets/index-a.js']);
  assert.deepEqual([...caches.all.get(DATA_CACHE)!.entries.keys()].map((u) => u.slice(SCOPE.length)).sort(), ['course.json', 'locales/ru/ui.json']);
  assert.ok(!net.fetched.includes('assets/font.woff2'), 'fonts are kept when used, not in advance');
});

test('a new version downloads only what changed: code with the same name is taken from the old version', async () => {
  const files = { '': '<html>v1', 'assets/index-a.js': 'js', 'assets/index-a.css': 'css', 'assets/font.woff2': 'font', 'course.json': '{}', 'locales/ru/ui.json': '{}' };
  const { d, caches } = deps(files);
  await install(manifest('v1'), d);
  await (await caches.open(`${SHELL_PREFIX}v1`)).put(SCOPE + 'assets/font.woff2', new Response('font'));
  const next = deps({ ...files, '': '<html>v2', 'assets/index-b.js': 'js2' }, caches);
  await install(manifest('v2', { shell: ['assets/index-b.js', 'assets/index-a.css'], assets: ['assets/index-b.js', 'assets/index-a.css', 'assets/font.woff2'] }), next.d);
  assert.deepEqual(next.net.fetched.filter((p) => !p.endsWith('.json')).sort(), ['', 'assets/index-b.js']);
  const shell = caches.all.get(`${SHELL_PREFIX}v2`)!;
  assert.ok(shell.entries.has(SCOPE + 'assets/font.woff2'), 'a font in use stays');
  assert.equal(await (await shell.match(SCOPE))!.text(), '<html>v2');
});

test('install fails when the code cannot be downloaded, so the old version stays', async () => {
  const { d } = deps({ '': '<html>v1', 'assets/index-a.css': 'css' });
  await assert.rejects(install(manifest('v1'), d));
});

test('activate keeps the previous version for pages still open, drops older ones and other sites\' caches stay', async () => {
  const caches = new FakeCaches();
  for (const name of [`${SHELL_PREFIX}v1`, `${SHELL_PREFIX}v2`, 'other-site-cache', `${SHELL_PREFIX}v3`]) await caches.open(name);
  const { d } = deps({}, caches);
  await activate('v3', d);
  assert.deepEqual((await caches.keys()).filter((n) => n !== DATA_CACHE), [`${SHELL_PREFIX}v2`, 'other-site-cache', `${SHELL_PREFIX}v3`]);
});

const v2Site = { '': '<html>v2', 'assets/index-a.js': 'js', 'assets/index-a.css': 'css', 'course.json': '{}', 'locales/ru/ui.json': '{}' };

test('a new version refreshes the data already read: a new lesson text, a removed file', async () => {
  const caches = new FakeCaches();
  const data = await caches.open(DATA_CACHE);
  await data.put(`${SCOPE}locales/ru/catalog.json`, new Response('old'));
  await data.put(`${SCOPE}locales/ru/lessons/gone.html`, new Response('old'));
  const { d } = deps({ ...v2Site, 'locales/ru/catalog.json': 'new' }, caches);
  await install(manifest('v2'), d);
  assert.equal(await (await data.match(`${SCOPE}locales/ru/catalog.json`))!.text(), 'new');
  assert.equal(await data.match(`${SCOPE}locales/ru/lessons/gone.html`), undefined);
});

test('a data file that fails to refresh keeps its old copy', async () => {
  const caches = new FakeCaches();
  const data = await caches.open(DATA_CACHE);
  await data.put(`${SCOPE}verbs/verbs.json`, new Response('kept'));
  const net = site(v2Site);
  const flaky: SwDeps['fetch'] = async (req, init) => {
    if (key(req as RequestInfo).endsWith('verbs.json')) throw new TypeError('Failed to fetch');
    return net.fetch(req as RequestInfo);
  };
  await install(manifest('v2'), { caches: caches as unknown as CacheStorage, fetch: flaky, scope: SCOPE });
  assert.equal(await (await data.match(`${SCOPE}verbs/verbs.json`))!.text(), 'kept');
});

test('the page and data come from the cache without the network; a miss is fetched and kept', async () => {
  const files = { '': '<html>v1', 'assets/index-a.js': 'js', 'assets/index-a.css': 'css', 'course.json': '{"v":1}', 'locales/ru/ui.json': '{}', 'locales/ru/lessons/b1-01.html': '<p>lesson' };
  const { d, caches, net } = deps(files);
  await install(manifest('v1'), d);
  net.fetched.length = 0;
  const page = await respond(new Request(SCOPE), 'page', 'v1', d);
  assert.equal(await page.text(), '<html>v1');
  assert.equal(await (await respond(new Request(`${SCOPE}course.json`), 'data', 'v1', d)).text(), '{"v":1}');
  assert.deepEqual(net.fetched, [], 'nothing from the network');
  assert.equal(await (await respond(new Request(`${SCOPE}locales/ru/lessons/b1-01.html`), 'data', 'v1', d)).text(), '<p>lesson');
  assert.ok(await caches.all.get(DATA_CACHE)!.match(`${SCOPE}locales/ru/lessons/b1-01.html`), 'kept for offline');
  await respond(new Request(`${SCOPE}assets/font.woff2`), 'asset', 'v1', deps({ 'assets/font.woff2': 'f' }, caches).d);
  assert.ok(await caches.all.get(`${SHELL_PREFIX}v1`)!.match(`${SCOPE}assets/font.woff2`), 'a font is kept with the version');
});

test('a page of the previous version still gets its code; a missing file is not kept', async () => {
  const caches = new FakeCaches();
  await (await caches.open(`${SHELL_PREFIX}v1`)).put(`${SCOPE}assets/Verbs-old.js`, new Response('old chunk'));
  const { d } = deps({}, caches);
  assert.equal(await (await respond(new Request(`${SCOPE}assets/Verbs-old.js`), 'asset', 'v2', d)).text(), 'old chunk');
  const missing = await respond(new Request(`${SCOPE}locales/ru/lessons/none.html`), 'data', 'v2', d);
  assert.equal(missing.status, 404);
  assert.equal(await caches.all.get(DATA_CACHE)?.match(`${SCOPE}locales/ru/lessons/none.html`), undefined);
});
