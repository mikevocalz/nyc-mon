// Living City PR05 — the renderer half of the vehicle fleet, mountable
// through the existing SceneActorFactory seam (city-scene.ts `actors`). It
// reads the flat packed snapshot the sim host publishes
// (vehicle-sim.ts codec), interpolates poses one tick in the past at render
// rate, and resolves meshes through the WorldAssetRegistry's semantic ids —
// the sim never names a mesh and the renderer never names a route.
//
// Registry honesty (spec §5 upgrade order): the first candidate we can
// actually build is used. Today that lands on the `proc:` recipes —
// primitive box-cars sized from each entry's declared bounds — because the
// GLB candidates are `pending-verification` with no runtime loader yet and
// the `three:` generator bindings are PENDING worklet-bundle verification.
// `resolveVehicleEntry` is the single swap point: when a higher-priority
// source becomes buildable the recipe switch picks it up with no sim,
// route or collision change.
//
// Budget (audit scout-F: ≤ ~10 draws / ≤ ~50 k tris for dynamic actors):
// one InstancedMesh per vehicle class = ≤ 4 draw calls; the box-car recipe
// is 6 boxes = 72 triangles, so 64 vehicles stay under 5 k.
//
// Slop-grade fleet (EXPO_PUBLIC_WORLD_PHYSICAL, default off): the registry
// gains one lofted recipe per VehicleKind (seed-assets.ts
// LOFTED_VEHICLE_ASSETS), ranked above the box recipes, and the kind picks
// its recipe, so the taxi's roof sign follows the taxi kind. Each lofted
// class draws the nearest vehicles with the full model and the rest with
// the coarse proxy (two draws per car class, one for the bus), paints from
// the per-instance `paintColor` / `carState` attributes, and lights the
// street through a tiered pool of road-pool PointLights plus night flare sprites
// (vehicle-headlights.ts). With the flag off nothing below changes: the
// default registry, the box recipes and the PR07 light quads are exactly
// as before, and lofted-car.ts, lofted-car-material.ts and
// vehicle-headlights.ts are never evaluated (physical-graph.ts loads them
// inside createLoftedFleet).
//
// vd lane (VD_LANE, world/curb.ts, the default) on top of the physical
// fleet: every vehicle is a Valdrada baked body (world/vd-car-mesh.ts). Cars
// pick their body per vehicle id from VD_FLEET_BODIES; the bus is the MTA
// XD40 (vd-car-mesh.ts VD_BUS_ID). Up to LOFTED_NEAR_VEHICLES of a kind
// inside VD_FLEET_NEAR_METRES draw LOD2, the rest the same body's `mid`
// decimation: one mesh per body and level, no lofted body or proxy and no
// box car. The headlight pools and the flares are unchanged. The vd meshes
// are plain Meshes over InstancedBufferGeometry with the transform in
// `vdXform` (world/vd-instanced.ts), so all sixteen share one node build and
// one pipeline; an InstancedMesh would compile its own.

import type { Three } from '@acme/ui/three';
import type { ActorFrame, SceneActor, SceneActorFactory } from '../scene-actor.ts';
import { WORLD_TIER } from '../perf/tier.ts';
import { parseSkyRigFlag } from '../world/sky-rig.ts';
import { EXPERIMENTAL_WORLD_PHYSICAL, WORLD_CLUSTERED_LIGHTING } from '../world/physical-look.ts';
import {
  candidates,
  createWorldAssetRegistry,
  type WorldAssetEntry,
  type WorldAssetRegistry,
} from './asset-registry.ts';
import { readEnvSection } from './clock.ts';
import type { VehicleMeshData } from './lofted-car.ts';
import { loadLoftedCar, loadLoftedCarMaterial, loadVdCarMaterial, loadVdCarMesh, loadVehicleHeadlights } from '../physical-graph.ts';
import { VD_LANE } from '../world/curb.ts';
import type { VdCarId } from '../world/vd-car-mesh.ts';
import { VD_XFORM_ATTRIBUTE, vdInstancedGeometry, writeVdXform } from '../world/vd-instanced.ts';
import { PHYSICAL_SEED_ASSETS, SEED_ASSETS } from './seed-assets.ts';
import { envSectionOffset } from './signal-viz.ts';
import {
  VEHICLE_KINDS,
  VEHICLE_SEMANTIC_ID,
  VFLAG,
  VSNAP,
  VSNAP_HEADER,
  VSNAP_STRIDE,
  interpolateVehiclePose,
  type VehicleKind,
} from './vehicle-sim.ts';
import type { FlareMount, HeadlightTier, LightFocus } from './vehicle-headlights.ts';
import {
  FLARE_GLOW_ON,
  HEADLIGHT_POOL,
  LOFTED_NEAR_VEHICLES,
  headlightBeamScale,
  slopGlowFromLampLevel,
} from './vehicle-physical-constants.ts';
import { pushBox } from './box-faces.ts';

/** Opt-in lane flag — default OFF, matching the L1–L6 realism lanes. `EXPO_PUBLIC_LIVING_CITY=1`. */
export const EXPERIMENTAL_LIVING_CITY = parseSkyRigFlag(process.env.EXPO_PUBLIC_LIVING_CITY);

/**
 * The flag gate, pure so the zero-diff contract is testable under node:
 * flag off returns [] — the scene's actors array is byte-identical to
 * pre-PR05 — flag on passes the factories through.
 */
export { EXPERIMENTAL_WORLD_PHYSICAL };

export function livingCityFactoriesFor(flag: boolean, factories: readonly SceneActorFactory[]): readonly SceneActorFactory[] {
  return flag ? factories : [];
}

/** Instanced capacity per vehicle class — plenty over the host's default population. */
const VEHICLE_CAPACITY = 48;
/** Vehicles scale in over this many seconds at spawn so a mid-block spawn never pops. */
const SPAWN_GROW_SECONDS = 0.7;

