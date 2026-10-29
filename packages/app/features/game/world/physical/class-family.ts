// Every nyc-mon BuildingClass mapped to one of Slop New York's facade
// families (mrdoob/slop-newyork @ be65d0a, js/buildings.js `facades`,
// MIT, © 2026 Mr.doob). The class itself comes from the Valdrada record's
// STYLE id `vs` through tooling/city/build.mjs STYLE_CLASS; this table is
// the second step, class -> family, and like the class it is a look, not a
// claim about the building.
//
// Wall stone and curtain-wall glass are not taken from Slop: the family
// keeps the class's own WALL_TONES colour (world/palette.ts), which reaches
// the shader as the vertex colour. The family sets everything else: trim
// stone, window glass, window module, lit share and bulb warmth.
//
// `nycha` (STYLE 12, PROJECT_BRICK) is brick with the facelift kit: the
// modular panels, planted balconies, light strips and upgraded entrance that
// world/future-layer.ts already emits for it. FUT-01 is still open, so the
// family claims nothing NYCHA-specific beyond what future-layer.ts does.
import type { BuildingClass, CityBuilding } from '../../city-dataset.ts';
import { hashUnit } from '../geometry.ts';
import { CURTAIN_WALL, MASONRY_FAMILY, PRE_WAR } from '../physical-materials-constants.ts';

export const FACADE_FAMILIES = ['limestone', 'brick', 'brownstone', 'curtainWall'] as const;
export type FacadeFamily = (typeof FACADE_FAMILIES)[number];

/** Masonry families in the order the pre-war shader indexes them (aFacadeGrid w / 4). */
export const MASONRY_FAMILIES = ['limestone', 'brick', 'brownstone'] as const;
export type MasonryFamily = (typeof MASONRY_FAMILIES)[number];

export interface ClassFamily {
  family: FacadeFamily;
  /** The Valdrada STYLE ids (`vs`) that build.mjs maps to this class. */
  styles: readonly number[];
  /** Adds the future-layer facelift kit (nycha only). */
  facelift: boolean;
  /** Why this family: the Slop `facades` row it borrows and what it reads as on 125th Street. */
  note: string;
}

/** Exhaustive: adding a BuildingClass without a family is a type error. */
export const CLASS_FAMILY: Readonly<Record<BuildingClass, ClassFamily>> = {
  brick: {
    family: 'brick', styles: [0, 1, 2, 7, 10], facelift: false,
    note: 'facades row 1 (warm red brick): TENEMENT, PREWAR_APT, POSTWAR_BRICK, INDUSTRIAL, RETAIL_STRIP walk-ups and shop rows',
  },
  brownstone: {
    family: 'brownstone', styles: [5], facelift: false,
    note: 'facades row 2 (brownstone and dark masonry, Slop: "cross-street rowhouses, Village & Harlem"): ROWHOUSE',
  },
  nycha: {
    family: 'brick', styles: [12], facelift: true,
    note: 'facades row 1 brick plus the future-layer facelift kit: PROJECT_BRICK towers',
  },
  civic: {
    family: 'limestone', styles: [4, 8], facelift: false,
    note: 'facades row 0 (limestone and buff brick): DECO_MASONRY and CIVIC_STONE institutional stone',
  },
  church: {
    family: 'limestone', styles: [9], facelift: false,
    note: 'facades row 0: CHURCH stone fronts',
  },
  plain: {
    family: 'limestone', styles: [6, 13, 14, 15], facelift: false,
    note: 'facades row 0 for the painted and panelled fronts (LOFT_CASTIRON, RETAIL_MODERN, FRAME_HOUSE, CONDO_NEW); the wall keeps the plain/limestone/stucco tone',
  },
  glass: {
    family: 'curtainWall', styles: [3, 11], facelift: false,
    note: 'facades row 3 (blue-teal curtain wall): MODERN_GLASS and GLASS_TOWER_BLUE',
  },
};

/** Slop family defaults for the window module when the record has no `ww` / `fh`. */
export function familyModule(family: FacadeFamily): { windowWidth: number; floorHeight: number } {
  if (family === 'curtainWall') return { windowWidth: CURTAIN_WALL.windowWidth, floorHeight: CURTAIN_WALL.floorHeight };
  const preset = MASONRY_FAMILY[family];
  return { windowWidth: preset.windowWidth, floorHeight: preset.floorHeight };
}

/** Per-building facade inputs, all deterministic in the building id and its Valdrada record. */
export interface BuildingFacade {
  family: FacadeFamily;
  /** Index into MASONRY_FAMILIES, or -1 for curtain wall. */
  masonryIndex: number;
  /** Valdrada `fh` where recorded, else the family's Slop default, m. */
  floorHeight: number;
  /** Valdrada `ww` where recorded, else the family's Slop default, m. */
  windowWidth: number;
  /**
   * Slop's createFacadeBoxes seed: an integer spread plus the building's
   * tone in the fraction (0.1..0.9, never near an integer, so floor() is
   * stable on inexact varyings).
   */
  seedTone: number;
  /** Masonry corner pier, m (0 on curtain walls, as Slop's curtain wall has none). */
  cornerPier: number;
}

export function buildingFacade(building: Pick<CityBuilding, 'id' | 'class' | 'floorHeightMeters' | 'windowWidthMeters'>): BuildingFacade {
  const { family } = CLASS_FAMILY[building.class];
  const module = familyModule(family);
  const spread = Math.floor(hashUnit(`${building.id}:facadeSeed`) * 1000);
  const tone = hashUnit(`${building.id}:facadeTone`);
  return {
    family,
    masonryIndex: family === 'curtainWall' ? -1 : MASONRY_FAMILIES.indexOf(family),
    floorHeight: building.floorHeightMeters ?? module.floorHeight,
    windowWidth: building.windowWidthMeters ?? module.windowWidth,
    seedTone: spread + 0.1 + 0.8 * tone,
    cornerPier: family === 'curtainWall' ? 0 : PRE_WAR.cornerPier,
  };
}
