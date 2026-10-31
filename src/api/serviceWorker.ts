// The service worker (sw/worker.ts, BACKLOG I-6): registration, its messages, reloading the page.
import { SW_UPDATED } from '../../shared/sw-api.ts';

// Registers the worker of the site folder; `onUpdated` runs when a new version of the site has been
// installed while this page is open. A first install (the page was not controlled yet) is not an update.
export function registerServiceWorker(onUpdated: () => void): void {
  const workers = globalThis.navigator?.serviceWorker;
  if (!workers) return;
  const controlled = workers.controller !== null;
  workers.addEventListener('message', (e) => {
    if (controlled && (e as MessageEvent<{ type?: unknown } | null>).data?.type === SW_UPDATED) onUpdated();
  });
  workers.register('./sw.js').catch(() => { /* no worker: the site works as before */ });
}

export function reloadPage(): void {
  location.reload();
}

// A page of the previous version may ask for code a deploy has removed: reload once (not in a loop)
const RELOADED_AT = 'quadern-reloaded-at';
export function reloadOnMissingCode(): void {
  globalThis.addEventListener?.('vite:preloadError', (e) => {
    let last = 0;
    try { last = Number(sessionStorage.getItem(RELOADED_AT)) || 0; } catch { /* no storage */ }
    if (Date.now() - last < 10_000) return;
    try { sessionStorage.setItem(RELOADED_AT, String(Date.now())); } catch { /* no storage */ }
    e.preventDefault();
    location.reload();
  });
}
