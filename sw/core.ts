// The service worker's logic (BACKLOG I-6), with Cache Storage and the network passed in (tests use
// fakes; sw/worker.ts wires the browser's). Instant repeat visits and the lessons already opened offline:
// - a version is one build. Its page and code are kept on install (code with the same hashed name is
//   copied from the previous version, not downloaded again); fonts are kept when used;
// - data (course, lessons, vocabularies, verbs) is kept when read and served from the cache; a new
//   version refreshes the data already kept on install, and open pages are told (they offer a reload);
// - the previous version stays one more round, for pages still open with its code;
// - audio clips, the sync server, the counter and other sites of the origin are not touched.
// Cache names start with "quadern-": other sites of robinsout.github.io share the Cache Storage.

export const SHELL_PREFIX = 'quadern-shell-';
export const DATA_CACHE = 'quadern-data';

// Made by the build (scripts/lib/sw.ts); paths are relative to the site
export interface Manifest {
  version: string; // changes with any change of the site (code or content)
  shell: string[]; // kept on install: the code of the page (JS, CSS)
  assets: string[]; // every hashed file of the build: kept when used, carried over to the next version
  data: string[]; // the course data every page needs, kept on install
}

export interface SwDeps {
  caches: CacheStorage;
  fetch: (req: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  scope: string; // the site's address, ending with "/"
}

export type Route = 'page' | 'asset' | 'data' | 'pass';

export function routeOf(req: { method: string; url: string; mode: RequestMode }, scope: string): Route {
  if (req.method !== 'GET' || !req.url.startsWith(scope)) return 'pass';
  const path = new URL(req.url).pathname.slice(new URL(scope).pathname.length);
  if (req.mode === 'navigate') return path === '' || path === 'index.html' ? 'page' : 'pass';
  if (path.startsWith('assets/')) return 'asset';
  // Safari plays audio from a worker unreliably (range requests): clips stay with the browser's cache
  if (path === 'sw.js' || path.startsWith('audio/clips/')) return 'pass';
  return 'data';
}

const shellName = (version: string): string => SHELL_PREFIX + version;
const fresh: RequestInit = { cache: 'no-cache' };

async function download(url: string, d: SwDeps): Promise<Response> {
  const res = await d.fetch(url, fresh);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res;
}

export async function install(m: Manifest, d: SwDeps): Promise<void> {
  const shell = await d.caches.open(shellName(m.version));
  const url = (path: string): string => new URL(path, d.scope).href;
  // hashed names never change content: take what an earlier version already has
  const carried = new Set<string>();
  for (const path of m.assets) {
    const hit = await d.caches.match(url(path));
    if (hit) { await shell.put(url(path), hit); carried.add(path); }
  }
  const missing = m.shell.filter((p) => !carried.has(p));
  const downloads = await Promise.all([d.scope, ...missing.map(url)].map(async (u) => [u, await download(u, d)] as const));
  for (const [u, res] of downloads) await shell.put(u, res);
  const data = await d.caches.open(DATA_CACHE);
  await Promise.all(m.data.map(async (p) => data.put(url(p), await download(url(p), d))));
  await refreshData(d, new Set(m.data.map(url)));
}

// The data already kept, from the new version: here, not on activate, since pages wait for an activating worker
async function refreshData(d: SwDeps, done: Set<string>): Promise<void> {
  const data = await d.caches.open(DATA_CACHE);
  await Promise.all((await data.keys()).filter((req) => !done.has(req.url)).map(async (req) => {
    try {
      const res = await d.fetch(req.url, fresh);
      if (res.ok) await data.put(req.url, res);
      else if (res.status === 404) await data.delete(req.url);
    } catch { /* offline: keep what is there */ }
  }));
}

export async function activate(version: string, d: SwDeps): Promise<void> {
  // keys come in the order of creation: the last older shell is the previous version
  const old = (await d.caches.keys()).filter((n) => n.startsWith(SHELL_PREFIX) && n !== shellName(version));
  await Promise.all(old.slice(0, -1).map((n) => d.caches.delete(n)));
}

export async function respond(req: Request, route: Exclude<Route, 'pass'>, version: string, d: SwDeps): Promise<Response> {
  if (route === 'page') {
    const shell = await d.caches.open(shellName(version));
    return (await shell.match(d.scope)) ?? d.fetch(req);
  }
  // code: from any version (a page of the previous one asks for its own); data: from the data cache
  const hit = route === 'asset' ? await d.caches.match(req.url) : await (await d.caches.open(DATA_CACHE)).match(req.url);
  if (hit) return hit;
  const res = await d.fetch(req);
  if (res.ok) await (await d.caches.open(route === 'asset' ? shellName(version) : DATA_CACHE)).put(req.url, res.clone());
  return res;
}
