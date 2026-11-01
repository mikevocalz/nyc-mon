// Browser half of the staged model upload (storage/stagedUpload.ts). Files up
// to MON_MODEL_CHUNK_BYTES keep the single multipart request; larger files go
// up as raw chunks so no request reaches Vercel's 4.5 MB function body limit.
import { MON_MODEL_CHUNK_BYTES } from '../../../collections/monModelFile.ts';

export const UPLOADS_API = '/payload-api/console/models/uploads';

/** What a request came back with: null on success, or the message to show. */
export type SendResult<T> = { ok: true; data: T } | { ok: false; message: string };

export type ChunkTransport = {
  /** JSON request; resolves with the parsed body or the server's first error message. */
  json: <T>(url: string, method: 'POST' | 'DELETE', body?: unknown) => Promise<SendResult<T>>;
  /** Raw PUT of one chunk, reporting the bytes sent so far within it. */
  chunk: (url: string, body: Blob, onSent: (bytes: number) => void) => Promise<SendResult<unknown>>;
};

export const needsChunkedUpload = (size: number) => size > MON_MODEL_CHUNK_BYTES;

/**
 * Sends `file` in order, then commits it to `target` ({ id } replaces a model,
 * { speciesId } adds one). Progress is whole-file percent. On any failure the
 * staged parts are dropped and the message is returned.
 */
export async function uploadModelInChunks(
  file: Blob,
  name: string,
  target: { id: string } | { speciesId: string },
  transport: ChunkTransport,
  onProgress: (percent: number) => void,
): Promise<string | null> {
  const started = await transport.json<{ token: string; chunkBytes: number; chunks: number }>(UPLOADS_API, 'POST', { name, size: file.size });
  if (!started.ok) return started.message;
  const { token, chunkBytes, chunks } = started.data;
  const base = `${UPLOADS_API}/${encodeURIComponent(token)}`;
  for (let index = 0; index < chunks; index++) {
    const from = index * chunkBytes;
    const sent = await transport.chunk(`${base}/${index}`, file.slice(from, from + chunkBytes), (bytes) => {
      onProgress(Math.min(99, Math.round(((from + bytes) / file.size) * 100)));
    });
    if (!sent.ok) {
      await transport.json(base, 'DELETE');
      return sent.message;
    }
  }
  const committed = await transport.json<{ id: string }>(`${base}/complete`, 'POST', target);
  if (!committed.ok) return committed.message;
  onProgress(100);
  return null;
}
