// Kill-switch for the service worker of the OLD site (robinsout.github.io/crema-catalana/), BACKLOG H-1.
// The old site registered ./sw.js (scope /crema-catalana/) and serves the cached app shell for navigations, so
// returning learners would keep seeing the old site and never reach the bridge. sw.js itself always goes to the
// network, and the browser's update check on navigation fetches it (updateViaCache 'imports' bypasses the HTTP
// cache for the script itself): it finds this file instead of the old worker. This worker activates at once,
// deletes the site's caches ("quadern-" only: Cache Storage is shared by all sites of robinsout.github.io),
// unregisters itself and reloads open tabs, which now get the bridge from the network.
// No fetch handler. It never touches localStorage or IndexedDB (progress is read by bridge.js).
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var names = await self.caches.keys();
    await Promise.all(names.filter(function (n) { return n.indexOf('quadern-') === 0; }).map(function (n) { return self.caches.delete(n); }));
    await self.clients.claim();
    await self.registration.unregister();
    var clients = await self.clients.matchAll({ type: 'window' });
    for (var i = 0; i < clients.length; i++) {
      try { await clients[i].navigate(clients[i].url); } catch (e) { /* a client may be gone */ }
    }
  })());
});
