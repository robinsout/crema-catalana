// @vitest-environment node
// The bridge on the old Pages address (BACKLOG H-1): redirects to the new site with the progress in the fragment.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'bridge');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const NEW = 'https://crema-catalana.makeitforfun.es/';

interface Bridge {
  NEW_SITE: string;
  routeFromHash(h: string): string;
  encodePayload(progress: string | null, sync: string | null): Promise<string>;
  targetUrl(storage: unknown, hash: string): Promise<string>;
}
// the script is evaluated with a fake global: no document, so it does not run by itself
function load(extra: Record<string, unknown> = {}): Bridge {
  const g: Record<string, unknown> = { btoa: globalThis.btoa, CompressionStream: globalThis.CompressionStream, ...extra };
  new Function(read('bridge.js')).call(g);
  return g.quadernBridge as Bridge;
}
const bridge = load();

function decode(payload: string): { marker: number; json: unknown } {
  const bytes = Buffer.from(payload, 'base64url');
  const body = bytes.subarray(1);
  const text = bytes[0] === 1 ? inflateRawSync(body).toString('utf8') : body.toString('utf8');
  return { marker: bytes[0]!, json: JSON.parse(text) };
}
const store = (data: Record<string, string>) => ({ getItem: (k: string) => data[k] ?? null });

test('routeFromHash keeps the route of the old address', () => {
  assert.equal(bridge.routeFromHash(''), '');
  assert.equal(bridge.routeFromHash('#'), '');
  assert.equal(bridge.routeFromHash('#/ru/lesson/b1-04'), '/ru/lesson/b1-04');
  assert.equal(bridge.routeFromHash('#b1-04'), '/b1-04');
  assert.equal(bridge.routeFromHash('#pla'), '/pla');
  assert.equal(bridge.routeFromHash('#/ru/verbs?x=1'), '/ru/verbs?x=1');
});

test('encodePayload: marker 1, deflate-raw, raw strings in the JSON', async () => {
  const progress = '{"done":{"b1-01":true},"last":"b1-01"}';
  const sync = '"код-ключ"';
  const p = await bridge.encodePayload(progress, sync);
  assert.match(p, /^[A-Za-z0-9_-]+$/);
  const d = decode(p);
  assert.equal(d.marker, 1);
  assert.deepEqual(d.json, { v: 1, progress, sync });
  assert.deepEqual(decode(await bridge.encodePayload(null, 'x')).json, { v: 1, progress: null, sync: 'x' });
});

test('encodePayload without CompressionStream: marker 0 and plain UTF-8', async () => {
  const b = load({ CompressionStream: undefined });
  const d = decode(await b.encodePayload('{"a":"ё"}', null));
  assert.equal(d.marker, 0);
  assert.deepEqual(d.json, { v: 1, progress: '{"a":"ё"}', sync: null });
});

test('encodePayload falls back to plain bytes when compression throws', async () => {
  const b = load({ CompressionStream: class { constructor() { throw new Error('no'); } } });
  assert.equal(decode(await b.encodePayload('{}', null)).marker, 0);
});

test('targetUrl with data goes to the import route and keeps the old route', async () => {
  const url = await bridge.targetUrl(store({ 'quadern-catala': '{"done":{}}' }), '#/ru/lesson/b1-04');
  assert.ok(url.startsWith(NEW + '#/import/'));
  assert.ok(url.endsWith('/ru/lesson/b1-04'));
  const payload = url.slice((NEW + '#/import/').length, -'/ru/lesson/b1-04'.length);
  assert.match(payload, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decode(payload).json, { v: 1, progress: '{"done":{}}', sync: null });
  assert.ok((await bridge.targetUrl(store({ 'quadern-sync': 'code' }), '')).startsWith(NEW + '#/import/'));
});

test('targetUrl without data is the plain new address with the route', async () => {
  assert.equal(await bridge.targetUrl(store({}), ''), NEW);
  assert.equal(await bridge.targetUrl(store({}), '#'), NEW);
  assert.equal(await bridge.targetUrl(store({}), '#b1-04'), NEW + '#/b1-04');
  assert.equal(await bridge.targetUrl(null, '#/ru/plan'), NEW + '#/ru/plan');
});

test('a storage that throws means no data; nothing is written or removed', async () => {
  const calls: string[] = [];
  const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => calls.push('set'), removeItem: () => calls.push('remove') };
  assert.equal(await bridge.targetUrl(throwing, '#/ru/plan'), NEW + '#/ru/plan');
  const spy = { getItem: (k: string) => (k === 'quadern-catala' ? '{}' : null), setItem: () => calls.push('set'), removeItem: () => calls.push('remove'), clear: () => calls.push('clear') };
  await bridge.targetUrl(spy, '');
  assert.deepEqual(calls, []);
  assert.ok(!/setItem|removeItem|\.clear\(/.test(read('bridge.js')));
});

