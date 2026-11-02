// Adapted from mrdoob/slop-newyork @ be65d0a, js/vehicle-lights.js HEADLIGHTS; js/traffic.js updateTrafficLights and
// the highway flare pass; js/tsl-materials.js createCarFlareMaterial (MIT, © 2026 Mr.doob).
//
// Street light from the traffic. The nearest vehicles each get one unshadowed PointLight a few metres ahead of the
// nose, low over the road, so three r186's ClusteredLighting clusters it (it clusters only unshadowed PointLights;
// Slop's SpotLights rely on three@dev clustering spots). The tier row sets how many (perf/tier.ts headlightLights).
// Every other vehicle keeps the emissive lamps the lofted material paints, which bloom but light nothing. Distant
// traffic also gets additive flare sprites so a street reads as a stream of lamps once the lamp geometry is smaller
// than a pixel.
//
// The ranking, placement and flare maths are pure functions over plain numbers. The light factory takes the world's
// THREE namespace, as every scene actor does, so nothing here imports three at module scope.
//
// Not ported: Slop's two-beam SpotLight profile, the player-car beam shortening (`maxReach` when the player is
// ahead) and the NYPD roof strobes.

import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { physicalVehicles } from '@acme/theme';
import { TIER, type WorldTier } from '../perf/tier.ts';
import {
  FLARE_DEFAULT_FOV_DEG,
  FLARE_DEFAULT_VIEWPORT_PX,
  FLARE_FRONT_RGB,
  FLARE_HAZE_METRES,
  FLARE_LAMP_OFFSET,
  FLARE_MIN_SIZE,
  FLARE_NEAR_METRES,
  FLARE_NIGHT_GLOW,
  FLARE_PIXELS,
  FLARE_RAMP_METRES,
  FLARE_REAR_RGB,
  HEADLIGHT_BEHIND_SLACK,
  HEADLIGHT_BEHIND_WEIGHT,
  HEADLIGHT_FADE_START,
  HEADLIGHT_MAX_DISTANCE,
  HEADLIGHT_POOL,
} from './vehicle-physical-constants.ts';

export { HEADLIGHT_POOL };

export type HeadlightTier = WorldTier;

/** PointLights a tier keeps in its headlight pool: one per lit vehicle. */
export function headlightLightCount(tier: HeadlightTier): number {
  return TIER[tier].physical.headlightLights;
}

// --- Placement --------------------------------------------------------------------------------------------------------

/** The parts of a three Vector3 placement uses; THREE.Vector3 satisfies it. */
export interface Vec3Like {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): unknown;
  applyMatrix4(m: { elements: ArrayLike<number> }): unknown;
}

/** The parts of a PointLight placement uses; THREE.PointLight satisfies it. */
export interface PointLike {
  readonly position: Vec3Like;
}

/** Where a body's nose is: z of the front bumper in the body's frame (+Z forward). */
export interface HeadlightMount {
  readonly zFront: number;
}

/** An unshadowed road-pool PointLight in the low-beam colour, off until assigned. */
export function createVehicleHeadlight(THREE: Three): InstanceType<Three['PointLight']> {
  const light = new THREE.PointLight(
    new THREE.Color().setStyle(physicalVehicles.lamp.headBeam),
    0,
    HEADLIGHT_POOL.distance,
    HEADLIGHT_POOL.decay,
  );
  light.castShadow = false;
  return light;
}

/**
 * Puts a vehicle's road pool on the centreline, HEADLIGHT_POOL.ahead metres past the nose and HEADLIGHT_POOL.height
 * above the road. With `matrix`, the point moves into world space, so slope and yaw carry it. The position is reset
 * each call, so a pooled light never accumulates an earlier transform.
 */
export function placeVehicleHeadlight(
  light: PointLike,
  spec: HeadlightMount,
  matrix?: { elements: ArrayLike<number> } | null,
): void {
  light.position.set(0, HEADLIGHT_POOL.height, spec.zFront + HEADLIGHT_POOL.ahead);
  if (matrix) light.position.applyMatrix4(matrix);
}

// --- Ranking (traffic.js updateTrafficLights) -------------------------------------------------------------------------

/** Where the camera is and which way it looks on the ground plane. `fwdX`/`fwdZ` unit or zero. */
export interface LightFocus {
  readonly x: number;
  readonly z: number;
  /** Camera height above the street, m. Adds to the distance as in Slop (`camY * camY`). */
  readonly y?: number;
  readonly fwdX?: number;
  readonly fwdZ?: number;
}

