// Adapted from mrdoob/slop-newyork @ be65d0a, js/street-details.js § 8 (clustered streetlights: the light pools,
// the LIGHT_CELL index, nearbyLights, the lampScale ramp) and js/buildings.js § 7 and updateLights (the storefront
// pool) (MIT, © 2026 Mr.doob).
//
// Real night light for the physically lit city: pooled, unshadowed PointLights at the streetlamp heads and under the
// shop awnings, reassigned to the sites nearest the camera. three r186's ClusteredLighting clusters only unshadowed
// PointLights (tsl/lighting/ClusteredLightsNode.js setLights), so Slop's cobra-head and storefront SpotLights become
// PointLights here: the streetlamp light hangs below and outside the head, where the downward cone would land, and
// the storefront light sits under the canopy. Slop also pools PointLights for park lamps, subway entrances and
// kiosks; nyc-mon's tile has none of those sites, so that pool is not ported.
//
// The site index, ranking and night ramp are pure functions over plain numbers. The pool factory takes the world's
// THREE namespace, so nothing here imports three at module scope; world/index.ts reaches this module only through
// physical-graph.ts, behind EXPO_PUBLIC_WORLD_PHYSICAL.
import type { Three } from '@acme/ui/three';
import { physicalCityLight, physicalFacelift } from '@acme/theme';

// ---- Constants -----------------------------------------------------------------------------------------------------

/**
 * Streetlamp light. Intensity, range and decay are Slop's cobra-head SpotLight (88 cd x lampScale, range 25, decay
 * 1.25; colour physicalCityLight.streetlamp), Slop measured. A point light of the same candela matches the cone's
 * on-axis light. `drop` and `reach` place it below and street-side of the head; TODO(tune).
 */
export const STREETLAMP_LIGHT = {
  /** cd at lampScale 1. Slop measured. */
  intensity: 88,
  /** Cut-off range, m. Slop measured. */
  distance: 25,
  /** Falloff exponent. Slop measured. */
  decay: 1.25,
  /** Metres below the lamp head. TODO(tune). */
  drop: 1.2,
  /** Metres further out over the street than the head, toward where the cone lands. TODO(tune). */
  reach: 1.2,
  /** Ranking range, m (Slop STREETLIGHT_DIST). Slop measured. */
  range: 115,
} as const;

/**
 * Storefront light. Intensity, range and decay are Slop's storefront SpotLight (`STORE_SPOT_INTENSITY = 46 * (0.70 /
 * 0.90)`, range 12, decay 1.3), Slop measured. Slop keeps them lit by day; here they follow the streetlamps' night
 * ramp, capped at 1. Height and offset place the light under the canopy; TODO(tune).
 */
export const STOREFRONT_LIGHT = {
  /** cd. Slop measured. */
  intensity: (46 * (0.85 - 0.15)) / 0.9,
  /** Cut-off range, m. Slop measured. */
  distance: 12,
  /** Falloff exponent. Slop measured. */
  decay: 1.3,
  /** Height above the pavement, m: under the 3.05 m awning top (facade-detail.ts emitAwning). TODO(tune). */
  height: 2.5,
  /** Metres out from the wall, under the 1.3 m canopy. TODO(tune). */
  out: 0.9,
  /** Ranking range, m (Slop STORE_MAX_DIST). Slop measured. */
  range: 115,
} as const;

/** Site index cell, m (Slop LIGHT_CELL). Slop measured. */
export const LIGHT_CELL = 128;
/** Effective distance `d + max(0, slack - forwardDot) * weight` penalises sites behind the camera. Slop measured. */
export const LIGHT_BEHIND_SLACK = 6.0;
export const LIGHT_BEHIND_WEIGHT = 2.8;
/** Lights fade from this fraction of the cut-off to the cut-off (Slop `smoothFade(d, cutoff * 0.62, cutoff)`). */
export const LIGHT_FADE_START = 0.62;
/** Where unassigned lights wait, m below the street. */
const PARKED_Y = -1000;

/**
 * Slop's streetlight ramp on cityUniforms.uInteriorGlow: 0 at midday (0.24), about 0.14 at golden hour (0.48), 1 at
 * twilight (1.25), capped at 1.25 by midnight (1.55). Slop measured.
 */
export function lampScale(interiorGlow: number): number {
  return Math.min(1.25, Math.max(0, (interiorGlow - 0.36) * 1.15));
}

// ---- Sites and the index --------------------------------------------------------------------------------------------

/** A light position in world metres; `tint` picks a colour from the pool's palette. */
export interface LightSite {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly tint: number;
}

/** A furniture streetlight (signage.ts placeStreetlights): pole base and the unit direction its head faces. */
export interface StreetlampSource {
  readonly x: number;
  readonly z: number;
  readonly face: readonly [number, number];
}

/** One awning on the procedural storefronts (city-mesh.ts): the wall point under its centre and the wall's outward normal. */
export interface StorefrontPlacement {
  readonly x: number;
  readonly z: number;
  readonly outX: number;
  readonly outZ: number;
}

