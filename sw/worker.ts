// The service worker of the site (BACKLOG I-6): wires the browser's events to sw/core.ts.
// Built into dist/sw.js by the service-worker plugin (vite.config.ts) as a classic script, with the
// manifest of the build. Its scope is the site's folder only (/crema-catalana/), not the whole origin.
import { activate, install, respond, routeOf, type Manifest, type SwDeps } from './core.ts';
import { MANIFEST_MARK, SW_UPDATED } from '../shared/sw-api.ts';

declare const __SW_MANIFEST__: string;

// the few worker types used (the project's lib is DOM, not WebWorker)
interface ExtendableEvent extends Event { waitUntil(p: Promise<unknown>): void }
interface FetchEvent extends ExtendableEvent { readonly request: Request; respondWith(r: Promise<Response>): void }
interface WorkerScope {
  registration: { scope: string };
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void>; matchAll(o: { type: 'window' }): Promise<{ postMessage(m: unknown): void }[]> };
  addEventListener(type: 'install' | 'activate', f: (e: ExtendableEvent) => void): void;
  addEventListener(type: 'fetch', f: (e: FetchEvent) => void): void;
}

const worker = self as unknown as WorkerScope;
const manifest = JSON.parse(decodeURIComponent(__SW_MANIFEST__.slice(MANIFEST_MARK.length + 1, -MANIFEST_MARK.length - 1))) as Manifest;
const deps = (): SwDeps => ({ caches, fetch: (req, init) => fetch(req, init), scope: worker.registration.scope });

// a new version takes over at once: the previous one stays in the cache for pages still open
worker.addEventListener('install', (e) => e.waitUntil(install(manifest, deps()).then(() => worker.skipWaiting())));

worker.addEventListener('activate', (e) => e.waitUntil((async () => {
  await activate(manifest.version, deps());
  await worker.clients.claim();
  for (const client of await worker.clients.matchAll({ type: 'window' })) client.postMessage({ type: SW_UPDATED });
})()));

worker.addEventListener('fetch', (e) => {
  const route = routeOf(e.request, worker.registration.scope);
  if (route !== 'pass') e.respondWith(respond(e.request, route, manifest.version, deps()));
});
