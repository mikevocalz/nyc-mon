/**
 * Native: the same CDN objects the web resolves — the admin origin's stable
 * 302 to the approved mon-models row. Remote URLs: no 19-24 MB files get
 * bundled into the app, and the loader follows the redirect to the CDN.
 */
import type { MonModelAsset } from './index.ts';

export type { MonModelAsset } from './index.ts';

export const MON_MODEL_ASSETS: readonly MonModelAsset[] = [
  { dexId: 2, key: 'squeaklet', glb: 'https://admin.nyc-mon.city/v1/mon-models/glb/squeaklet' },
  { dexId: 3, key: 'lil-ratti', glb: 'https://admin.nyc-mon.city/v1/mon-models/glb/lil-ratti' },
];

export function monModelAssetForDex(dexId: number | null): MonModelAsset | undefined {
  return dexId === null ? undefined : MON_MODEL_ASSETS.find((a) => a.dexId === dexId);
}