test('the progress of a whole course fits in a reasonable address', async () => {
  const at = 1_791_104_305_838;
  const p = { done: {} as Record<string, boolean>, doneAt: {} as Record<string, number>, exercises: {} as Record<string, unknown>, sections: {} as Record<string, unknown>, reading: {} as Record<string, unknown>, last: 'b1-09' };
  for (let i = 0; i < 40; i++) {
    const id = `b${1 + (i % 3)}-${String(i).padStart(2, '0')}`;
    p.done[id] = true;
    p.doneAt[id] = at + i * 997;
    for (let e = 0; e < 4; e++) p.exercises[`${id}/exercise-${e}`] = { score: e, total: 6, at: at + i * 991 + e };
    for (let s = 0; s < 10; s++) p.sections[`${id}/section-${s}`] = { done: s % 4 !== 0, at: at + i * 983 + s * 37 };
    p.reading[id] = { section: 'section-9', at: at + i * 977 };
  }
  const url = await bridge.targetUrl(store({ 'quadern-catala': JSON.stringify(p), 'quadern-sync': 'ABCD-EFGH-IJKL-MNOP' }), '#/ru/plan');
  assert.ok(url.length < 16_000, `${url.length} characters`);
});

// needs src/services/migration.ts (decodeImport), written separately
test('the site decoder reads what the bridge encodes', async () => {
  const { decodeImport } = await import('../src/services/migration.ts');
  const { parseProgress } = await import('../src/services/progress.ts');
  const progress = JSON.stringify({ done: { 'b1-01': true }, doneAt: { 'b1-01': 5 }, last: 'b1-01' });
  const { generateCode } = await import('../src/services/sync.ts');
  const code = generateCode();
  const payload = await bridge.encodePayload(progress, JSON.stringify({ code, lastSyncAt: 7 }));
  const got = await decodeImport(payload);
  assert.deepEqual(got?.progress, parseProgress(progress));
  assert.equal(got?.syncCode, code);
});

// --- sw.js: kill-switch for the old service worker ---
function runWorker() {
  const log: string[] = [];
  const handlers: Record<string, (e: { waitUntil(p: Promise<unknown>): void }) => void> = {};
  const clients = [
    { url: 'https://x/a', navigate: async () => { log.push('navigate a'); throw new Error('gone'); } },
    { url: 'https://x/b', navigate: async (u: string) => { log.push('navigate b ' + u); } },
  ];
  const self = {
    addEventListener: (t: string, f: (typeof handlers)[string]) => { handlers[t] = f; },
    skipWaiting: async () => { log.push('skipWaiting'); },
    caches: {
      keys: async () => ['quadern-shell-abc', 'quadern-data', 'other-site', 'my-quadern-x'],
      delete: async (n: string) => { log.push('delete ' + n); return true; },
    },
    clients: { claim: async () => { log.push('claim'); }, matchAll: async (o: unknown) => { log.push('matchAll ' + JSON.stringify(o)); return clients; } },
    registration: { unregister: async () => { log.push('unregister'); return true; } },
  };
  new Function('self', read('sw.js'))(self);
  return { log, handlers };
}

test('sw.js: installs at once and has no fetch handler', () => {
  const { log, handlers } = runWorker();
  assert.deepEqual(Object.keys(handlers).sort(), ['activate', 'install']);
  handlers.install!({ waitUntil() {} });
  assert.deepEqual(log, ['skipWaiting']);
});

test('sw.js: activation clears only quadern- caches, then claims, unregisters and reloads tabs', async () => {
  const { log, handlers } = runWorker();
  let done: Promise<unknown> = Promise.resolve();
  handlers.activate!({ waitUntil: (p) => { done = p; } });
  await done;
  assert.deepEqual(log.filter((l) => l.startsWith('delete')).sort(), ['delete quadern-data', 'delete quadern-shell-abc']);
  assert.ok(!log.includes('delete other-site') && !log.includes('delete my-quadern-x'));
  const i = (s: string) => log.indexOf(s);
  assert.ok(i('claim') > Math.max(i('delete quadern-data'), i('delete quadern-shell-abc')));
  assert.ok(i('unregister') > i('claim'));
  assert.ok(i('navigate a') > i('unregister'));
  assert.ok(log.includes('navigate b https://x/b'), 'one failing client does not stop the others');
});

test('sw.js never touches storage', () => {
  assert.ok(!/localStorage|indexedDB|fetch\s*\(|addEventListener\(\s*['"]fetch/.test(read('sw.js').replace(/\/\/.*$/gm, '')));
});

test('index.html: fallback text, noscript refresh, strict and self-contained', () => {
  const html = read('index.html');
  assert.match(html, /<html lang="ru">/);
  assert.match(html, /<noscript><meta http-equiv="refresh" content="0; url=https:\/\/crema-catalana\.makeitforfun\.es\/"><\/noscript>/);
  assert.match(html, /Content-Security-Policy[^>]*default-src 'none'/);
  for (const t of ['Сайт переехал', 'The site has moved', 'El sitio se ha trasladado']) assert.ok(html.includes(t), t);
  assert.ok(html.includes('<a href="https://crema-catalana.makeitforfun.es/">crema-catalana.makeitforfun.es</a>'));
  assert.ok(html.includes('<script src="bridge.js"></script>'));
  const urls = [...html.matchAll(/\b(?:src|href)="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(urls.filter((u) => u !== NEW && u !== 'bridge.js'), []);
  assert.ok(!/serviceWorker/.test(html + read('bridge.js')));
});