// --- Pure helpers (node --test) ---------------------------------------------------

export interface BoxGeometryData {
  readonly positions: number[];
  readonly normals: number[];
  readonly indices: number[];
  readonly triangles: number;
}

/** Append an axis-aligned box to the position/normal/index lists (24 verts, 12 tris). */

/**
 * The `proc:box-car` / `proc:box-bus` recipe: a body box, a cabin box biased
 * slightly rearward (forward is +Z per the registry contract), and four
 * wheel blocks, sized from the resolved entry's declared bounds. Six boxes
 * = 72 triangles; pivots at ground-centre so `y=0` plants the wheels.
 */
export function boxCarGeometryData(bounds: { lengthM: number; widthM: number; heightM: number }): BoxGeometryData {
  const { lengthM: l, widthM: w, heightM: h } = bounds;
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const wheelH = Math.min(0.34, h * 0.22);
  const bodyH = h * 0.58;
  // Body: wheels clear the ground plane; the box starts at wheel hub height.
  pushBox(pos, nrm, idx, 0, wheelH + bodyH / 2, 0, w, bodyH, l);
  // Cabin: rear-biased so the +Z nose reads at speed; vans/buses get a tall cabin.
  const cabH = h * 0.42;
  const cabL = l > 6 ? l * 0.88 : l * 0.5;
  pushBox(pos, nrm, idx, 0, wheelH + bodyH + cabH / 2, l > 6 ? 0 : -l * 0.07, w * 0.86, cabH, cabL);
  // Wheels.
  const wx = w / 2 - (w * 0.14) / 2;
  const wz = l * 0.32;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      pushBox(pos, nrm, idx, sx * wx, wheelH / 2 + 0.02, sz * wz, w * 0.14, wheelH, l * 0.13);
    }
  }
  return { positions: pos, normals: nrm, indices: idx, triangles: idx.length / 3 };
}

/** URI prefix of the Slop-grade lofted recipes (seed-assets.ts LOFTED_VEHICLE_ASSETS). */
export const LOFTED_RECIPE_PREFIX = 'proc:lofted-';

export function isLoftedRecipe(entry: WorldAssetEntry | null | undefined): boolean {
  return entry?.uri?.startsWith(LOFTED_RECIPE_PREFIX) ?? false;
}

/**
 * The first registry candidate we can actually build a mesh from, in
 * fallback-chain order. `glb:` URIs and `three:` generator URIs are PENDING
 * (no vendored file / unverified worklet import) — the `proc:` recipes are
 * the built tier today. Returns the last candidate as a last resort so an
 * entry can never render nothing.
 *
 * With `kind` (the physical flag's path), a lofted recipe drawn for that
 * sim kind wins first; it sits in the procedural tier, so it ranks above
 * the primitive box. Without `kind` the lofted recipes are skipped, which
 * keeps the flag-off resolution exactly what it was.
 */
export function resolveVehicleEntry(registry: WorldAssetRegistry, semanticId: string, kind?: VehicleKind): WorldAssetEntry | null {
  const chain = candidates(registry, semanticId);
  if (chain.length === 0) return null;
  if (kind) {
    for (const entry of chain) {
      if (isLoftedRecipe(entry) && entry.status !== 'pending-verification' && entry.params?.vehicleKind === kind) return entry;
    }
  }
  for (const entry of chain) {
    if (entry.uri?.startsWith('proc:') && !isLoftedRecipe(entry)) return entry;
  }
  return chain[chain.length - 1]!;
}

/** Deterministic NYC-ish paint pick per vehicle id — the same car keeps its colour across frames. */
export function vehiclePaintIndex(id: number): number {
  return Math.abs((id * 2654435761) % 997) % VEHICLE_PAINTS.length;
}

/** Muted street palette: silvers, charcoal, white van, taxi yellow, MTA-ish bus blue. */
const VEHICLE_PAINTS = [
  '#c8ccd0', '#9aa0a6', '#3c4043', '#202124', '#5f6368', '#dadce0',
  '#f7c948', '#f7c948', // taxis (double weight)
  '#e8eaed', '#8ab4f8', '#a14242', '#35507a',
] as const;

export function vehiclePaint(id: number): string {
  return VEHICLE_PAINTS[vehiclePaintIndex(id)]!;
}

// --- PR07 vehicle lights ----------------------------------------------------
//
// The spec's "responsive brake/headlight effects": every vehicle gets a
// fixed block of light quads in ONE extra InstancedMesh — headlamp pair,
// tail pair, front/rear indicator pairs. The packed `flags` byte is the
// only authority: VFLAG.headlights (world clock), VFLAG.braking
// (deceleration), VFLAG.blinkLeft/blinkRight (turn intent) — exactly the
// bits the sim stamped this tick. Colours go in instanceColor on an
// additive glow material, so a flag change is a colour write, never a
// geometry rebuild, and day vehicles cost near-invisible instances.

/** Light slots per vehicle: headL/R, tailL/R, front indicators L/R, rear indicators L/R. */
export const LIGHT_SLOTS_PER_VEHICLE = 8;
/** Slot order inside a vehicle's block — tests and docs reference this. */
export const VLIGHT = { headL: 0, headR: 1, tailL: 2, tailR: 3, indFL: 4, indFR: 5, indRL: 6, indRR: 7 } as const;

/** Indicator cadence, ~1.4 Hz square wave on the sim clock (packs with the snapshot, never wall time). */
export function indicatorBlink(simTime: number): boolean {
  return ((simTime * 1.4) % 1 + 1) % 1 < 0.55;
}