/** Slop's effective distance: true distance plus a penalty for vehicles behind or beside the camera. */
export function effectiveLightDistance(vx: number, vz: number, focus: LightFocus): number {
  const dx = vx - focus.x;
  const dz = vz - focus.z;
  const y = focus.y ?? 0;
  const d = Math.sqrt(dx * dx + dz * dz + y * y);
  const forwardDot = dx * (focus.fwdX ?? 0) + dz * (focus.fwdZ ?? 0);
  const hasForward = focus.fwdX !== undefined || focus.fwdZ !== undefined;
  return hasForward ? d + Math.max(0, HEADLIGHT_BEHIND_SLACK - forwardDot) * HEADLIGHT_BEHIND_WEIGHT : d;
}

/** Slop `smoothDistFade`: 1 inside `start`, smoothstep down to 0 at `end`. */
export function smoothDistFade(d: number, start: number, end: number): number {
  const t = Math.max(0, Math.min(1, (end - d) / (end - start)));
  return t * t * (3 - 2 * t);
}

export interface LitVehicle {
  /** The caller's index for the vehicle. */
  readonly index: number;
  /** 0..1 intensity fade toward the cut-off. */
  readonly fade: number;
  readonly effDist: number;
}

/**
 * Picks the vehicles that get a headlight light this frame: inside HEADLIGHT_MAX_DISTANCE, nearest effective distance
 * first, at most `maxVehicles`. The cut-off shrinks to the first vehicle left out, and lights fade over the last
 * 38 % before it, so a vehicle entering or leaving the set never pops (Slop `vehCutoff` and `smoothDistFade`).
 */
export function rankLitVehicles(
  positions: readonly { readonly x: number; readonly z: number }[],
  focus: LightFocus,
  maxVehicles: number,
): LitVehicle[] {
  const lit: { index: number; effDist: number }[] = [];
  positions.forEach((p, index) => {
    const effDist = effectiveLightDistance(p.x, p.z, focus);
    if (effDist < HEADLIGHT_MAX_DISTANCE) lit.push({ index, effDist });
  });
  lit.sort((a, b) => a.effDist - b.effDist);
  const cutoff = lit.length > maxVehicles ? Math.min(HEADLIGHT_MAX_DISTANCE, lit[maxVehicles]!.effDist) : HEADLIGHT_MAX_DISTANCE;
  const out: LitVehicle[] = [];
  for (const v of lit) {
    if (out.length >= maxVehicles) break;
    const fade = smoothDistFade(v.effDist, cutoff * HEADLIGHT_FADE_START, cutoff);
    if (fade <= 0.001) continue;
    out.push({ index: v.index, fade, effDist: v.effDist });
  }
  return out;
}

// --- Flares (traffic.js highway pass, tsl-materials.js createCarFlareMaterial) ----------------------------------------

/** How much a lamp faces the camera, 0..1 (Slop `flareFacing`). `f` is the cosine toward the camera. */
export function flareFacing(f: number): number {
  const t = Math.min(1, Math.max(0, (f + 0.3) / 0.9));
  return t * t * (3 - 2 * t);
}

/** Metres per pixel at one metre for a vertical field of view and viewport height (Slop `pxAt1m`). */
export function metresPerPixelAt1m(fovDeg = FLARE_DEFAULT_FOV_DEG, viewportPx = FLARE_DEFAULT_VIEWPORT_PX): number {
  return (2 * Math.tan((fovDeg * Math.PI) / 360)) / Math.max(360, viewportPx);
}

/** Distance weight of a flare: 0 inside FLARE_NEAR_METRES, full past the ramp, dimmed by haze (Slop `k`). */
export function flareDistanceWeight(d: number): number {
  if (d < FLARE_NEAR_METRES) return 0;
  return Math.min(1, (d - FLARE_NEAR_METRES) / FLARE_RAMP_METRES) / (1 + (d / FLARE_HAZE_METRES) ** 2);
}

/** Lamp positions a flare pass needs for one body: front/rear lamp |x| and height, nose and tail z. */
export interface FlareMount {
  readonly frontX: number;
  readonly frontY: number;
  readonly zFront: number;
  readonly rearX: number;
  readonly rearY: number;
  readonly zRear: number;
}

