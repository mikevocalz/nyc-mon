import { createStore } from 'zustand/vanilla';

/**
 * Download progress of each Baby GLB, by model key. Written by mon-rig.ts
 * while the bytes stream in; read by the stage loader. Kept apart from the
 * rig so reading it never pulls three.js into a screen's chunk.
 *
 * `total` is null when the server sent no Content-Length or the platform's
 * fetch has no readable body (React Native's fetch buffers the whole file),
 * so the loader stays indeterminate rather than showing a made-up number.
 */
export interface GlbProgress {
  readonly loaded: number;
  readonly total: number | null;
  readonly done: boolean;
}

export const glbProgressStore = createStore<Readonly<Record<string, GlbProgress>>>()(() => ({}));

export function reportGlbProgress(key: string, progress: GlbProgress): void {
  glbProgressStore.setState({ [key]: progress });
}

/** 0..1 when the size is known, otherwise undefined (indeterminate). */
export function glbFraction(progress: GlbProgress | undefined): number | undefined {
  if (progress === undefined) return undefined;
  if (progress.done) return 1;
  if (progress.total === null || progress.total <= 0) return undefined;
  return Math.min(1, Math.max(0, progress.loaded / progress.total));
}

/**
 * Reads a response body to an ArrayBuffer, reporting bytes as they arrive.
 * Streams when the platform exposes `response.body`; otherwise reads it in
 * one go and reports only the end.
 */
export async function readWithProgress(
  response: Response,
  onProgress: (loaded: number, total: number | null) => void,
): Promise<ArrayBuffer> {
  const header = response.headers.get('content-length');
  const parsed = header === null ? Number.NaN : Number(header);
  const total = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const reader = response.body?.getReader?.();
  if (!reader) {
    const buffer = await response.arrayBuffer();
    onProgress(buffer.byteLength, buffer.byteLength);
    return buffer;
  }
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  onProgress(0, total);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(loaded, total);
  }
  const out = new Uint8Array(loaded);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out.buffer;
}
