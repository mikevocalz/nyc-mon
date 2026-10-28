/**
 * Web: the bundler hands the GLB over as a URL string (Vite and Turbopack
 * emit `.glb` as an asset). Fetched once per call; the rig caches the result.
 */
export async function fetchEggBytes(source: string | number): Promise<ArrayBuffer> {
  if (typeof source !== 'string') throw new Error(`expected a URL for the egg GLB on web, got ${typeof source}`);
  const response = await fetch(source);
  if (!response.ok) throw new Error(`GET ${source} answered ${response.status}`);
  return response.arrayBuffer();
}
