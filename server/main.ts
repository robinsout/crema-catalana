// Sync server process: node:http in front of the portable handler (server/app.ts).
// Configuration from the environment (see deploy/quadern-sync.service):
//   PORT (8787), HOST (127.0.0.1), DB_PATH ($STATE_DIRECTORY/sync.db), ALLOWED_ORIGINS (comma separated),
//   RATE_PER_MINUTE (120), MAX_BODY_BYTES (131072)
import { createServer, type IncomingMessage } from 'node:http';
import { join } from 'node:path';
import { createHandler } from './app.ts';
import { SqliteBlobStore } from './store.ts';
import { RateLimiter } from './ratelimit.ts';

export interface ServerOptions {
  port: number;
  host: string;
  dbPath: string;
  allowedOrigins: string[];
  perMinute: number;
  maxBodyBytes: number;
}

// The proxy (Caddy) runs on this machine: trust X-Forwarded-For only from loopback.
function clientAddress(req: IncomingMessage): string {
  const remote = req.socket.remoteAddress ?? '';
  const fromProxy = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return fromProxy && first ? first : remote;
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer | 'too large'> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) return 'too large';
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function startServer(o: ServerOptions): Promise<{ url: string; close: () => Promise<void> }> {
  const store = new SqliteBlobStore(o.dbPath);
  const handle = createHandler({ store, allowedOrigins: o.allowedOrigins, limiter: new RateLimiter({ perMinute: o.perMinute }) });

  const server = createServer(async (req, res) => {
    try {
      const body = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' ? null : await readBody(req, o.maxBodyBytes);
      if (body === 'too large') {
        res.writeHead(413, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end('{"error":"too large"}');
        return;
      }
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
      const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, {
        method: req.method, headers, body: body && body.length ? new Uint8Array(body) : null,
      });
      const response = await handle(request, clientAddress(req));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
      console.error('request failed', e instanceof Error ? e.message : e);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
      res.end('{"error":"internal"}');
    }
  });

  await new Promise<void>((resolve) => server.listen(o.port, o.host, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : o.port;
  return {
    url: `http://${o.host}:${port}`,
    close: () => new Promise((resolve) => server.close(() => { store.close(); resolve(); })),
  };
}

// started as a program: node server/main.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  const env = process.env;
  const server = await startServer({
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '127.0.0.1',
    dbPath: env.DB_PATH ?? join(env.STATE_DIRECTORY ?? '.', 'sync.db'),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? 'https://robinsout.github.io').split(',').map((s) => s.trim()).filter(Boolean),
    perMinute: Number(env.RATE_PER_MINUTE ?? 120),
    maxBodyBytes: Number(env.MAX_BODY_BYTES ?? 131072),
  });
  console.log(`quadern sync listening on ${server.url}`);
  const stop = () => { server.close().then(() => process.exit(0)); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
