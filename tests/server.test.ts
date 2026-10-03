// @vitest-environment node
// Sync server: stores encrypted progress blobs by id. Tested through its Request → Response handler.
import { test, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import { createHandler } from '../server/app.ts';
import { SqliteBlobStore } from '../server/store.ts';
import { RateLimiter } from '../server/ratelimit.ts';

const SITE = 'https://robinsout.github.io';
const ID = 'a'.repeat(32);
let now = 0;
let handle: ReturnType<typeof createHandler>;

beforeEach(() => {
  now = 1_000_000;
  handle = createHandler({
    store: new SqliteBlobStore(':memory:'),
    allowedOrigins: [SITE],
    limiter: new RateLimiter({ limit: 1000, windowMs: 60_000, now: () => now }),
    maxBlobChars: 100,
  });
});

const req = (method: string, path: string, body?: unknown, origin: string | null = SITE) =>
  handle(new Request(`https://188.245.182.47${path}`, {
    method,
    headers: { ...(origin ? { origin } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), '203.0.113.7');

test('health check', async () => {
  const res = await req('GET', '/v1/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('a blob is created, read and updated with optimistic versions', async () => {
  assert.equal((await req('GET', `/v1/blob/${ID}`)).status, 404);
  const created = await req('PUT', `/v1/blob/${ID}`, { data: 'ciphertext-1', version: null });
  assert.equal(created.status, 200);
  assert.deepEqual(await created.json(), { version: 1 });
  const read = await req('GET', `/v1/blob/${ID}`);
  assert.deepEqual(await read.json(), { data: 'ciphertext-1', version: 1 });
  const updated = await req('PUT', `/v1/blob/${ID}`, { data: 'ciphertext-2', version: 1 });
  assert.deepEqual(await updated.json(), { version: 2 });
});

test('a write based on an old version is refused with the current version', async () => {
  await req('PUT', `/v1/blob/${ID}`, { data: 'x', version: null });
  await req('PUT', `/v1/blob/${ID}`, { data: 'y', version: 1 });
  const stale = await req('PUT', `/v1/blob/${ID}`, { data: 'z', version: 1 });
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), { version: 2 });
  const createAgain = await req('PUT', `/v1/blob/${ID}`, { data: 'z', version: null });
  assert.equal(createAgain.status, 409);
});

test('a blob can be deleted', async () => {
  await req('PUT', `/v1/blob/${ID}`, { data: 'x', version: null });
  assert.equal((await req('DELETE', `/v1/blob/${ID}`)).status, 204);
  assert.equal((await req('GET', `/v1/blob/${ID}`)).status, 404);
});

test('bad ids, bodies and oversized blobs are rejected', async () => {
  assert.equal((await req('GET', '/v1/blob/not-an-id')).status, 400);
  assert.equal((await req('GET', `/v1/blob/${'A'.repeat(32)}`)).status, 400);
  assert.equal((await req('PUT', `/v1/blob/${ID}`, { data: 42, version: null })).status, 400);
  assert.equal((await req('PUT', `/v1/blob/${ID}`, { data: 'x', version: 'one' })).status, 400);
  assert.equal((await req('PUT', `/v1/blob/${ID}`, { data: 'x'.repeat(101), version: null })).status, 413);
  assert.equal((await req('GET', '/v1/nope')).status, 404);
  assert.equal((await req('POST', `/v1/blob/${ID}`, { data: 'x' })).status, 405);
});

test('CORS: the site is allowed, other origins are not', async () => {
  const pre = await req('OPTIONS', `/v1/blob/${ID}`);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), SITE);
  assert.match(pre.headers.get('access-control-allow-methods') ?? '', /PUT/);
  const ok = await req('GET', '/v1/health');
  assert.equal(ok.headers.get('access-control-allow-origin'), SITE);
  assert.equal(ok.headers.get('vary'), 'Origin');
  const evil = await req('GET', `/v1/blob/${ID}`, undefined, 'https://evil.example');
  assert.equal(evil.status, 403);
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
});

test('responses are not cached and not sniffed', async () => {
  const res = await req('GET', '/v1/health');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('too many requests from one address are throttled', async () => {
  handle = createHandler({
    store: new SqliteBlobStore(':memory:'),
    allowedOrigins: [SITE],
    limiter: new RateLimiter({ limit: 5, windowMs: 60_000, now: () => now }),
  });
  for (let i = 0; i < 5; i++) assert.equal((await req('GET', '/v1/health')).status, 200);
  const limited = await req('GET', '/v1/health');
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  now += 60_000;
  assert.equal((await req('GET', '/v1/health')).status, 200);
});

test('the store keeps data between instances on disk', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'sync-'));
  try {
    const a = new SqliteBlobStore(join(dir, 'sync.db'));
    a.put(ID, 'persisted', null);
    a.close();
    const b = new SqliteBlobStore(join(dir, 'sync.db'));
    assert.deepEqual(b.get(ID), { data: 'persisted', version: 1 });
    b.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the Node HTTP server serves the handler, takes the client address from the proxy and limits bodies', async () => {
  const { startServer } = await import('../server/main.ts');
  const server = await startServer({ port: 0, host: '127.0.0.1', dbPath: ':memory:', allowedOrigins: [SITE], perMinute: 2, maxBodyBytes: 1000, newBlobsPerHour: 20, maxTotalChars: 1e6, keepDays: 730 });
  try {
    const health = await fetch(`${server.url}/v1/health`, { headers: { origin: SITE } });
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('access-control-allow-origin'), SITE);
    // each forwarded address has its own limit (the proxy runs on the same machine)
    for (const ip of ['198.51.100.1', '198.51.100.2']) {
      for (let i = 0; i < 2; i++) assert.equal((await fetch(`${server.url}/v1/health`, { headers: { 'x-forwarded-for': ip } })).status, 200);
    }
    assert.equal((await fetch(`${server.url}/v1/health`, { headers: { 'x-forwarded-for': '198.51.100.1' } })).status, 429);
    const big = await fetch(`${server.url}/v1/blob/${ID}`, {
      method: 'PUT', headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.9' },
      body: JSON.stringify({ data: 'x'.repeat(5000), version: null }),
    });
    assert.equal(big.status, 413);
  } finally {
    await server.close();
  }
});

