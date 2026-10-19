// Living City PR06 — the renderer half of the pedestrian crowd, mountable
// through the same SceneActorFactory seam as the vehicle fleet
// (city-scene.ts `actors`). It reads the appended ped section of the flat
// packed snapshot the sim host publishes (ped-sim.ts codec — the vehicle
// header/records are untouched), interpolates poses one tick in the past at
// render rate, and resolves meshes through the WorldAssetRegistry's
// semantic ids `ped.adult` / `ped.kid`.
//
// Registry honesty (same rule as PR05): the first buildable candidate wins.
// Today that's the `proc:person-2box` primitive — torso + head, feet pivot,
// ~1.7 m adult / ~1.15 m kid from each entry's declared bounds — because the
// GLB rigs are `pending-verification` (no vendored files, no runtime loader)
// and the `three:` PersonGenerator binding is PENDING worklet-bundle
// verification. `resolvePedEntry` is the single swap point.
//
// Budget: one InstancedMesh per ped kind = ≤ 2 draw calls; the two-box
// person is 24 triangles, so a full 256-ped crowd stays under ~6.5 k tris.

import type { Three } from '@acme/ui/three';
import type { ActorFrame, SceneActor, SceneActorFactory } from '../scene-actor.ts';
import {
  candidates,
  createWorldAssetRegistry,
  type WorldAssetEntry,
  type WorldAssetRegistry,
} from './asset-registry.ts';
import {
  PED_KINDS,
  PED_SEMANTIC_ID,
  PSNAP,
  PSNAP_HEADER,
  PSNAP_STRIDE,
  interpolatePedPose,
  pedSectionOffset,
  type PedKind,
} from './ped-sim.ts';
import { SEED_ASSETS } from './seed-assets.ts';
import { VSNAP, VSNAP_HEADER } from './vehicle-sim.ts';
import type { BoxGeometryData } from './vehicle-actor.ts';

/** Instanced capacity per ped kind — plenty over a few-hundred-ped crowd split two ways. */
const PED_CAPACITY = 192;
/** Peds scale in over this many seconds at spawn so a sidewalk spawn never pops. */
const PED_SPAWN_GROW_SECONDS = 0.5;
/** Subtle stride bob amplitude while a ped is actually moving. */
const BOB_METRES = 0.03;

// --- Pure helpers (node --test) ---------------------------------------------------

/**
 * The `proc:person-2box` recipe: a leg/hip block and a torso+head block,
 * feet pivot at y=0, forward +Z (the registry contract). Two boxes = 24
 * triangles; proportions come from the resolved entry's declared bounds so
 * the kid variant shrinks by data, not code.
 */
export function personGeometryData(bounds: { lengthM: number; widthM: number; heightM: number }): BoxGeometryData {
  const { widthM: w, heightM: h } = bounds;
  const d = Math.max(0.18, bounds.lengthM * 0.8); // torso depth reads slimmer than shoulders are wide
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  // Legs/hips: ground → ~55% height.
  pushBoxLocal(pos, nrm, idx, 0, h * 0.275, 0, w * 0.62, h * 0.55, d * 0.8);
  // Torso + head mass: 55% → top, slightly narrower than the shoulder bound.
  pushBoxLocal(pos, nrm, idx, 0, h * 0.55 + h * 0.225, 0, w * 0.86, h * 0.45, d);
  return { positions: pos, normals: nrm, indices: idx, triangles: idx.length / 3 };
}

