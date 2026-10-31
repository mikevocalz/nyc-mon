/**
 * Rigged Mon models by Dex number. Files live in Payload's mon-models
 * collection, served from the CDN; the URL is the admin origin's stable
 * 302 to the approved row (/v1/mon-models/glb/<species>), so every client —
 * website, Alexa views, companion — reads the same model Payload ships.
 */

export interface MonModelAsset {
  readonly dexId: number;
  /** File stem, also the parse-cache key. */
  readonly key: string;
  /** URL string on web, Metro asset id on native. */
  readonly glb: string | number;
}

export const MON_MODEL_ASSETS: readonly MonModelAsset[] = [
  { dexId: 2, key: 'squeaklet', glb: 'https://admin.nyc-mon.city/v1/mon-models/glb/dex-002' },
  { dexId: 3, key: 'lil-ratti', glb: 'https://admin.nyc-mon.city/v1/mon-models/glb/dex-003' },
];

/** The model for a Dex number, or undefined when that form has none yet. */
export function monModelAssetForDex(dexId: number | null): MonModelAsset | undefined {
  return dexId === null ? undefined : MON_MODEL_ASSETS.find((a) => a.dexId === dexId);
}
