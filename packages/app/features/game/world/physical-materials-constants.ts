// Physical constants for the Slop-grade facade, interior, road, fire-escape
// and culling materials (world/physical/, behind EXPO_PUBLIC_WORLD_PHYSICAL).
// Each value carries its unit and its source: "Slop measured" means the number
// is mrdoob/slop-newyork @ be65d0a verbatim (file and function named on the
// group); TODO(tune) means it was rescaled for the Harlem tile and still
// needs a device capture to confirm. Colours are not here: they are tokens
// in packages/theme/tokens.ts `physicalCityMaterials`.

/** js/tsl-materials.js canyonSkyAONode. Heights in metres above the street. */
export const CANYON_AO = {
  /** Slop measured: sky openness ramps from the street to this height, m. */
  openHeight: 68,
  /** Slop measured: extra crevice darkening fades out by this height, m. */
  creviceHeight: 7.5,
  /** Slop measured: sky visibility at street level in a canyon, 0..1. */
  streetFloor: 0.44,
  /** Slop measured: crevice term range, the floor of 0.78 + 0.22 ramp. */
  creviceFloor: 0.78,
} as const;

/**
 * Open-sky grid baked from the tile's area polygons (canyon-ao.ts). Slop
 * opens the sky inside Central Park's bounds with 10–30 m ramps; this grid
 * replaces those bounds with nyc-mon's own park and open-area polygons.
 */
export const OPEN_SKY_GRID = {
  /** TODO(tune): grid cell, m. 8 m keeps an 850 m tile at 213 × 213 texels (45 KiB as R8). */
  cellMeters: 8,
  /** TODO(tune): box-blur radius in cells; 2 cells ≈ the 10–30 m ramps Slop puts on the park edge. */
  blurCells: 2,
} as const;

/** js/tsl-materials.js evaluateApartmentInterior, all Slop measured. */
export const INTERIOR = {
  /** Room height as a share of the floor height. */
  roomHeightShare: 0.92,
  /** Glass-to-room setback, m. */
  setbackMeters: 0.12,
  /** Room depth as a multiple of the room height. */
  depthPerHeight: 1.55,
  /** Footprint (cells per pixel) where rooms start and finish fading to their mean. */
  lodStart: 0.3,
  lodEnd: 0.8,
  /** Mean drape coverage once drapes are sub-pixel, 0..1. */
  meanDrape: 0.29,
  /** Share of the room glow a drape lets through, 0..1. */
  drapeTransmit: 0.2,
} as const;

/** js/tsl-materials.js createPreWarBuildingMaterial, all Slop measured. */
export const PRE_WAR = {
  /** Brick course height and length, m. */
  brickHeight: 0.24,
  brickLength: 0.56,
  /** Masonry corner pier at both ends of every wall above the shopfronts, m. */
  cornerPier: 1.2,
  /** Window opening as a share of the bay width and of the floor height. */
  windowRatioX: 0.5,
  windowRatioY: 0.58,
  /** Band course every this many floors. */
  beltEvery: 6,
  /** Share of upper-floor windows with an AC unit, 0..1 (step(0.88, hash)). */
  acShare: 0.12,
  /** Normal-map detail fades between these camera distances, m. */
  detailNear: 16,
  detailFar: 150,
  /** Base metalness and roughness before the node graphs. */
  metalness: 0.06,
  roughness: 0.76,
  /** Lit share multiplier the material applies to the family lit probability. */
  litShareScale: 0.62,
  /** Crown flood off: Slop's default crownGlowHeight, m (above any Harlem roof). */
  crownGlowHeight: 9999,
} as const;

/** js/tsl-materials.js createCurtainWallMaterial and js/buildings.js `facades` row 3, all Slop measured. */
export const CURTAIN_WALL = {
  windowWidth: 2.7,
  floorHeight: 3.9,
  /** Mullion width and spandrel height as shares of the cell. */
  mullion: 0.075,
  spandrel: 0.2,
  litProbability: 0.6,
  warmth: 0.52,
  reflectivity: 0.92,
  metalness: 0.72,
  roughness: 0.12,
  /** Lit share multiplier the material applies to the lit probability. */
  litShareScale: 0.65,
  /** Normal-map detail fades between these camera distances, m. */
  detailNear: 18,
  detailFar: 140,
} as const;

/**
 * js/buildings.js `facades` rows 0–2: the masonry family presets, Slop
 * measured. Window width and floor height apply where the Valdrada record
 * carries no `ww` / `fh`.
 */
