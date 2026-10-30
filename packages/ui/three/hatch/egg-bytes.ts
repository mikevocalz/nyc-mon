import { binaryFetch } from '@acme/ui/net';
import { readWithProgress } from '../mon/load-progress';

/**
 * Web: the bundler hands the GLB over as a URL string (Vite and Turbopack
 * emit `.glb` as an asset). Fetched once per call; the rig caches the result.
 */
export async function fetchEggBytes(
  source: string | number,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<ArrayBuffer> {
  if (typeof source !== 'string') throw new Error(`expected a URL for the egg GLB on web, got ${typeof source}`);
  const response = await binaryFetch(source);
  if (!response.ok) throw new Error(`GET ${source} answered ${response.status}`);
  // With a listener, stream the body: nitro-fetch's web entry returns the
  // browser's own Response, so progress arrives chunk by chunk.
  return onProgress ? readWithProgress(response, onProgress) : response.arrayBuffer();
}
