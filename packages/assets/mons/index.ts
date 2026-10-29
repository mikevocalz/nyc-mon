/**
 * Rigged Mon models by Dex number. One copy of each file exists:
 * apps/web/public/mons, which the website, the Alexa views
 * (packages/mcp-server, NYC_MON_MODEL_ORIGIN) and their boot tests already
 * serve and read. On web the app fetches the same public path, so the
 * 26-34 MB files are never emitted a second time; on native,
 * index.native.ts requires those files as Metro assets. Every file is plain
 * glTF (no Draco or Meshopt: Hermes has no WebAssembly).
 */

export interface MonModelAsset {
  readonly dexId: number;
  /** File stem, also the parse-cache key. */
  readonly key: string;
  /** URL string on web, Metro asset id on native. */
  readonly glb: string | number;
}

export const MON_MODEL_ASSETS: readonly MonModelAsset[] = [
  { dexId: 2, key: 'squeaklet', glb: '/mons/squeaklet.glb' },
  { dexId: 3, key: 'lil-ratti', glb: '/mons/lil-ratti.glb' },
];

/** The model for a Dex number, or undefined when that form has none yet. */
export function monModelAssetForDex(dexId: number | null): MonModelAsset | undefined {
  return dexId === null ? undefined : MON_MODEL_ASSETS.find((a) => a.dexId === dexId);
}