export const VEHICLE_LIGHT_COLORS = {
  head: [1.0, 0.95, 0.78],
  tail: [0.55, 0.05, 0.06],
  brake: [1.0, 0.1, 0.08],
  amber: [1.0, 0.55, 0.08],
  off: [0.012, 0.012, 0.014],
} as const;
export type VehicleLightColorKey = keyof typeof VEHICLE_LIGHT_COLORS;

/**
 * The eight slot colours for a vehicle's packed flags — pure, so the
 * node tests assert the mapping without three. `blinkOn` is the
 * indicator parity for this frame's sim time.
 */
export function vehicleLightKeys(flags: number, blinkOn: boolean): readonly VehicleLightColorKey[] {
  const keys: VehicleLightColorKey[] = ['off', 'off', 'off', 'off', 'off', 'off', 'off', 'off'];
  const headlights = (flags & VFLAG.headlights) !== 0;
  const braking = (flags & VFLAG.braking) !== 0;
  if (headlights) {
    keys[VLIGHT.headL] = 'head';
    keys[VLIGHT.headR] = 'head';
    keys[VLIGHT.tailL] = 'tail';
    keys[VLIGHT.tailR] = 'tail';
  }
  if (braking) {
    keys[VLIGHT.tailL] = 'brake';
    keys[VLIGHT.tailR] = 'brake';
  }
  if (blinkOn && (flags & VFLAG.blinkLeft) !== 0) {
    keys[VLIGHT.indFL] = 'amber';
    keys[VLIGHT.indRL] = 'amber';
  }
  if (blinkOn && (flags & VFLAG.blinkRight) !== 0) {
    keys[VLIGHT.indFR] = 'amber';
    keys[VLIGHT.indRR] = 'amber';
  }
  return keys;
}

/** Quad size (metres) — a NYC 4×4-inch lamp read, grown slightly so the glow registers. */
const LIGHT_QUAD_SIZE = 0.22;

/**
 * Light mounts in vehicle-local space — [halfWidth multiplier, extra height,
 * halfLength multiplier, faces +Z?]. Forward is +Z (registry contract); rear
 * lights and rear indicators face back. Indicators sit on the outer corners.
 */
const LIGHT_MOUNTS: readonly (readonly [number, number, number, boolean])[] = [
  [-0.62, 0.0, 1.02, true],   // headL
  [0.62, 0.0, 1.02, true],    // headR
  [-0.62, 0.0, -1.02, false], // tailL
  [0.62, 0.0, -1.02, false],  // tailR
  [-0.9, 0.0, 0.98, true],    // indFL
  [0.9, 0.0, 0.98, true],     // indFR
  [-0.9, 0.0, -0.98, false],  // indRL
  [0.9, 0.0, -0.98, false],   // indRR
];

export interface VehicleActorOptions {
  /** Latest packed snapshot (host's `latestSnapshot()` on JS, a Synchronizable `getDirty()` on the render runtime). */
  readonly read: () => readonly number[] | null | undefined;
  /** Registry to resolve meshes from — default the seeded registry. */
  readonly registry?: WorldAssetRegistry;
  /** Host lifecycle hooks — attach/detach the sim ticker on the JS path. */
  readonly onMount?: () => void;
  readonly onUnmount?: () => void;
  /** Instance capacity per vehicle class (default 48). */
  readonly capacity?: number;
  /** Slop-grade fleet: lofted recipes, physical lights, flares. Default EXPO_PUBLIC_WORLD_PHYSICAL. */
  readonly physical?: boolean;
  /**
   * Camera on the ground plane, for near/far detail, headlight ranking and flares. Without it every lofted vehicle
   * draws the proxy past the near cap in snapshot order and no headlight light or flare is assigned.
   */
  readonly focus?: () => LightFocus | null;
  /** Headlight pool and detail tier (default EXPO_PUBLIC_WORLD_TIER). */
  readonly tier?: HeadlightTier;
  /**
   * Headlight PointLights on the road ahead of the nearest vehicles (default WORLD_CLUSTERED_LIGHTING: on when the
   * scene mounts three's ClusteredLighting). Without ClusteredLighting each one is a light every lit material
   * evaluates, so a renderer without it leaves them off.
   */
  readonly headlightLights?: boolean;
  /** Rear plate atlas for the lofted cars (plateAtlasPixels layout); defaults to the pixel-font atlas. */
  readonly plateTexture?: unknown;
  /** vd lane: the near car set wears Valdrada's baked bodies (VD_FLEET_BODIES). Default VD_LANE; needs `physical`. */
  readonly vd?: boolean;
  /** Camera field of view (degrees) and viewport height (px) for flare sizing. */
  readonly flareView?: { readonly fovDeg: number; readonly viewportPx: number };
}

/**
 * The vehicle fleet as a scene actor. `update` reads the newest snapshot,
 * lerps each record prev→curr over one tick, writes one instance matrix per
 * vehicle and reports motion so the on-demand canvas keeps drawing.
 */