export const MASONRY_FAMILY = {
  limestone: { windowWidth: 2.6, floorHeight: 3.7, litProbability: 0.54, warmth: 0.8 },
  brick: { windowWidth: 2.4, floorHeight: 3.5, litProbability: 0.56, warmth: 0.86 },
  brownstone: { windowWidth: 2.2, floorHeight: 3.4, litProbability: 0.6, warmth: 0.9 },
} as const;

/** js/tsl-materials.js roadPuddleField / roadWetMasks / road, sidewalk and curb materials, Slop measured. */
export const ROADS = {
  /** Manhole grid cell, m; one cell in three carries a cover. */
  manholeCell: 14,
  /** Manhole cover radius band, m. */
  manholeInner: 0.52,
  manholeOuter: 0.6,
  /** Sidewalk flag size (5 ft), m. */
  sidewalkFlag: 1.5,
  /** Scored joint half width on the flags and the curb, m. */
  flagJoint: 0.042,
  curbJoint: 0.038,
  /** Joint depth on the flags, m. */
  flagJointDepth: 0.012,
  /** Sidewalk drainage offset on the wet-mask water line. */
  sidewalkDrainage: 0.06,
  /** Water Fresnel F0. */
  waterF0: 0.02,
} as const;

/** js/road-paint.js, Slop measured unless marked. */
export const ROAD_PAINT = {
  /** Paint height above the asphalt, m. */
  height: 0.012,
  /** Lane line: width m, dash period m, duty. */
  laneLineWidth: 0.13,
  laneDashPeriod: 12,
  laneDashDuty: 0.25,
  /** Double yellow: width of each line and half the gap between their centres, m. */
  yellowWidth: 0.11,
  yellowOffset: 0.12,
  /** Stop bar width (along the lane), m, and its distance back from the lane end, m. */
  stopBarWidth: 0.45,
  stopBarBack: 0.35,
  /** Gap kept clear at each lane end that meets a junction, m. */
  endGap: 0.9,
  /** Continental crosswalk: strip width (road-network.js CROSSWALK 3.3 m − 0.3), bar period m, duty. */
  crosswalkWidth: 3.0,
  crosswalkPeriod: 1.2,
  crosswalkDuty: 0.5,
  /** Lanes wider apart than this are split by a median, not a painted line (m). */
  medianGap: 4.5,
} as const;

/** js/fire-escapes.js, Slop measured unless marked. */
export const FIRE_ESCAPE = {
  maxEscapes: 2400,
  maxNearFloors: 256,
  /** Escapes within this distance of the focus draw as the detailed floors, m. */
  nearDistance: 30,
  /** Storey height the module is modelled at, m. */
  storey: 3.5,
  /** The module's deck spans ±0.55 m about its origin, so the origin sits this far off the wall, m (js/buildings.js). */
  wallOffset: 0.55,
  roughness: 0.65,
  metalness: 0.6,
} as const;

/**
 * js/scene-culling.js. Slop sizes its thresholds for a 20 km island; the
 * nyc-mon tile is 1.7 km across, so the mesh-size gates are rescaled
 * (TODO(tune)) and the per-instance cull rule stays Slop measured.
 */
export const CULLING = {
  /** Slop measured: px-per-metre factor, an instance of size s culls at s × this, m. */
  cullPerMetre: 1100,
  /** Slop measured: nearest cull distance, m (the shadow cascades reach ~300 m). */
  cullMin: 300,
  /** Slop measured: beyond this cull distance a mesh is kept at any range, m. */
  cullMax: 2000,
  /** Slop measured: shadow stand-in cell, m. */
  proxyCell: 500,
  /** Slop measured: cell for large static batches, m. */
  staticCell: 1000,
  /** Slop measured: render layer only the shadow cascade cameras see. */
  shadowProxyLayer: 3,
  /** Slop measured: instanced meshes below this count stay whole. */
  minInstances: 64,
  /** Slop measured: instanced meshes below this many triangles stay whole. */
  minChunkTriangles: 40_000,
  /** TODO(tune): Slop 1500 m; the Harlem tile is 850 m in radius. */
  minChunkRadius: 400,
  /** Slop measured: casters below this many triangles keep casting directly. */
  minProxyTriangles: 20_000,
  /** TODO(tune): Slop 600 m; scaled with the tile. */
  minProxyRadius: 200,
} as const;