/**
 * Streetlamp light sites. `headY` is the lamp head's height (street-furniture.ts puts the head at
 * LIGHT_POLE_HEIGHT - 0.05 + CURB_HEIGHT, 0.6 m out along `face`).
 */
export function streetlampSites(lamps: readonly StreetlampSource[], headY: number): LightSite[] {
  const out = 0.6 + STREETLAMP_LIGHT.reach;
  return lamps.map((l) => ({ x: l.x + l.face[0] * out, y: headY - STREETLAMP_LIGHT.drop, z: l.z + l.face[1] * out, tint: 0 }));
}

/** Storefront light sites, cycling the storefront colours by awning order as Slop cycles its sign themes. */
export function storefrontSites(awnings: readonly StorefrontPlacement[], groundY = 0): LightSite[] {
  const tints = physicalCityLight.storefront.length;
  return awnings.map((a, i) => ({
    x: a.x + a.outX * STOREFRONT_LIGHT.out,
    y: groundY + STOREFRONT_LIGHT.height,
    z: a.z + a.outZ * STOREFRONT_LIGHT.out,
    tint: i % tints,
  }));
}

/** Static sites bucketed in LIGHT_CELL squares, so a query reads a few cells instead of the tile. */
export class LightSiteGrid {
  private readonly cells = new Map<number, number[]>();
  readonly sites: readonly LightSite[];

  constructor(sites: readonly LightSite[]) {
    this.sites = sites;
    sites.forEach((s, i) => {
      const key = LightSiteGrid.key(Math.floor(s.x / LIGHT_CELL), Math.floor(s.z / LIGHT_CELL));
      let cell = this.cells.get(key);
      if (!cell) { cell = []; this.cells.set(key, cell); }
      cell.push(i);
    });
  }

  private static key(ix: number, iz: number): number {
    return ix * 65_536 + iz;
  }

  /** Calls `visit` with the index of every site in a cell the square `x ± range`, `z ± range` touches. */
  forEachNear(x: number, z: number, range: number, visit: (index: number) => void): void {
    for (let ix = Math.floor((x - range) / LIGHT_CELL); ix <= Math.floor((x + range) / LIGHT_CELL); ix++) {
      for (let iz = Math.floor((z - range) / LIGHT_CELL); iz <= Math.floor((z + range) / LIGHT_CELL); iz++) {
        const cell = this.cells.get(LightSiteGrid.key(ix, iz));
        if (cell) for (const i of cell) visit(i);
      }
    }
  }
}

// ---- Ranking (nearbyLights, updateLights) ----------------------------------------------------------------------------

/** Camera position and its unit forward on the ground plane. */
export interface LightCamera {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly fwdX: number;
  readonly fwdZ: number;
}

/** A site picked for a light this frame, with its 0..1 fade toward the cut-off. */
export interface RankedSite {
  index: number;
  effDist: number;
  fade: number;
}

/** Slop `smoothFade`: 1 inside `start`, smoothstep down to 0 at `end`. */
export function smoothFade(d: number, start: number, end: number): number {
  const t = Math.min(1, Math.max(0, (end - d) / (end - start)));
  return t * t * (3 - 2 * t);
}

/**
 * The `max` sites nearest the camera by Slop's effective distance, nearest first, inside `range`. The cut-off
 * shrinks to the first site left out and lights fade over the last 38 % before it, so a site entering or leaving
 * the set never pops (Slop `cobraCutoff` / `storeCutoff`). `out` and `scratch` are reused across calls.
 */
export function rankSites(
  grid: LightSiteGrid,
  camera: LightCamera,
  range: number,
  max: number,
  scratch: RankedSite[],
  out: RankedSite[],
): RankedSite[] {
  out.length = 0;
  grid.forEachNear(camera.x, camera.z, range, (index) => {
    const s = grid.sites[index]!;
    const dx = s.x - camera.x;
    const dz = s.z - camera.z;
    const d2 = dx * dx + dz * dz + camera.y * camera.y;
    if (d2 > range * range) return;
    const effDist = Math.sqrt(d2) + Math.max(0, LIGHT_BEHIND_SLACK - dx * camera.fwdX - dz * camera.fwdZ) * LIGHT_BEHIND_WEIGHT;
    if (effDist >= range) return;
    // Record objects are pooled in `scratch`, so a re-rank allocates nothing once the pool has grown.
    let r = scratch[out.length];
    if (!r) { r = { index: 0, effDist: 0, fade: 0 }; scratch[out.length] = r; }
    r.index = index;
    r.effDist = effDist;
    out.push(r);
  });
  out.sort((a, b) => a.effDist - b.effDist);
  const cutoff = out.length > max ? Math.min(range, out[max]!.effDist) : range;
  if (out.length > max) out.length = Math.max(0, max);
  for (const r of out) r.fade = smoothFade(r.effDist, cutoff * LIGHT_FADE_START, cutoff);
  return out;
}