export function createVehicleActor(options: VehicleActorOptions): SceneActorFactory {
  return (threeNamespace: unknown): SceneActor => {
    const THREE = threeNamespace as Three;
    const physical = options.physical ?? EXPERIMENTAL_WORLD_PHYSICAL;
    const registry = options.registry ?? createWorldAssetRegistry(physical ? PHYSICAL_SEED_ASSETS : SEED_ASSETS);
    const capacity = options.capacity ?? VEHICLE_CAPACITY;
    const group = new THREE.Group();
    group.name = 'living-city:vehicles';

    interface KindMesh {
      kind: VehicleKind;
      mesh: InstanceType<typeof THREE.InstancedMesh>;
      geometry: { dispose(): void };
      material: InstanceType<typeof THREE.MeshStandardMaterial>;
      capacity: number;
      /** Declared bounds — the light quads mount against them. */
      lengthM: number;
      widthM: number;
      heightM: number;
    }
    const kindMeshes = new Map<VehicleKind, KindMesh>();
    const colors = new Map<number, InstanceType<typeof THREE.Color>>();
    const lofted = physical ? createLoftedFleet(THREE, registry, capacity, options, group) : null;
    for (const kind of VEHICLE_KINDS) {
      if (lofted?.kinds.has(kind)) continue;
      const entry = resolveVehicleEntry(registry, VEHICLE_SEMANTIC_ID[kind]);
      if (!entry) continue;
      const bounds = entry.bounds ?? { lengthM: 4.6, widthM: 1.9, heightM: 1.5 };
      const data = boxCarGeometryData(bounds);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
      geometry.setIndex(data.indices);
      const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, metalness: 0.2 });
      const mesh = new THREE.InstancedMesh(geometry, material, capacity);
      mesh.name = `living-city:vehicles:${kind}`;
      mesh.count = 0;
      mesh.frustumCulled = false;
      group.add(mesh);
      kindMeshes.set(kind, {
        kind, mesh, geometry, material, capacity,
        lengthM: bounds.lengthM, widthM: bounds.widthM, heightM: bounds.heightM,
      });
    }

    // PR07: one instanced quad mesh for every vehicle light — 8 slots per
    // vehicle (VLIGHT). Additive radial-falloff glow with per-instance
    // colour; depthWrite off and no fog, matching the world's own additive
    // layers (street-furniture.ts lamp pools, the signal lenses).
    const T = THREE.TSL;
    const lightGeometry = new THREE.PlaneGeometry(1, 1);
    const lightMaterial = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      side: THREE.DoubleSide,
    });
    {
      const r = T.uv().sub(0.5).length().mul(2);
      const fall = T.float(1).sub(T.smoothstep(0, 1, r));
      lightMaterial.colorNode = T.vec4(T.float(1), T.float(1), T.float(1), 1);
      lightMaterial.opacityNode = fall.mul(fall).mul(0.95);
    }
    const lightCapacity = capacity * LIGHT_SLOTS_PER_VEHICLE;
    const lightMesh = new THREE.InstancedMesh(lightGeometry, lightMaterial, Math.max(1, lightCapacity));
    lightMesh.name = 'living-city:vehicle-lights';
    lightMesh.renderOrder = 5;
    lightMesh.count = 0;
    lightMesh.frustumCulled = false;
    group.add(lightMesh);

    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const lightColor = new THREE.Color();
    const pose = { x: 0, z: 0, yaw: 0 };
    const counts = new Map<VehicleKind, number>();
    let lastVersion = -1;
    let tSince = 0;
    let lastCount = -1;

    options.onMount?.();

    return {
      id: 'living-city:vehicles',
      object: group,
      update: (frame: ActorFrame): boolean => {
        const snap = options.read();
        const version = snap && snap.length >= VSNAP_HEADER ? (snap[VSNAP.version] ?? 0) : -1;
        if (version !== lastVersion) {
          lastVersion = version;
          tSince = 0;
        } else {
          tSince += frame.delta;
        }
        const tickDt = snap && snap.length >= VSNAP_HEADER ? (snap[VSNAP.tickDt] ?? 0) : 0;
        const alpha = tickDt > 0 ? Math.min(1, tSince / tickDt) : 1;
        const count = snap && snap.length >= VSNAP_HEADER ? (snap[VSNAP.count] ?? 0) : 0;
        // PR07: the env section carries the sim clock the indicators blink on.
        const env = readEnvSection(snap, envSectionOffset(snap), snap && snap.length >= VSNAP_HEADER ? (snap[VSNAP.simTime] ?? 0) : 0);
        const blinkOn = indicatorBlink(env.simTime);
        for (const kind of VEHICLE_KINDS) counts.set(kind, 0);
        lofted?.begin();
        let moving = false;
        let lightSlot = 0;
        if (snap && version >= 0) {
          for (let i = 0; i < count; i++) {
            const o = VSNAP_HEADER + i * VSNAP_STRIDE;
            const id = snap[o] ?? 0;
            const kindIdx = Math.max(0, Math.min(VEHICLE_KINDS.length - 1, snap[o + 1] ?? 0));
            const kind = VEHICLE_KINDS[kindIdx]!;
            if (lofted?.kinds.has(kind)) {
              if ((snap[o + 8] ?? 0) > 0.05) moving = true;
              lofted.collect(snap, i, alpha, kind);
              continue;
            }
            const km = kindMeshes.get(kind);
            if (!km) continue;
            const slot = counts.get(kind)!;
            if (slot >= km.capacity) continue;
            interpolateVehiclePose(snap, i, alpha, pose);
            const speed = snap[o + 8] ?? 0;
            const flags = snap[o + 9] ?? 0;
            const age = snap[o + 10] ?? 99;
            if (speed > 0.05) moving = true;
            // Spawn grow-in: a mid-block spawn eases from 30 % scale over ~0.7 s instead of popping.
            const grow = Math.min(1, 0.3 + (age / SPAWN_GROW_SECONDS) * 0.7);
            quat.setFromAxisAngle(up, pose.yaw);
            pos.set(pose.x, 0, pose.z);
            scale.set(grow, grow, grow);
            matrix.compose(pos, quat, scale);
            km.mesh.setMatrixAt(slot, matrix);
            let color = colors.get(id);
            if (!color) {
              color = new THREE.Color(vehiclePaint(id));
              colors.set(id, color);
            }
            km.mesh.setColorAt(slot, color);
            counts.set(kind, slot + 1);

            // PR07: the light block — the packed flags are the only
            // authority. Local mounts ride the declared bounds so vans,
            // sedans and buses light their own corners; forward is +Z.
            if (lightSlot + LIGHT_SLOTS_PER_VEHICLE <= lightCapacity) {
              const keys = vehicleLightKeys(flags, blinkOn);
              const sy = Math.sin(pose.yaw);
              const cy = Math.cos(pose.yaw);
              const hl = km.lengthM / 2;
              const hw = km.widthM / 2;
              const hy = Math.min(1.05, Math.max(0.5, km.heightM * 0.45));
              // [localX, localY, localZ, faces-forward?] per slot.
              const mount = LIGHT_MOUNTS;
              for (let s = 0; s < LIGHT_SLOTS_PER_VEHICLE; s++) {
                const m = mount[s]!;
                const lx = m[0] * hw;
                const ly = hy + m[1];
                const lz = m[2] * hl;
                const wx = pose.x + sy * lz + cy * lx;
                const wz = pose.z + cy * lz - sy * lx;
                quat.setFromAxisAngle(up, m[3] ? pose.yaw : pose.yaw + Math.PI);
                matrix.compose(
                  pos.set(wx, ly, wz),
                  quat,
                  scale.set(LIGHT_QUAD_SIZE, LIGHT_QUAD_SIZE, 1),
                );
                const slotIndex = lightSlot + s;
                lightMesh.setMatrixAt(slotIndex, matrix);
                const c = VEHICLE_LIGHT_COLORS[keys[s]!];
                lightMesh.setColorAt(slotIndex, lightColor.setRGB(c[0], c[1], c[2]));
              }
              lightSlot += LIGHT_SLOTS_PER_VEHICLE;
            }
          }
        }
        lightMesh.count = lightSlot;
        if (lightSlot > 0) {
          lightMesh.instanceMatrix.needsUpdate = true;
          if (lightMesh.instanceColor) lightMesh.instanceColor.needsUpdate = true;
        }
        for (const km of kindMeshes.values()) {
          const c = counts.get(km.kind) ?? 0;
          if (km.mesh.count !== c) km.mesh.count = c;
          if (c > 0) {
            km.mesh.instanceMatrix.needsUpdate = true;
            if (km.mesh.instanceColor) km.mesh.instanceColor.needsUpdate = true;
          }
        }
        lofted?.commit(env.lampLevel, blinkOn);
        const changed = count !== lastCount;
        lastCount = count;
        // Keep the canvas drawing while the fleet moves or the roster changed this frame.
        return moving || changed;
      },
      dispose: () => {
        options.onUnmount?.();
        for (const km of kindMeshes.values()) {
          km.geometry.dispose();
          km.material.dispose();
          km.mesh.dispose();
        }
        lightGeometry.dispose();
        lightMaterial.dispose();
        lightMesh.dispose();
        lofted?.dispose();
        group.clear();
      },
    };
  };
}