// ---------- protection against filling the disk (audit M2) ----------

const ID2 = 'b'.repeat(32);
const ID3 = 'c'.repeat(32);
const ID4 = 'd'.repeat(32);

function guarded(o: { newBlobs?: number; maxTotalChars?: number; maxBlobChars?: number } = {}) {
  return createHandler({
    store: new SqliteBlobStore(':memory:'),
    allowedOrigins: [SITE],
    limiter: new RateLimiter({ limit: 1000, windowMs: 60_000, now: () => now }),
    creationLimiter: new RateLimiter({ limit: o.newBlobs ?? 1000, windowMs: 3_600_000, now: () => now }),
    maxTotalChars: o.maxTotalChars ?? 1e9,
    ...(o.maxBlobChars ? { maxBlobChars: o.maxBlobChars } : {}),
  });
}

test('by default a blob may be at most 16 KB: real progress is a few hundred bytes', async () => {
  handle = guarded();
  assert.equal((await req('PUT', `/v1/blob/${ID}`, { data: 'x'.repeat(16 * 1024), version: null })).status, 200);
  assert.equal((await req('PUT', `/v1/blob/${ID2}`, { data: 'x'.repeat(16 * 1024 + 1), version: null })).status, 413);
});

test('one address may create only a few new blobs per hour; updates do not count', async () => {
  handle = guarded({ newBlobs: 2 });
  assert.equal((await req('PUT', `/v1/blob/${ID}`, { data: 'a', version: null })).status, 200);
  assert.equal((await req('PUT', `/v1/blob/${ID2}`, { data: 'b', version: null })).status, 200);
  for (let v = 1; v <= 3; v++) assert.equal((await req('PUT', `/v1/blob/${ID}`, { data: `a${v}`, version: v })).status, 200);
  const third = await req('PUT', `/v1/blob/${ID3}`, { data: 'c', version: null });
  assert.equal(third.status, 429);
  assert.ok(Number(third.headers.get('retry-after')) > 0);
  now += 3_600_000;
  assert.equal((await req('PUT', `/v1/blob/${ID3}`, { data: 'c', version: null })).status, 200);
});

test('when the database is full new blobs are refused, existing ones can still change', async () => {
  handle = guarded({ maxTotalChars: 10 });
  assert.equal((await req('PUT', `/v1/blob/${ID}`, { data: '123456', version: null })).status, 200);
  assert.equal((await req('PUT', `/v1/blob/${ID2}`, { data: '1234', version: null })).status, 200);
  const full = await req('PUT', `/v1/blob/${ID3}`, { data: '1', version: null });
  assert.equal(full.status, 507);
  assert.equal((await req('PUT', `/v1/blob/${ID}`, { data: '654321', version: 1 })).status, 200);
  assert.equal((await req('PUT', `/v1/blob/${ID}`, { data: '6543210', version: 2 })).status, 507, 'an update may not grow a full database');
  assert.equal((await req('DELETE', `/v1/blob/${ID2}`)).status, 204);
  assert.equal((await req('PUT', `/v1/blob/${ID4}`, { data: '1234', version: null })).status, 200, 'deleting frees space');
});

test('the store knows its size and forgets blobs untouched for too long', () => {
  let clock = 0;
  const store = new SqliteBlobStore(':memory:', { now: () => clock });
  store.put(ID, 'old', null);
  clock = 1000;
  store.put(ID2, 'newer', null);
  assert.equal(store.totalChars(), 8);
  assert.equal(store.purgeOlderThan(500), 1);
  assert.equal(store.get(ID), null);
  assert.deepEqual(store.get(ID2), { data: 'newer', version: 1 });
  assert.equal(store.totalChars(), 5);
  store.close();
});

test('the server purges old blobs when it starts', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { startServer } = await import('../server/main.ts');
  const dir = mkdtempSync(join(tmpdir(), 'sync-'));
  try {
    const old = new SqliteBlobStore(join(dir, 'sync.db'), { now: () => Date.now() - 800 * 86_400_000 });
    old.put(ID, 'from long ago', null);
    old.close();
    const server = await startServer({
      port: 0, host: '127.0.0.1', dbPath: join(dir, 'sync.db'), allowedOrigins: [SITE],
      perMinute: 100, maxBodyBytes: 32_768, newBlobsPerHour: 20, maxTotalChars: 1e6, keepDays: 730,
    });
    assert.equal((await fetch(`${server.url}/v1/blob/${ID}`)).status, 404);
    await server.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
