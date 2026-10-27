/**
 * Native: the same files the web serves (apps/web/public/mons), required as
 * Metro assets (apps/mobile/metro.config.js lists glb in assetExts). Nothing
 * is copied: Metro resolves them inside the workspace it already watches.
 */
import type { MonModelAsset } from './index.ts';

declare const require: (path: string) => number;

export type { MonModelAsset } from './index.ts';

export const MON_MODEL_ASSETS: readonly MonModelAsset[] = [
  { dexId: 2, key: 'squeaklet', glb: require('../../../apps/web/public/mons/squeaklet.glb') },
  { dexId: 3, key: 'lil-ratti', glb: require('../../../apps/web/public/mons/lil-ratti.glb') },
];

export function monModelAssetForDex(dexId: number | null): MonModelAsset | undefined {
  return dexId === null ? undefined : MON_MODEL_ASSETS.find((a) => a.dexId === dexId);
}