// --- Slop-grade lofted fleet (EXPO_PUBLIC_WORLD_PHYSICAL) ---------------------------------------------------------

/**
 * vd lane near bodies per car kind, picked per vehicle id (vdCarHash). Sedans spread over the CARLA saloons and the
 * SUV, taxis are mostly the TLC cab with some yellow-painted Lincolns, vans the Sprinter. The bus stays lofted.
 */
export const VD_FLEET_BODIES: Readonly<Record<Exclude<VehicleKind, 'bus'>, readonly VdCarId[]>> = {
  sedan: ['lincoln', 'mercedes', 'charger', 'suv'],
  taxi: ['taxinv200', 'taxinv200', 'lincoln'],
  van: ['van'],
};

/**
 * vd lane: a vehicle draws its full body (LOD2) only inside this distance of the camera focus, as the parked cars do
 * (street-props.ts VD_PARKED_RADIUS); past it, or past the near cap, the same body's `mid` decimation.
 */
export const VD_FLEET_NEAR_METRES = 40;

interface LoftedFleet {
  /** Kinds this fleet draws; the box path skips them. */
  readonly kinds: ReadonlySet<VehicleKind>;
  begin(): void;
  /** Queue one snapshot record for this frame. */
  collect(snap: readonly number[], index: number, alpha: number, kind: VehicleKind): void;
  /** Write instances, headlight lights and flares for the queued records. */
  commit(lampLevel: number, blinkOn: boolean): void;
  dispose(): void;
}

interface FleetRecord {
  kind: VehicleKind;
  id: number;
  x: number;
  z: number;
  yaw: number;
  flags: number;
  grow: number;
  dist: number;
}

/**
 * Builds the lofted meshes for every kind whose registry resolution lands on a lofted recipe. Plain function of
 * its arguments: the meshes, buffers and lights live in this closure, created on whichever runtime builds the
 * scene.
 */
