// Contract of the sync API, shared by the site (src/api/sync.ts) and the server (server/app.ts).
// The server stores opaque encrypted blobs; it never sees progress, codes or keys.

export const SYNC_ID_RE = /^[0-9a-f]{32}$/;

// GET /v1/blob/:id → 200
export interface BlobResponse {
  data: string; // base64 of iv + AES-GCM ciphertext
  version: number;
}

// PUT /v1/blob/:id
export interface PutBlobRequest {
  data: string;
  version: number | null; // the version the change is based on; null = create
}

// PUT → 200, and 409 (with the current version) when the blob changed meanwhile
export interface VersionResponse {
  version: number;
}
