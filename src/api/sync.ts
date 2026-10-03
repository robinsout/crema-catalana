// The sync server (see server/). Its address is set at build time: VITE_SYNC_URL.
import type { BlobResponse, PutBlobRequest, VersionResponse } from '../../shared/sync-api.ts';

export const SYNC_URL: string = (import.meta.env.VITE_SYNC_URL as string | undefined) ?? 'https://188.245.182.47';

export class SyncHttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`sync server: ${status}`);
    this.status = status;
  }
}

const blobUrl = (id: string) => `${SYNC_URL}/v1/blob/${id}`;

export const syncApi = {
  async get(id: string): Promise<BlobResponse | null> {
    const res = await fetch(blobUrl(id), { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new SyncHttpError(res.status);
    return (await res.json()) as BlobResponse;
  },

  async put(id: string, data: string, version: number | null): Promise<{ ok: boolean; version: number | null }> {
    const body: PutBlobRequest = { data, version };
    const res = await fetch(blobUrl(id), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 409) return { ok: false, version: ((await res.json()) as { version: number | null }).version };
    if (!res.ok) throw new SyncHttpError(res.status);
    return { ok: true, version: ((await res.json()) as VersionResponse).version };
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(blobUrl(id), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new SyncHttpError(res.status);
  },
};