function pushBoxLocal(pos: number[], nrm: number[], idx: number[], cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): void {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const faces: [number, number, number, number[]][] = [
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
 * First buildable candidate in fallback-chain order. `glb:` rigs are
 * PENDING and `three:` generator bindings are unverified in the worklet
 * bundle, so the `proc:` recipe is the built tier — same posture as
 * `resolveVehicleEntry`. Last candidate is the never-render-nothing resort.
 */
export function resolvePedEntry(registry: WorldAssetRegistry, semanticId: string): WorldAssetEntry | null {
  const chain = candidates(registry, semanticId);
  if (chain.length === 0) return null;
  for (const entry of chain) {
    if (entry.uri?.startsWith('proc:')) return entry;
  }
  return chain[chain.length - 1]!;
}

/** Deterministic clothing pick per ped id — the same person keeps their outfit across frames. */
export function pedClothesIndex(id: number): number {
  return Math.abs((id * 2654435761) % 997) % PED_CLOTHES.length;
}

/** Muted sidewalk palette: coats, denim, hoodies, a hi-vis vest, a MTA-ish blue. */
const PED_CLOTHES = [
  '#4a4e55', '#6b5d4f', '#38455c', '#7a3b3b', '#2e4a3a', '#5c5c66',
  '#8a8f96', '#31456b', '#6e4f86', '#a08b62', '#c7c9cc', '#e07b39',
] as const;

export function pedClothes(id: number): string {
  return PED_CLOTHES[pedClothesIndex(id)]!;
}

export interface PedActorOptions {
  /** Latest packed snapshot (host's `latestSnapshot()` on JS, a Synchronizable `getDirty()` on the render runtime). */
  readonly read: () => readonly number[] | null | undefined;
  /** Registry to resolve meshes from — default the seeded registry. */
  readonly registry?: WorldAssetRegistry;
  /** Host lifecycle hooks — attach/detach the sim ticker on the JS path. */
  readonly onMount?: () => void;
  readonly onUnmount?: () => void;
  /** Instance capacity per ped kind (default 192). */
  readonly capacity?: number;
}

/**
 * The pedestrian crowd as a scene actor. `update` reads the appended ped
 * section of the newest snapshot, lerps each record prev→curr over one
 * tick, writes one instance matrix per pedestrian and reports motion so
 * the on-demand canvas keeps drawing. Older vehicle-only snapshots are
 * tolerated — `pedSectionOffset` lands past the array end and the crowd
 * renders empty rather than crashing.
 */
export function createPedActor(options: PedActorOptions): SceneActorFactory {
  return (threeNamespace: unknown): SceneActor => {
    const THREE = threeNamespace as Three;
    const registry = options.registry ?? createWorldAssetRegistry(SEED_ASSETS);
    const capacity = options.capacity ?? PED_CAPACITY;
    const group = new THREE.Group();
    group.name = 'living-city:peds';

    interface KindMesh {
      kind: PedKind;
      mesh: InstanceType<typeof THREE.InstancedMesh>;
      geometry: { dispose(): void };
      material: InstanceType<typeof THREE.MeshStandardMaterial>;
      capacity: number;
    }
    const kindMeshes = new Map<PedKind, KindMesh>();
    const colors = new Map<number, InstanceType<typeof THREE.Color>>();
    for (const kind of PED_KINDS) {
      const entry = resolvePedEntry(registry, PED_SEMANTIC_ID[kind]);
      if (!entry) continue;
      const data = personGeometryData(entry.bounds ?? { lengthM: 0.45, widthM: 0.55, heightM: 1.7 });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
      geometry.setIndex(data.indices);
      const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, metalness: 0.0 });
      const mesh = new THREE.InstancedMesh(geometry, material, capacity);
      mesh.name = `living-city:peds:${kind}`;
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
    const counts = new Map<PedKind, number>();
    let lastVersion = -1;
    let tSince = 0;
    let lastCount = -1;

    options.onMount?.();

    return {
      id: 'living-city:peds',
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
        const pedOff = pedSectionOffset(snap);
        const count = snap && snap.length > pedOff ? (snap[pedOff + PSNAP.count] ?? 0) : 0;
        for (const kind of PED_KINDS) counts.set(kind, 0);
        let moving = false;
        if (snap && version >= 0) {
          for (let i = 0; i < count; i++) {
            const o = pedOff + PSNAP_HEADER + i * PSNAP_STRIDE;
            const id = snap[o] ?? 0;
            const kindIdx = Math.max(0, Math.min(PED_KINDS.length - 1, snap[o + 1] ?? 0));
            const kind = PED_KINDS[kindIdx]!;
            const km = kindMeshes.get(kind);
            if (!km) continue;
            const slot = counts.get(kind)!;
            if (slot >= km.capacity) continue;
            interpolatePedPose(snap, i, alpha, pose);
            const speed = snap[o + 8] ?? 0;
            const age = snap[o + 10] ?? 99;
            if (speed > 0.05) moving = true;
            const grow = Math.min(1, 0.3 + (age / PED_SPAWN_GROW_SECONDS) * 0.7);
            // Feet pivot: y lifts only for the stride bob while walking.
            const bob = speed > 0.1 ? Math.abs(Math.sin((frame.time ?? 0) * speed * Math.PI)) * BOB_METRES : 0;
            quat.setFromAxisAngle(up, pose.yaw);
            pos.set(pose.x, bob, pose.z);
            scale.set(grow, grow, grow);
            matrix.compose(pos, quat, scale);
            km.mesh.setMatrixAt(slot, matrix);
            let color = colors.get(id);
            if (!color) {
              color = new THREE.Color(pedClothes(id));
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
