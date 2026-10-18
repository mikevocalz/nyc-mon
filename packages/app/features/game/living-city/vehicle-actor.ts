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

import type { Three } from '@acme/ui/three';
import type { ActorFrame, SceneActor, SceneActorFactory } from '../scene-actor.ts';
import { parseSkyRigFlag } from '../world/sky-rig.ts';
import {
  candidates,
  createWorldAssetRegistry,
  type WorldAssetEntry,
  type WorldAssetRegistry,
} from './asset-registry.ts';
import { SEED_ASSETS } from './seed-assets.ts';
import {
  VEHICLE_KINDS,
  VEHICLE_SEMANTIC_ID,
  VSNAP,
  VSNAP_HEADER,
  VSNAP_STRIDE,
  interpolateVehiclePose,
  type VehicleKind,
} from './vehicle-sim.ts';

/** Opt-in lane flag — default OFF, matching the L1–L6 realism lanes. `EXPO_PUBLIC_LIVING_CITY=1`. */
export const EXPERIMENTAL_LIVING_CITY = parseSkyRigFlag(process.env.EXPO_PUBLIC_LIVING_CITY);

/**
 * The flag gate, pure so the zero-diff contract is testable under node:
 * flag off returns [] — the scene's actors array is byte-identical to
 * pre-PR05 — flag on passes the factories through.
 */
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
function pushBox(pos: number[], nrm: number[], idx: number[], cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): void {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const faces: [number, number, number, number[]][] = [
    // normal, the four corners (ccw seen from outside)
    [1, 0, 0, [hx, -hy, -hz, hx, -hy, hz, hx, hy, hz, hx, hy, -hz]],
    [-1, 0, 0, [-hx, -hy, hz, -hx, -hy, -hz, -hx, hy, -hz, -hx, hy, hz]],
    [0, 1, 0, [-hx, hy, -hz, hx, hy, -hz, hx, hy, hz, -hx, hy, hz]],
    [0, -1, 0, [-hx, -hy, hz, hx, -hy, hz, hx, -hy, -hz, -hx, -hy, -hz]],
    [0, 0, 1, [-hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz]],
    [0, 0, -1, [hx, -hy, -hz, -hx, -hy, -hz, -hx, hy, -hz, hx, hy, -hz]],
  ];
  for (const [nx, ny, nz, c] of faces) {
    const base = pos.length / 3;
    for (let i = 0; i < 4; i++) {
      pos.push(cx + c[i * 3]!, cy + c[i * 3 + 1]!, cz + c[i * 3 + 2]!);
      nrm.push(nx, ny, nz);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

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

/**
 * The first registry candidate we can actually build a mesh from, in
 * fallback-chain order. `glb:` URIs and `three:` generator URIs are PENDING
 * (no vendored file / unverified worklet import) — the `proc:` recipes are
 * the built tier today. Returns the last candidate as a last resort so an
 * entry can never render nothing.
 */
export function resolveVehicleEntry(registry: WorldAssetRegistry, semanticId: string): WorldAssetEntry | null {
  const chain = candidates(registry, semanticId);
  if (chain.length === 0) return null;
  for (const entry of chain) {
    if (entry.uri?.startsWith('proc:')) return entry;
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
}

/**
 * The vehicle fleet as a scene actor. `update` reads the newest snapshot,
 * lerps each record prev→curr over one tick, writes one instance matrix per
 * vehicle and reports motion so the on-demand canvas keeps drawing.
 */
export function createVehicleActor(options: VehicleActorOptions): SceneActorFactory {
  return (threeNamespace: unknown): SceneActor => {
    const THREE = threeNamespace as Three;
    const registry = options.registry ?? createWorldAssetRegistry(SEED_ASSETS);
    const capacity = options.capacity ?? VEHICLE_CAPACITY;
    const group = new THREE.Group();
    group.name = 'living-city:vehicles';

    interface KindMesh {
      kind: VehicleKind;
      mesh: InstanceType<typeof THREE.InstancedMesh>;
      geometry: { dispose(): void };
      material: InstanceType<typeof THREE.MeshStandardMaterial>;
      capacity: number;
    }
    const kindMeshes = new Map<VehicleKind, KindMesh>();
    const colors = new Map<number, InstanceType<typeof THREE.Color>>();
    for (const kind of VEHICLE_KINDS) {
      const entry = resolveVehicleEntry(registry, VEHICLE_SEMANTIC_ID[kind]);
      if (!entry) continue;
      const data = boxCarGeometryData(entry.bounds ?? { lengthM: 4.6, widthM: 1.9, heightM: 1.5 });
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
      kindMeshes.set(kind, { kind, mesh, geometry, material, capacity });
    }

    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
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
        for (const kind of VEHICLE_KINDS) counts.set(kind, 0);
        let moving = false;
        if (snap && version >= 0) {
          for (let i = 0; i < count; i++) {
            const o = VSNAP_HEADER + i * VSNAP_STRIDE;
            const id = snap[o] ?? 0;
            const kindIdx = Math.max(0, Math.min(VEHICLE_KINDS.length - 1, snap[o + 1] ?? 0));
            const kind = VEHICLE_KINDS[kindIdx]!;
            const km = kindMeshes.get(kind);
            if (!km) continue;
            const slot = counts.get(kind)!;
            if (slot >= km.capacity) continue;
            interpolateVehiclePose(snap, i, alpha, pose);
            const speed = snap[o + 8] ?? 0;
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
          }
        }
        for (const km of kindMeshes.values()) {
          const c = counts.get(km.kind) ?? 0;
          if (km.mesh.count !== c) km.mesh.count = c;
          if (c > 0) {
            km.mesh.instanceMatrix.needsUpdate = true;
            if (km.mesh.instanceColor) km.mesh.instanceColor.needsUpdate = true;
          }
        }
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
        group.clear();
      },
    };
  };
}
