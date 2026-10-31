// Messages between the service worker (sw/worker.ts) and the page (src/api/serviceWorker.ts).
// A new version of the site is installed and its data refreshed: the page may offer a reload.
export const SW_UPDATED = 'quadern-sw-updated';
// The manifest of a build is put into sw.js between these markers (scripts/lib/sw.ts, tests/build.test.ts)
export const MANIFEST_MARK = 'quadern-manifest';
