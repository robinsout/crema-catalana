// Bridge on the OLD address (robinsout.github.io/crema-catalana/), BACKLOG H-1.
// Reads the learner's progress and sync code from this origin's localStorage (read only) and redirects to
// the new site with them in the URL fragment: https://crema-catalana.makeitforfun.es/#/import/<payload><route>
// (the fragment is never sent to a server). The decoder is decodeImport in src/services/migration.ts.
//
// Payload: JSON {v:1, progress:<raw string|null>, sync:<raw string|null>} -> UTF-8 -> one marker byte
// (1 = deflate-raw follows, 0 = plain UTF-8 follows) + bytes -> base64url without padding.
//
// Exposed as root.quadernBridge = { NEW_SITE, routeFromHash, encodePayload(progressRaw, syncRaw),
//   targetUrl(storage, hash), run(root) }. Runs by itself when root.document exists and root.quadernBridgeNoRun is not set.
(function (root) {
  'use strict';
  var NEW_SITE = 'https://crema-catalana.makeitforfun.es/';

  function routeFromHash(hash) {
    if (!hash || hash === '#') return '';
    if (hash.indexOf('#/') === 0) return hash.slice(1);
    return '/' + hash.slice(1);
  }

  function readItem(storage, key) {
    try { var v = storage.getItem(key); return typeof v === 'string' ? v : null; } catch (e) { return null; }
  }

  function toBase64Url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return root.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function withMarker(marker, body) {
    var out = new Uint8Array(body.length + 1);
    out[0] = marker;
    out.set(body, 1);
    return out;
  }

  async function deflate(bytes) {
    var stream = new Blob([bytes]).stream().pipeThrough(new root.CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function encodePayload(progressRaw, syncRaw) {
    var bytes = new TextEncoder().encode(JSON.stringify({ v: 1, progress: progressRaw, sync: syncRaw }));
    var out = null;
    if (typeof root.CompressionStream === 'function') {
      try { out = withMarker(1, await deflate(bytes)); } catch (e) { out = null; }
    }
    return toBase64Url(out || withMarker(0, bytes));
  }

  async function targetUrl(storage, hash) {
    var route = routeFromHash(hash);
    var plain = NEW_SITE + (route ? '#' + route : '');
    var progress = null, sync = null;
    if (storage) {
      progress = readItem(storage, 'quadern-catala');
      sync = readItem(storage, 'quadern-sync');
    }
    if (progress === null && sync === null) return plain;
    try { return NEW_SITE + '#/import/' + (await encodePayload(progress, sync)) + route; } catch (e) { return plain; }
  }

  async function run(r) {
    var storage = null;
    try { storage = r.localStorage; } catch (e) { storage = null; }
    var url;
    try { url = await targetUrl(storage, r.location.hash); } catch (e) { url = NEW_SITE; }
    r.location.replace(url);
  }

  root.quadernBridge = { NEW_SITE: NEW_SITE, routeFromHash: routeFromHash, encodePayload: encodePayload, targetUrl: targetUrl, run: run };
  if (root.document && !root.quadernBridgeNoRun) run(root);
})(this);
