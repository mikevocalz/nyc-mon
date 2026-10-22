/// <reference path='./glb.d.ts' />
/**
 * Hatch assets built by tooling/blender/hatching: per egg, the runtime
 * manifest and the hatch GLB it names. The kit's HatchEgg3D parses the
 * manifest with zod, so it is exported here as plain JSON. Adding an egg
 * means adding its folder and one entry below; screens look eggs up by the
 * egg's canonical species id and never name a file.
 *
 * The Baby inside every GLB is a labelled proxy (`baby.proxy: true`): no
 * Baby model or rig exists yet.
 */

import cornerManifest from './corner-egg/hatch.manifest.json';
import cornerGlb from './corner-egg/corner-egg-hatch.glb';
import metroManifest from './metro-egg/hatch.manifest.json';
import metroGlb from './metro-egg/metro-egg-hatch.glb';
import prismManifest from './prism-egg/hatch.manifest.json';
import prismGlb from './prism-egg/prism-egg-hatch.glb';
import signalManifest from './signal-egg/hatch.manifest.json';
import signalGlb from './signal-egg/signal-egg-hatch.glb';

export interface EggHatchAsset {
  /** Folder name and manifest `eggId`. */
  readonly eggId: string;
  /** Canonical Egg-form species id (`EggRecord.speciesId`). */
  readonly eggSpeciesId: string;
  /** Unparsed manifest JSON; the kit validates it. */
  readonly manifest: unknown;
  /** URL string on web, Metro asset id on native. */
  readonly glb: string | number;
}

const entry = (manifest: { eggId: string; eggSpeciesId: string }, glb: string | number): EggHatchAsset => ({
  eggId: manifest.eggId,
  eggSpeciesId: manifest.eggSpeciesId,
  manifest,
  glb,
});

export const EGG_HATCH_ASSETS: readonly EggHatchAsset[] = [
  entry(metroManifest, metroGlb),
  entry(cornerManifest, cornerGlb),
  entry(prismManifest, prismGlb),
  // dex-020 is not in packages/content yet, so no save reaches this egg until that species lands.
  entry(signalManifest, signalGlb),
];

/** The hatch asset for an egg species, or undefined when that egg has no GLB (the screen keeps the 2D egg). */
export function eggHatchAssetForSpecies(eggSpeciesId: string): EggHatchAsset | undefined {
  return EGG_HATCH_ASSETS.find((asset) => asset.eggSpeciesId === eggSpeciesId);
}