function createLoftedFleet(
  THREE: Three,
  registry: WorldAssetRegistry,
  capacity: number,
  options: VehicleActorOptions,
  group: InstanceType<Three['Group']>,
): LoftedFleet | null {
  const { buildBusGeometryData, buildCarGeometryData, buildCarProxyGeometryData, bodySpecForKind, frontLampMount, rearLampMount } =
    loadLoftedCar();
  const { LOFTED_INSTANCE_ATTRIBUTES, carStateFromFlags, createLoftedBusMaterial, createLoftedCarMaterial, vehiclePaintToken } =
    loadLoftedCarMaterial();
  const {
    FLARES_PER_VEHICLE,
    FLARE_STRIDE,
    createCarFlareMaterial,
    createVehicleHeadlight,
    headlightLightCount,
    metresPerPixelAt1m,
    placeVehicleHeadlight,
    rankLitVehicles,
    writeVehicleFlares,
  } = loadVehicleHeadlights();
  const T = THREE.TSL;
  const tier: HeadlightTier = options.tier ?? WORLD_TIER;
  const nearCap = LOFTED_NEAR_VEHICLES[tier];
  const glow = T.uniform(slopGlowFromLampLevel(0));
  const plateTexture = options.plateTexture as InstanceType<Three['Texture']> | undefined;
  let ownedPlate: InstanceType<Three['Texture']> | null = null;

  type Object3D = InstanceType<Three['Object3D']> & { geometry: { dispose(): void } };
  /** One drawn body level: the lofted InstancedMesh or a vd instanced Mesh, behind one slot writer. */
  interface Lod {
    readonly mesh: Object3D;
    readonly capacity: number;
    count: number;
    /** Writes the next slot: pose, paint (linear RGB) and carState. */
    write(slot: number, x: number, z: number, yaw: number, grow: number, rgb: readonly number[], state: readonly number[]): void;
    /** Publishes `count` and flags this frame's slots for upload. */
    flush(): void;
  }
  interface LoftedKind {
    readonly kind: VehicleKind;
    /** One near mesh (lofted) or one per vd body; `pickNear` chooses the mesh for a vehicle id. */
    readonly nears: readonly Lod[];
    readonly pickNear: (id: number) => number;
    /** Near slots across all `nears`. */
    readonly nearCap: number;
    /** Past the near cap: the lofted proxy (one), the vd `mid` body (one per near, same index), or none (lofted bus). */
    readonly fars: readonly Lod[];
    /** Near only within this focus distance (vd); Infinity keeps the lofted fleet's cap-only rule. */
    readonly nearMetres: number;
    readonly material: InstanceType<Three['MeshStandardNodeMaterial']>;
    readonly head: { readonly headlight: readonly [number, number]; readonly zFront: number };
    readonly flare: FlareMount;
    readonly bus: boolean;
  }

  const loftedGeometry = (data: VehicleMeshData) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
    geometry.setAttribute('partId', new THREE.BufferAttribute(data.partIds, 1));
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    return geometry;
  };
  const buildLod = (
    kind: VehicleKind, data: VehicleMeshData | InstanceType<Three['InstancedMesh']>['geometry'], material: InstanceType<Three['Material']>, cap: number, name: string,
  ): Lod => {
    const geometry = 'isBufferGeometry' in data ? data : loftedGeometry(data);
    const paint = new THREE.InstancedBufferAttribute(new Float32Array(cap * LOFTED_INSTANCE_ATTRIBUTES.paintColor), LOFTED_INSTANCE_ATTRIBUTES.paintColor);
    const state = new THREE.InstancedBufferAttribute(new Float32Array(cap * LOFTED_INSTANCE_ATTRIBUTES.carState), LOFTED_INSTANCE_ATTRIBUTES.carState);
    paint.setUsage(THREE.DynamicDrawUsage);
    state.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('paintColor', paint);
    geometry.setAttribute('carState', state);
    const mesh = new THREE.InstancedMesh(geometry, material, cap);
    mesh.name = `living-city:vehicles:${kind}:${name}`;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = name.startsWith('near');
    mesh.receiveShadow = true;
    group.add(mesh);
    const lod: Lod = {
      mesh, capacity: cap, count: 0,
      write: (slot, x, z, yaw, grow, rgb, carState) => {
        quat.setFromAxisAngle(up, yaw);
        matrix.compose(pos.set(x, 0, z), quat, scale.set(grow, grow, grow));
        mesh.setMatrixAt(slot, matrix);
        (paint.array as Float32Array).set(rgb, slot * 3);
        (state.array as Float32Array).set(carState, slot * 4);
      },
      flush: () => {
        if (mesh.count !== lod.count) mesh.count = lod.count;
        if (lod.count > 0) {
          mesh.instanceMatrix.needsUpdate = true;
          paint.needsUpdate = true;
          state.needsUpdate = true;
        }
      },
    };
    return lod;
  };
  // vd: one instanced Mesh per body and level over the body's geometry (world/vd-instanced.ts).
  const buildVdLod = (
    kind: VehicleKind, base: InstanceType<Three['BufferGeometry']>, material: InstanceType<Three['Material']>, cap: number, name: string,
  ): Lod => {
    const made = vdInstancedGeometry(THREE, base, cap, [
      [VD_XFORM_ATTRIBUTE, 4], ['carState', LOFTED_INSTANCE_ATTRIBUTES.carState], ['paintColor', LOFTED_INSTANCE_ATTRIBUTES.paintColor],
    ]);
    const { geometry, buffer, stride } = made;
    const at = { xform: made.offsets[VD_XFORM_ATTRIBUTE]!, state: made.offsets.carState!, paint: made.offsets.paintColor! };
    const array = buffer.array as Float32Array;
    // Visible while empty, as the lofted fleet's meshes are: instanceCount 0 skips the draw, and the one shared node
    // build happens on frame 0 instead of when the first vehicle drives in.
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `living-city:vehicles:${kind}:${name}`;
    mesh.frustumCulled = false;
    mesh.castShadow = name.startsWith('near');
    mesh.receiveShadow = true;
    group.add(mesh);
    const lod: Lod = {
      mesh, capacity: cap, count: 0,
      write: (slot, x, z, yaw, grow, rgb, carState) => {
        writeVdXform(array, slot, stride, at.xform, x, z, yaw, grow);
        array.set(carState, slot * stride + at.state);
        array.set(rgb, slot * stride + at.paint);
      },
      flush: () => {
        geometry.instanceCount = lod.count;
        if (lod.count > 0) buffer.needsUpdate = true;
      },
    };
    return lod;
  };

  // vd lane: the baked bodies and their one shared material, loaded only when the lane is on.
  const vd = options.vd ?? VD_LANE;
  const vdMesh = vd ? loadVdCarMesh() : null;
  const vdMaterial = vd ? loadVdCarMaterial().createVdCarMaterial(THREE, { glow }) : null;
  const firstNear = (): number => 0;

  const kinds = new Map<VehicleKind, LoftedKind>();
  for (const kind of VEHICLE_KINDS) {
    const entry = resolveVehicleEntry(registry, VEHICLE_SEMANTIC_ID[kind], kind);
    if (!isLoftedRecipe(entry)) continue;
    if (vdMesh && vdMaterial) {
      // vd: the same baked body near (LOD2) and past the near cap (the `mid` decimation), per body.
      const bodies: readonly VdCarId[] = kind === 'bus' ? [vdMesh.VD_BUS_ID] : VD_FLEET_BODIES[kind];
      const ids = [...new Set(bodies)];
      const cap = Math.min(capacity, nearCap);
      const nears: Lod[] = [];
      const fars: Lod[] = [];
      for (const id of ids) {
        const lods = vdMesh.vdCarLodGeometries(THREE, id);
        nears.push(buildVdLod(kind, lods.near, vdMaterial, cap, `near-vd-${id}`));
        fars.push(buildVdLod(kind, lods.mid, vdMaterial, capacity, `far-vd-${id}`));
        lods.far.dispose();
      }
      const slot = bodies.map((id) => ids.indexOf(id));
      const pickNear = slot.length === 1 ? firstNear : (id: number) => slot[Math.floor(vdMesh.vdCarHash(id) * slot.length) % slot.length]!;
      const front = frontLampMount(kind);
      const back = rearLampMount(kind);
      // The XD40 runs 12.5 m over bumpers: its lamps sit at its own ends, not the lofted bus's.
      const half = kind === 'bus' ? vdMesh.decodeVdCar(vdMesh.VD_BUS_ID).size[2] / 2 : 0;
      const zFront = kind === 'bus' ? half : front.zFront;
      const zRear = kind === 'bus' ? -half : back.zRear;
      kinds.set(kind, {
        kind, nears, pickNear, nearCap: cap, fars, nearMetres: VD_FLEET_NEAR_METRES, material: vdMaterial, bus: kind === 'bus',
        head: { headlight: [front.x, front.y], zFront },
        flare: { frontX: front.x, frontY: front.y, zFront, rearX: back.x, rearY: back.y, zRear },
      });
      continue;
    }
    if (kind === 'bus') {
      const material = createLoftedBusMaterial(THREE, { glow });
      const near = buildLod(kind, buildBusGeometryData(), material, capacity, 'near');
      const front = frontLampMount(kind);
      const back = rearLampMount(kind);
      kinds.set(kind, {
        kind, nears: [near], pickNear: firstNear, nearCap: capacity, fars: [], nearMetres: Infinity, material, bus: true,
        head: { headlight: [front.x, front.y], zFront: front.zFront },
        flare: { frontX: front.x, frontY: front.y, zFront: front.zFront, rearX: back.x, rearY: back.y, zRear: back.zRear },
      });
      continue;
    }
    const spec = bodySpecForKind(kind);
    const made = createLoftedCarMaterial(THREE, spec, { glow, plateTexture: plateTexture ?? ownedPlate ?? undefined });
    if (made.ownsPlateTexture) ownedPlate = made.plateTexture;
    const cap = Math.min(capacity, nearCap);
    const nears = [buildLod(kind, buildCarGeometryData(spec), made.material, cap, 'near')];
    const far = buildLod(kind, buildCarProxyGeometryData(spec), made.material, capacity, 'far');
    const front = frontLampMount(kind);
    const back = rearLampMount(kind);
    kinds.set(kind, {
      kind, nears, pickNear: firstNear, nearCap: cap, fars: [far], nearMetres: Infinity, material: made.material, bus: false,
      head: { headlight: [front.x, front.y], zFront: front.zFront },
      flare: { frontX: front.x, frontY: front.y, zFront: front.zFront, rearX: back.x, rearY: back.y, zRear: back.zRear },
    });
  }
  if (kinds.size === 0) return null;

  // A road pool ahead of each of the nearest vehicles, parked under the street when unassigned.
  const lightsOn = options.headlightLights ?? WORLD_CLUSTERED_LIGHTING;
  const lightGroup = new THREE.Group();
  lightGroup.name = 'living-city:vehicle-headlights';
  const lights: InstanceType<Three['PointLight']>[] = [];
  if (lightsOn) {
    for (let i = 0; i < headlightLightCount(tier); i++) {
      const light = createVehicleHeadlight(THREE);
      light.position.set(0, -1000, 0);
      lightGroup.add(light);
      lights.push(light);
    }
    group.add(lightGroup);
  }

  // Night flares: four per vehicle, one instanced sprite draw.
  const flareCapacity = Math.max(1, capacity * kinds.size * FLARES_PER_VEHICLE);
  const flarePos = new Float32Array(flareCapacity * FLARE_STRIDE);
  const flareCol = new Float32Array(flareCapacity * FLARE_STRIDE);
  const flareGeometry = new THREE.PlaneGeometry(1, 1);
  const flarePosAttr = new THREE.InstancedBufferAttribute(flarePos, FLARE_STRIDE);
  const flareColAttr = new THREE.InstancedBufferAttribute(flareCol, FLARE_STRIDE);
  flarePosAttr.setUsage(THREE.DynamicDrawUsage);
  flareColAttr.setUsage(THREE.DynamicDrawUsage);
  flareGeometry.setAttribute('flarePos', flarePosAttr);
  flareGeometry.setAttribute('flareCol', flareColAttr);
  const flareMaterial = createCarFlareMaterial(THREE, glow);
  const flares = new THREE.Mesh(flareGeometry, flareMaterial);
  flares.name = 'living-city:vehicle-flares';
  flares.frustumCulled = false;
  flares.visible = false;
  flares.renderOrder = 2;
  flares.count = 0;
  group.add(flares);
  const mpp = metresPerPixelAt1m(options.flareView?.fovDeg, options.flareView?.viewportPx);

  const records: FleetRecord[] = [];
  let recordCount = 0;
  const byKind = new Map<VehicleKind, number[]>();
  for (const kind of kinds.keys()) byKind.set(kind, []);
  const paints = new Map<number, [number, number, number]>();
  const paintColor = new THREE.Color();
  const pose = { x: 0, z: 0, yaw: 0 };
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const litPositions: FleetRecord[] = [];

  const writeInstance = (lod: Lod, rec: FleetRecord, blinkOn: boolean) => {
    const slot = lod.count++;
    let rgb = paints.get(rec.id);
    if (!rgb) {
      if (paints.size > capacity * 16) paints.clear();
      paintColor.setStyle(vehiclePaintToken(rec.kind, rec.id));
      rgb = [paintColor.r, paintColor.g, paintColor.b];
      paints.set(rec.id, rgb);
    }
    lod.write(slot, rec.x, rec.z, rec.yaw, rec.grow, rgb, carStateFromFlags(rec.flags, blinkOn, VFLAG));
  };

  const flush = (lod: Lod) => lod.flush();

  return {
    kinds: new Set(kinds.keys()),
    begin: () => {
      recordCount = 0;
    },
    collect: (snap, index, alpha, kind) => {
      const o = VSNAP_HEADER + index * VSNAP_STRIDE;
      interpolateVehiclePose(snap, index, alpha, pose);
      let rec = records[recordCount];
      if (!rec) {
        rec = { kind, id: 0, x: 0, z: 0, yaw: 0, flags: 0, grow: 1, dist: 0 };
        records.push(rec);
      }
      rec.kind = kind;
      rec.id = snap[o] ?? 0;
      rec.x = pose.x;
      rec.z = pose.z;
      rec.yaw = pose.yaw;
      rec.flags = snap[o + 9] ?? 0;
      rec.grow = Math.min(1, 0.3 + ((snap[o + 10] ?? 99) / SPAWN_GROW_SECONDS) * 0.7);
      rec.dist = 0;
      recordCount++;
    },
    commit: (lampLevel, blinkOn) => {
      glow.value = slopGlowFromLampLevel(lampLevel);
      const focus = options.focus?.() ?? null;
      for (const list of byKind.values()) list.length = 0;
      for (let i = 0; i < recordCount; i++) {
        const rec = records[i]!;
        if (focus) rec.dist = Math.hypot(rec.x - focus.x, rec.z - focus.z);
        byKind.get(rec.kind)?.push(i);
      }
      for (const [kind, lk] of kinds) {
        const list = byKind.get(kind)!;
        if (focus) list.sort((a, b) => records[a]!.dist - records[b]!.dist);
        for (const near of lk.nears) near.count = 0;
        for (const far of lk.fars) far.count = 0;
        let nearUsed = 0;
        for (const i of list) {
          const rec = records[i]!;
          const body = lk.pickNear(rec.id);
          const near = lk.nears[body]!;
          const far = lk.fars.length > 1 ? lk.fars[body] : lk.fars[0];
          const close = !focus || rec.dist <= lk.nearMetres;
          if (close && nearUsed < lk.nearCap && near.count < near.capacity) {
            writeInstance(near, rec, blinkOn);
            nearUsed++;
          } else if (far && far.count < far.capacity) writeInstance(far, rec, blinkOn);
        }
        for (const near of lk.nears) flush(near);
        for (const far of lk.fars) flush(far);
      }

      // Headlight pools: nearest effective distance first, faded at the cut-off, scaled by the night ramp.
      let used = 0;
      const beam = headlightBeamScale(glow.value);
      if (lights.length > 0 && focus && beam > 0.001) {
        litPositions.length = 0;
        for (let i = 0; i < recordCount; i++) litPositions.push(records[i]!);
        for (const lit of rankLitVehicles(litPositions, focus, lights.length)) {
          const rec = litPositions[lit.index]!;
          const lk = kinds.get(rec.kind)!;
          quat.setFromAxisAngle(up, rec.yaw);
          matrix.compose(pos.set(rec.x, 0, rec.z), quat, one);
          const light = lights[used++]!;
          placeVehicleHeadlight(light, lk.head, matrix);
          light.intensity = (lk.bus ? HEADLIGHT_POOL.busIntensity : HEADLIGHT_POOL.intensity) * beam * lit.fade;
        }
      }
      for (let i = used; i < lights.length; i++) {
        const light = lights[i]!;
        if (light.intensity === 0) continue;
        light.intensity = 0;
        light.position.set(0, -1000, 0);
      }

      // Flares past FLARE_NEAR_METRES once the glow says night.
      let flareCount = 0;
      if (focus && glow.value > FLARE_GLOW_ON) {
        for (let i = 0; i < recordCount; i++) {
          const rec = records[i]!;
          flareCount = writeVehicleFlares(flarePos, flareCol, flareCount, rec, kinds.get(rec.kind)!.flare, focus, mpp);
        }
      }
      flares.count = flareCount;
      flares.visible = flareCount > 0;
      if (flareCount > 0) {
        flarePosAttr.needsUpdate = true;
        flareColAttr.needsUpdate = true;
      }
    },
    dispose: () => {
      const materials = new Set<{ dispose(): void }>();
      for (const lk of kinds.values()) {
        for (const lod of [...lk.nears, ...lk.fars]) {
          lod.mesh.geometry.dispose();
          (lod.mesh as { dispose?: () => void }).dispose?.();
        }
        materials.add(lk.material);
      }
      if (vdMaterial) materials.add(vdMaterial);
      for (const m of materials) m.dispose();
      ownedPlate?.dispose();
      for (const light of lights) light.dispose();
      flareGeometry.dispose();
      flareMaterial.dispose();
    },
  };
}