// ---- The pools -------------------------------------------------------------------------------------------------------

export interface NightLightsOptions {
  readonly streetlamps: readonly LightSite[];
  readonly storefronts: readonly LightSite[];
  /** Pool sizes from the tier row (perf/tier.ts streetlampLights, storefrontLights). */
  readonly streetlampCount: number;
  readonly storefrontCount: number;
  /** The facelift's LED streetlights: physicalFacelift.streetLed instead of physicalCityLight.streetlamp. */
  readonly led?: boolean;
}

type PointLightT = InstanceType<Three['PointLight']>;

export interface NightLights {
  readonly group: InstanceType<Three['Group']>;
  readonly streetlampLights: readonly PointLightT[];
  readonly storefrontLights: readonly PointLightT[];
  /** Re-ranks both pools for the camera and scales them by the preset's interior glow. Skips when nothing moved. */
  update(camera: LightCamera, interiorGlow: number): void;
  dispose(): void;
}

function makePool(THREE: Three, count: number, color: string, distance: number, decay: number, name: string) {
  const lights: PointLightT[] = [];
  for (let i = 0; i < count; i++) {
    const light = new THREE.PointLight(new THREE.Color().setStyle(color), 0, distance, decay);
    light.castShadow = false;
    light.name = name;
    light.position.set(0, PARKED_Y, 0);
    lights.push(light);
  }
  return lights;
}

function park(lights: readonly PointLightT[], from: number): void {
  for (let i = from; i < lights.length; i++) {
    const light = lights[i]!;
    if (light.intensity === 0 && light.position.y === PARKED_Y) continue;
    light.intensity = 0;
    light.position.set(0, PARKED_Y, 0);
  }
}

/** Builds the two pools, every light off and parked under the street until the first night update. */
export function createNightLights(THREE: Three, options: NightLightsOptions): NightLights {
  const group = new THREE.Group();
  group.name = 'city:night-lights';
  const lampColor = options.led ? physicalFacelift.streetLed : physicalCityLight.streetlamp;
  const lamps = makePool(THREE, options.streetlampCount, lampColor, STREETLAMP_LIGHT.distance, STREETLAMP_LIGHT.decay, 'city:streetlamp-light');
  const stores = makePool(
    THREE, options.storefrontCount, physicalCityLight.storefront[0], STOREFRONT_LIGHT.distance, STOREFRONT_LIGHT.decay, 'city:storefront-light',
  );
  if (lamps.length + stores.length > 0) group.add(...lamps, ...stores);
  const storeColors = physicalCityLight.storefront.map((c) => new THREE.Color().setStyle(c));
  const lampGrid = new LightSiteGrid(options.streetlamps);
  const storeGrid = new LightSiteGrid(options.storefronts);
  const scratch: RankedSite[] = [];
  const ranked: RankedSite[] = [];
  const last = { x: Number.NaN, y: 0, z: 0, fwdX: 0, fwdZ: 0, glow: Number.NaN };

  return {
    group,
    streetlampLights: lamps,
    storefrontLights: stores,
    update(camera, interiorGlow) {
      const still = Math.abs(camera.x - last.x) < 0.25 && Math.abs(camera.y - last.y) < 0.25 && Math.abs(camera.z - last.z) < 0.25
        && camera.fwdX * last.fwdX + camera.fwdZ * last.fwdZ > 0.9995 && interiorGlow === last.glow;
      if (still) return;
      last.x = camera.x; last.y = camera.y; last.z = camera.z;
      last.fwdX = camera.fwdX; last.fwdZ = camera.fwdZ; last.glow = interiorGlow;
      const scale = lampScale(interiorGlow);
      if (scale <= 0.001) {
        park(lamps, 0);
        park(stores, 0);
        return;
      }
      let used = 0;
      if (lamps.length > 0) {
        for (const r of rankSites(lampGrid, camera, STREETLAMP_LIGHT.range, lamps.length, scratch, ranked)) {
          const s = lampGrid.sites[r.index]!;
          const light = lamps[used++]!;
          light.position.set(s.x, s.y, s.z);
          light.intensity = STREETLAMP_LIGHT.intensity * scale * r.fade;
        }
      }
      park(lamps, used);
      used = 0;
      if (stores.length > 0) {
        const storeScale = Math.min(1, scale);
        for (const r of rankSites(storeGrid, camera, STOREFRONT_LIGHT.range, stores.length, scratch, ranked)) {
          const s = storeGrid.sites[r.index]!;
          const light = stores[used++]!;
          light.position.set(s.x, s.y, s.z);
          light.color.copy(storeColors[s.tint % storeColors.length]!);
          light.intensity = STOREFRONT_LIGHT.intensity * storeScale * r.fade;
        }
      }
      park(stores, used);
    },
    dispose() {
      for (const light of [...lamps, ...stores]) light.dispose();
      group.removeFromParent();
    },
  };
}
