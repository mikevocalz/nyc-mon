// Living City PR07 — working streetlamps on the EXISTING furniture
// placements (spec §10: streetlamps actually turn on at dusk). This is
// deliberately NOT a second lamp system: the world's `placeStreetlights`
// layout (world/signage.ts, reused through street-furniture.ts) supplies
// every position, so the glows land exactly on the poles/heads the city
// already renders. What this actor adds is the clock-driven layer the
// static world cannot express: an emissive halo quad under each lamp
// head plus a pool-of-light decal on the carriageway, both dimmed to
// zero in daylight and faded up smoothly through dusk — and boosted in
// rain (the spec's "wet asphalt" read: brighter halos, stronger pools).
//
// Budget honesty: NO shadow-casting point light per streetlamp (spec
// §10 forbids it; rn-webgpu has no shadow maps at all). Everything here
// is additive emissive/decal geometry — an instanced glow-cross per
// lamp head and an instanced light-pool disc, both nearest-N around the
// camera focus exactly like the world's own `POOL_CAP` pools.
//
// State source: the env section of the same packed world snapshot the
// signal heads read (clock.ts CSNAP): `lampLevel` for the dusk
// transition, `rain` for the boost. The world's static pools and lamp
// heads are untouched — they stay at their authored subtle level; this
// actor layers the time-of-day switch on top (documented in
// docs/living-city/pr07-viz.md).

import type { Three } from '@acme/ui/three';
import { CURB_HEIGHT } from '../world/curb.ts';
import type { ActorFrame, SceneActor, SceneActorFactory } from '../scene-actor.ts';
import type { CityDatasetV3 } from '../city-dataset.ts';
import { LIGHT_POLE_HEIGHT } from '../world/signage.ts';
import { placeStreetFurniture } from '../world/street-furniture.ts';
import { pickWithin, TREE_REFRESH_METRES } from '../world/tree-lod.ts';
import { createStreetClearance, type StreetClearance } from '../world/walkability.ts';
import { readEnvSection } from './clock.ts';
import { envSectionOffset } from './signal-viz.ts';
import { VSNAP, VSNAP_HEADER } from './vehicle-sim.ts';

// --- Placements (pure) ---------------------------------------------------------------

export interface LampPlacement {
  /** Pole base — identical to the world's furniture light. */
  readonly x: number;
  readonly z: number;
  /** Unit vector from the pole toward the carriageway centre (the head overhang direction). */
  readonly faceX: number;
  readonly faceZ: number;
  /** Emissive halo centre: the lamp head position (matches street-furniture's +0.6 m overhang). */
  readonly glowX: number;
  readonly glowY: number;
  readonly glowZ: number;
  /** Pool decal centre: 1.8 m toward the carriageway (matches the world's own pool offset). */
  readonly poolX: number;
  readonly poolZ: number;
}

/**
 * The world's own streetlight layout for this tile — the SAME call
 * `buildStreetFurniture` makes, so halos and pools line up with the
 * rendered poles and heads exactly. Pass the dataset's street
 * clearance for byte-identical placement (omitted → `standable` always
 * true, which is what a non-clearance caller gets in the world too).
 */
export function lampPlacements(dataset: CityDatasetV3, clearance?: StreetClearance): LampPlacement[] {
  const { lights } = placeStreetFurniture(dataset, clearance ?? createStreetClearance(dataset));
  return lights.map((l) => ({
    x: l.x,
    z: l.z,
    faceX: l.face[0],
    faceZ: l.face[1],
    glowX: l.x + l.face[0] * 0.6,
    glowY: LIGHT_POLE_HEIGHT - 0.05 + CURB_HEIGHT,
    glowZ: l.z + l.face[1] * 0.6,
    poolX: l.x + l.face[0] * 1.8,
    poolZ: l.z + l.face[1] * 1.8,
  }));
}

// --- Env → lamp level (pure) ----------------------------------------------------------

/** Rain boosts emissive intensity and pool opacity by up to this share of the lit level. */
export const LAMP_RAIN_BOOST = 0.45;
/** Glow halo radius (metres) — small and hot, the LED's bloom. */
export const LAMP_GLOW_RADIUS = 1.5;
/** Pool decal radius (metres) — matches the world's own 5.5-scale pools halved for a tighter read. */
export const LAMP_POOL_RADIUS = 4.2;

