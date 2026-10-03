// Blob storage on SQLite (node:sqlite, no dependencies). A blob has a version that grows on every write.
import { DatabaseSync } from 'node:sqlite';

export type PutResult = { ok: true; version: number } | { ok: false; version: number | null };

export interface BlobStore {
  get(id: string): { data: string; version: number } | null;
  put(id: string, data: string, expected: number | null): PutResult;
  delete(id: string): void;
}

export class SqliteBlobStore implements BlobStore {
  readonly #db: DatabaseSync;

  constructor(path: string) {
    this.#db = new DatabaseSync(path);
    this.#db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS blobs (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        version INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
    `);
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
    const now = Date.now();
    if (expected === null) {
      this.#db.prepare('INSERT INTO blobs (id, data, version, updated_at) VALUES (?, ?, ?, ?)').run(id, data, version, now);
    } else {
      const r = this.#db.prepare('UPDATE blobs SET data = ?, version = ?, updated_at = ? WHERE id = ? AND version = ?')
        .run(data, version, now, id, expected);
      if (r.changes !== 1) return { ok: false, version: this.get(id)?.version ?? null };
    }
    return { ok: true, version };
  }

  delete(id: string): void {
    this.#db.prepare('DELETE FROM blobs WHERE id = ?').run(id);
  }

  close(): void {
    this.#db.close();
  }
}
