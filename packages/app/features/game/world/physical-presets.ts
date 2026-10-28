// Adapted from mrdoob/slop-newyork @ be65d0a, js/lighting.js TIME_PRESETS (MIT, © 2026 Mr.doob).
//
// The four time-of-day presets as typed rows: colours from @acme/theme
// physicalCityLight, numbers from physical-look.ts. Pure, no three import.
import { physicalCityLight } from '@acme/theme';
import {
  PHYSICAL_GRADE,
  PHYSICAL_LIGHT,
  PHYSICAL_PRESET_IDS,
  type PhysicalGradeNumbers,
  type PhysicalLightNumbers,
  type PhysicalPresetId,
} from './physical-look.ts';

export interface PhysicalPresetColors {
  sun: string;
  hemiSky: string;
  hemiGround: string;
  skyTop: string;
  skyHorizon: string;
  fog: string;
}

export interface PhysicalPreset extends PhysicalLightNumbers {
  id: PhysicalPresetId;
  colors: PhysicalPresetColors;
  /** Unit vector toward the sun; Slop normalises its table rows the same way. */
  sunDirection: readonly [number, number, number];
  grade: PhysicalGradeNumbers;
}

function normalise(v: readonly [number, number, number]): readonly [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function resolve(id: PhysicalPresetId): PhysicalPreset {
  const light = PHYSICAL_LIGHT[id];
  return {
    ...light,
    id,
    colors: { ...physicalCityLight[id] },
    sunDirection: normalise(light.sunDir),
    grade: PHYSICAL_GRADE[id],
  };
}

export const PHYSICAL_PRESETS: Readonly<Record<PhysicalPresetId, PhysicalPreset>> = Object.fromEntries(
  PHYSICAL_PRESET_IDS.map((id) => [id, resolve(id)]),
) as Record<PhysicalPresetId, PhysicalPreset>;

/** The colour the SkyMesh fades to at night. */
export const PHYSICAL_NIGHT_SKY: string = physicalCityLight.nightSky;