/** The effective lamp drive for a snapshot env state: dusk level plus a rain boost, clamped. */
export function lampDrive(lampLevel: number, rain: number): number {
  return Math.min(1, Math.max(0, lampLevel * (1 + LAMP_RAIN_BOOST * Math.min(1, Math.max(0, rain)))));
}

// --- The scene actor ------------------------------------------------------------------

/** Near-field caps — the world's own pools use 48 within 110 m; the glow layer reaches further (it is the far read). */
export const LAMP_GLOW_RADIUS_METRES = 380;
export const LAMP_GLOW_CAP = 256;
export const LAMP_POOL_RADIUS_METRES = 140;
export const LAMP_POOL_CAP = 64;

export interface LampActorOptions {
  /** Latest packed world snapshot (same read closure as every living-city actor). */
  readonly read: () => readonly number[] | null | undefined;
  /** The streetlight placements — from `lampPlacements(dataset, clearance)`. */
  readonly placements: readonly LampPlacement[];
  /** Camera look-at for the near-field caps. */
  readonly focus?: () => { x: number; z: number } | null;
  readonly onMount?: () => void;
  readonly onUnmount?: () => void;
  readonly glowCap?: number;
  readonly poolCap?: number;
  readonly glowRadiusMeters?: number;
  readonly poolRadiusMeters?: number;
}

/**
 * Clock-driven streetlamp halos + light pools. Two TSL uniforms carry
 * the env state — one for the halo level, one for pool opacity — so a
 * frame costs two uniform writes and zero geometry churn. The
 * near-field sets only rebuild after a ~10 m focus move.
 */
