// Blob storage on SQLite (node:sqlite, no dependencies). A blob has a version that grows on every write.
import { DatabaseSync } from 'node:sqlite';

export type PutResult = { ok: true; version: number } | { ok: false; version: number | null };

export interface BlobStore {
  get(id: string): { data: string; version: number } | null;
  put(id: string, data: string, expected: number | null): PutResult;
  delete(id: string): void;
  totalChars(): number;
}

export class SqliteBlobStore implements BlobStore {
  readonly #db: DatabaseSync;
  readonly #now: () => number;
  #total: number; // characters of all blobs, kept in memory

  constructor(path: string, { now = () => Date.now() }: { now?: () => number } = {}) {
    this.#now = now;
    this.#db = new DatabaseSync(path);
    this.#db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS blobs (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        version INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS blobs_updated_at ON blobs (updated_at);
    `);
    this.#total = Number((this.#db.prepare('SELECT COALESCE(SUM(LENGTH(data)), 0) AS n FROM blobs').get() as { n: number }).n);
  }

  get(id: string): { data: string; version: number } | null {
    const row = this.#db.prepare('SELECT data, version FROM blobs WHERE id = ?').get(id) as
      { data: string; version: number } | undefined;
    return row ? { data: row.data, version: row.version } : null;
  }

  // writes only when the stored version is the expected one (optimistic concurrency)
  put(id: string, data: string, expected: number | null): PutResult {
    const current = this.get(id);
    if ((current?.version ?? null) !== expected) return { ok: false, version: current?.version ?? null };
    const version = (expected ?? 0) + 1;
    const now = this.#now();
    if (expected === null) {
      this.#db.prepare('INSERT INTO blobs (id, data, version, updated_at) VALUES (?, ?, ?, ?)').run(id, data, version, now);
    } else {
      const r = this.#db.prepare('UPDATE blobs SET data = ?, version = ?, updated_at = ? WHERE id = ? AND version = ?')
        .run(data, version, now, id, expected);
      if (r.changes !== 1) return { ok: false, version: this.get(id)?.version ?? null };
    }
    this.#total += data.length - (current?.data.length ?? 0);
    return { ok: true, version };
  }

  delete(id: string): void {
    const current = this.get(id);
    this.#db.prepare('DELETE FROM blobs WHERE id = ?').run(id);
    if (current) this.#total -= current.data.length;
  }

  totalChars(): number {
    return this.#total;
  }

  // deletes blobs not written for `ms`; returns how many
  purgeOlderThan(ms: number): number {
    const before = this.#now() - ms;
    const freed = this.#db.prepare('SELECT COALESCE(SUM(LENGTH(data)), 0) AS n FROM blobs WHERE updated_at < ?').get(before) as { n: number };
    const r = this.#db.prepare('DELETE FROM blobs WHERE updated_at < ?').run(before);
    this.#total -= Number(freed.n);
    return Number(r.changes);
  }

  close(): void {
    this.#db.close();
  }
}
