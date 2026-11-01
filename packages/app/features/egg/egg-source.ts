import { eggHatchAssetForSpecies } from '@acme/assets/eggs';
import { eggs } from '@acme/content';
import { hud } from '@acme/theme';
import type { ScreenModelSource } from '@acme/ui';
import type { EggView } from './egg-model';

/** An egg's hatch GLB for the 3D H-Lynk (M08 slots, M10 centre), or null when none is bundled for its species. */
export function eggModelSource(view: EggView): ScreenModelSource | null {
  const speciesId = eggs.find((e) => e.bloodlineId === view.bloodlineId)?.speciesId;
  const asset = speciesId === undefined ? undefined : eggHatchAssetForSpecies(speciesId);
  return asset === undefined ? null : { eggId: asset.eggId, manifest: asset.manifest, glb: asset.glb };
}

/** Each egg's glow tint on the glass, by its 1-based index: the same colour on M08 and M10. */
const GLOW_TINTS = [hud.amber, hud.cyan, hud.green, hud.red] as const;
export function eggGlowTint(view: EggView): string {
  return GLOW_TINTS[(view.index - 1) % GLOW_TINTS.length]!;
}

/** The same model and glow for an egg already started (M11), by its species. */
export function eggSpeciesModel(speciesId: string): { source: ScreenModelSource | null; glow?: string } {
  const asset = eggHatchAssetForSpecies(speciesId);
  const index = eggs.findIndex((e) => e.speciesId === speciesId);
  return {
    source: asset === undefined ? null : { eggId: asset.eggId, manifest: asset.manifest, glb: asset.glb },
    ...(index < 0 ? {} : { glow: GLOW_TINTS[index % GLOW_TINTS.length]! }),
  };
}