/** Floats per flare in each of the two instance attributes (`flarePos` xyz + size, `flareCol` rgb + pad). */
export const FLARE_STRIDE = 4;
/** Flares per vehicle: two head, two tail. */
export const FLARES_PER_VEHICLE = 4;

/**
 * Writes one vehicle's four flares into the instance arrays and returns the next free slot. The vehicle sits at
 * (x, 0, z) with heading `yaw` (forward +Z rotated by yaw about +Y). Front flares are warm white, rear red; each is
 * brightest seen head-on or from behind. Returns `slot` unchanged when the vehicle is too close for flares.
 */
export function writeVehicleFlares(
  pos: Float32Array,
  col: Float32Array,
  slot: number,
  vehicle: { readonly x: number; readonly z: number; readonly yaw: number },
  mount: FlareMount,
  focus: LightFocus,
  metresPerPixel: number,
  originX = 0,
  originZ = 0,
): number {
  const rx = vehicle.x - originX;
  const rz = vehicle.z - originZ;
  const dx = vehicle.x - focus.x;
  const dz = vehicle.z - focus.z;
  const y = focus.y ?? 0;
  const d = Math.sqrt(dx * dx + dz * dz + y * y);
  const k = flareDistanceWeight(d);
  if (k <= 0 || (slot + FLARES_PER_VEHICLE) * FLARE_STRIDE > pos.length) return slot;
  const sy = Math.sin(vehicle.yaw);
  const cy = Math.cos(vehicle.yaw);
  // Cosine between the vehicle's forward axis and the direction to the camera.
  const facing = -(dx * sy + dz * cy) / Math.max(d, 1e-6);
  const size = Math.max(FLARE_MIN_SIZE, d * metresPerPixel * FLARE_PIXELS);
  let s = slot;
  for (let e = 0; e < 2; e++) {
    const front = e === 0;
    const w = k * (0.3 + 0.7 * flareFacing(front ? facing : -facing));
    const lz = front ? mount.zFront + FLARE_LAMP_OFFSET : mount.zRear - FLARE_LAMP_OFFSET;
    const ly = front ? mount.frontY : mount.rearY;
    const rgb = front ? FLARE_FRONT_RGB : FLARE_REAR_RGB;
    for (let side = -1; side <= 1; side += 2) {
      const lx = side * (front ? mount.frontX : mount.rearX);
      const o = s * FLARE_STRIDE;
      pos[o] = rx + lx * cy + lz * sy;
      pos[o + 1] = ly;
      pos[o + 2] = rz - lx * sy + lz * cy;
      pos[o + 3] = size;
      col[o] = rgb[0] * w;
      col[o + 1] = rgb[1] * w;
      col[o + 2] = rgb[2] * w;
      col[o + 3] = 0;
      s++;
    }
  }
  return s;
}

/**
 * Lamp flare sprites (Slop `createCarFlareMaterial`): a soft round glow with a hot core per instance, placed and
 * sized by the `flarePos` attribute (xyz, world size) and tinted by `flareCol` (rgb already carrying the lamp's
 * facing and distance weight). Lit only at dusk and night through `glow`. Additive, so no fog. Slop also sets an
 * `mrtNode` that keeps flares out of its SSR inputs; nyc-mon's pipeline has no MRT yet, so the orchestrator adds
 * that when the light rig's MRT lands.
 */
export function createCarFlareMaterial(
  THREE: Three,
  glow: Node<'float'>,
): InstanceType<Three['SpriteNodeMaterial']> {
  const T = THREE.TSL;
  const mat = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  });
  const p = T.attribute<'vec4'>('flarePos', 'vec4');
  mat.positionNode = p.xyz;
  mat.scaleNode = T.vec2(p.w, p.w);
  const night = T.smoothstep(FLARE_NIGHT_GLOW[0], FLARE_NIGHT_GLOW[1], glow);
  const r = T.uv().sub(0.5).length().mul(2.0);
  const halo = T.pow(T.smoothstep(1.0, 0.0, r), 1.5);
  const core = T.smoothstep(0.5, 0.0, r);
  mat.colorNode = T.attribute<'vec4'>('flareCol', 'vec4').rgb.mul(halo.add(core.mul(2.0))).mul(night);
  mat.opacityNode = T.float(1.0);
  return mat;
}