export function createLampActor(options: LampActorOptions): SceneActorFactory {
  return (threeNamespace: unknown): SceneActor => {
    const THREE = threeNamespace as Three;
    const T = THREE.TSL;
    const lamps = options.placements;
    const glowCap = options.glowCap ?? LAMP_GLOW_CAP;
    const poolCap = options.poolCap ?? LAMP_POOL_CAP;
    const glowRadiusMeters = options.glowRadiusMeters ?? LAMP_GLOW_RADIUS_METRES;
    const poolRadiusMeters = options.poolRadiusMeters ?? LAMP_POOL_RADIUS_METRES;

    const group = new THREE.Group();
    group.name = 'living-city:lamps';

    // Glow halo: two crossed quads (visible from every azimuth) with a
    // radial falloff, additive, per-lamp warm sodium/LED colour. One
    // InstancedMesh; a shared uniform carries the clock level so the
    // whole city's lamps fade up together — one write per frame.
    const glowGeometry = new THREE.PlaneGeometry(1, 1);
    const crossed = new THREE.BufferGeometry();
    {
      const a = glowGeometry.getAttribute('position')!;
      const uv = glowGeometry.getAttribute('uv')!;
      const idx = glowGeometry.getIndex()!;
      const pos: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      for (let i = 0; i < a.count; i++) {
        pos.push(a.getX(i), a.getY(i), 0);
        uvs.push(uv.getX(i), uv.getY(i));
      }
      // Second quad rotated 90° about Y (the cross).
      const base = pos.length / 3;
      for (let i = 0; i < a.count; i++) {
        pos.push(0, a.getY(i), a.getX(i));
        uvs.push(uv.getX(i), uv.getY(i));
      }
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i)!);
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i)! + base);
      crossed.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      crossed.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      crossed.setIndex(indices);
    }
    const glowLevel = T.uniform(0, 'float');
    const glowMaterial = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    {
      const r = T.uv().sub(0.5).length().mul(2);
      const fall = T.float(1).sub(T.smoothstep(0, 1, r));
      // Warm LED halo — bright core, soft skirt. Additive: black at day.
      const warm = T.vec3(1.0, 0.82, 0.55);
      glowMaterial.colorNode = T.vec4(warm.mul(fall.mul(fall).mul(1.9)), 1);
      glowMaterial.opacityNode = fall.mul(glowLevel).mul(0.85);
    }
    const glowMesh = new THREE.InstancedMesh(crossed, glowMaterial, Math.max(1, glowCap));
    glowMesh.name = 'living-city:lamp-glows';
    glowMesh.renderOrder = 4;

    // Pool decal: instanced discs on the carriageway — the world's own
    // additive pool recipe (radial falloff, polygonOffset under traffic).
    const poolGeometry = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
    const poolLevel = T.uniform(0, 'float');
    const poolMaterial = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -8,
    });
    {
      const r = T.uv().sub(0.5).length().mul(2);
      const fall = T.float(1).sub(T.smoothstep(0, 1, r));
      const warm = T.vec3(1.0, 0.85, 0.6);
      poolMaterial.colorNode = T.vec4(warm.mul(fall.mul(fall)), 1);
      poolMaterial.opacityNode = poolLevel.mul(0.5);
    }
    const poolMesh = new THREE.InstancedMesh(poolGeometry, poolMaterial, Math.max(1, poolCap));
    poolMesh.name = 'living-city:lamp-pools';
    poolMesh.renderOrder = 3;

    for (const mesh of [glowMesh, poolMesh]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      group.add(mesh);
    }

    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quat = new THREE.Quaternion();

    const glowX = new Float32Array(lamps.length);
    const glowZ = new Float32Array(lamps.length);
    const poolX = new Float32Array(lamps.length);
    const poolZ = new Float32Array(lamps.length);
    lamps.forEach((l, i) => {
      glowX[i] = l.glowX;
      glowZ[i] = l.glowZ;
      poolX[i] = l.poolX;
      poolZ[i] = l.poolZ;
    });
    const glowIds = new Int32Array(glowCap);
    const poolIds = new Int32Array(poolCap);
    const glowScratch = new Float32Array(lamps.length);
    const poolScratch = new Float32Array(lamps.length);

    let lastFocusX = Number.NaN;
    let lastFocusZ = Number.NaN;
    let lastVersion = -1;
    let lastDrive = -1;

    const refreshFocus = (x: number, z: number) => {
      lastFocusX = x;
      lastFocusZ = z;
      const gn = pickWithin(glowX, glowZ, x, z, glowRadiusMeters, glowIds, glowScratch);
      for (let k = 0; k < gn; k++) {
        const l = lamps[glowIds[k]!]!;
        matrix.compose(
          pos.set(l.glowX, l.glowY, l.glowZ),
          quat.identity(),
          scale.set(LAMP_GLOW_RADIUS * 2, LAMP_GLOW_RADIUS * 2, 1),
        );
        glowMesh.setMatrixAt(k, matrix);
      }
      glowMesh.count = gn;
      glowMesh.instanceMatrix.needsUpdate = true;
      const pn = pickWithin(poolX, poolZ, x, z, poolRadiusMeters, poolIds, poolScratch);
      for (let k = 0; k < pn; k++) {
        const l = lamps[poolIds[k]!]!;
        matrix.compose(
          pos.set(l.poolX, 0.09, l.poolZ),
          quat.identity(),
          scale.set(LAMP_POOL_RADIUS, 1, LAMP_POOL_RADIUS),
        );
        poolMesh.setMatrixAt(k, matrix);
      }
      poolMesh.count = pn;
      poolMesh.instanceMatrix.needsUpdate = true;
    };

    options.onMount?.();

    return {
      id: 'living-city:lamps',
      object: group,
      update: (frame: ActorFrame): boolean => {
        void frame;
        const snap = options.read();
        const version = snap && snap.length >= VSNAP_HEADER ? (snap[VSNAP.version] ?? 0) : -1;
        const env = readEnvSection(snap, envSectionOffset(snap), snap && snap.length >= VSNAP_HEADER ? (snap[VSNAP.simTime] ?? 0) : 0);
        const drive = lampDrive(env.lampLevel, env.rain);
        if (drive !== lastDrive) {
          lastDrive = drive;
          glowLevel.value = drive;
          poolLevel.value = drive;
        }
        const f = options.focus?.() ?? null;
        const moved = f !== null && (!Number.isFinite(lastFocusX) || Math.hypot(f.x - lastFocusX, f.z - lastFocusZ) > TREE_REFRESH_METRES);
        if (moved && f) refreshFocus(f.x, f.z);
        const versionChanged = version !== lastVersion;
        if (versionChanged) lastVersion = version;
        return versionChanged || moved;
      },
      dispose: () => {
        options.onUnmount?.();
        glowGeometry.dispose();
        crossed.dispose();
        poolGeometry.dispose();
        glowMaterial.dispose();
        poolMaterial.dispose();
        glowMesh.dispose();
        poolMesh.dispose();
        group.clear();
      },
    };
  };
}
