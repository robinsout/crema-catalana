// Sync API as a portable handler: (Request, client address) → Response.
// Runs under Node (server/main.ts); could run on any Fetch-API platform with another BlobStore.
import { SYNC_ID_RE, type PutBlobRequest } from '../shared/sync-api.ts';
import type { BlobStore } from './store.ts';
import type { RateLimiter } from './ratelimit.ts';

export interface HandlerOptions {
  store: BlobStore;
  allowedOrigins: string[];
  limiter: RateLimiter; // all requests per address
  creationLimiter?: RateLimiter; // new blobs per address
  maxBlobChars?: number; // base64 characters of one blob
  maxTotalChars?: number; // all blobs together: protects the disk
}

const BASE_HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

// A real progress blob is a few hundred characters; 16 KB leaves room for years of lessons.
export const DEFAULT_MAX_BLOB_CHARS = 16 * 1024;

export function createHandler({
  store, allowedOrigins, limiter, creationLimiter, maxBlobChars = DEFAULT_MAX_BLOB_CHARS, maxTotalChars = Infinity,
}: HandlerOptions) {
  return async function handle(request: Request, client: string): Promise<Response> {
    const origin = request.headers.get('origin');
    const cors: Record<string, string> = origin && allowedOrigins.includes(origin)
      ? { 'access-control-allow-origin': origin, vary: 'Origin' }
      : { vary: 'Origin' };
    const json = (status: number, body?: unknown, extra: Record<string, string> = {}) =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { ...BASE_HEADERS, ...cors, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...extra },
      });

    // browsers send Origin; a page on another site must not use the API
    if (origin && !allowedOrigins.includes(origin)) return json(403, { error: 'origin not allowed' });

    const wait = limiter.check(client);
    if (wait > 0) return json(429, { error: 'too many requests' }, { 'retry-after': String(wait) });

    if (request.method === 'OPTIONS') {
      return json(204, undefined, {
        'access-control-allow-methods': 'GET, PUT, DELETE',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400',
      });
    }

    const path = new URL(request.url).pathname;
    if (path === '/v1/health' && request.method === 'GET') return json(200, { ok: true });

    const m = /^\/v1\/blob\/([^/]+)$/.exec(path);
    if (!m) return json(404, { error: 'not found' });
    const id = m[1] ?? '';
    if (!SYNC_ID_RE.test(id)) return json(400, { error: 'bad id' });

    switch (request.method) {
      case 'GET': {
        const blob = store.get(id);
        return blob ? json(200, blob) : json(404, { error: 'not found' });
      }
      case 'PUT': {
        const text = await request.text();
        if (text.length > maxBlobChars + 200) return json(413, { error: 'too large' });
        let body: Partial<PutBlobRequest>;
        try { body = JSON.parse(text) as Partial<PutBlobRequest>; } catch { return json(400, { error: 'bad json' }); }
        const { data, version } = body;
        if (typeof data !== 'string' || !(version === null || (Number.isInteger(version) && (version as number) > 0))) {
          return json(400, { error: 'expected { data: string, version: number | null }' });
        }
        if (data.length > maxBlobChars) return json(413, { error: 'too large' });
        const current = store.get(id);
        const grows = data.length - (current?.data.length ?? 0);
        if (grows > 0 && store.totalChars() + grows > maxTotalChars) return json(507, { error: 'storage full' });
        if (!current && version === null && creationLimiter) {
          const wait = creationLimiter.check(client);
          if (wait > 0) return json(429, { error: 'too many new blobs' }, { 'retry-after': String(wait) });
        }
        const r = store.put(id, data, version ?? null);
        return r.ok ? json(200, { version: r.version }) : json(409, { version: r.version });
      }
      case 'DELETE':
        store.delete(id);
        return json(204);
      default:
        return json(405, { error: 'method not allowed' });
    }
  };
}
