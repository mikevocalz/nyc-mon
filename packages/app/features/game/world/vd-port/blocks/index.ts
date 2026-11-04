// Lane A: Valdrada's 125th Street blocks and landmarks on the bundled tile, from Valdrada's own builders.
//
// What is drawn, all of it baked by tooling/city/vd-port/bake.mjs running Valdrada's assembly (client/src/world/assemble.js)
// on the twenty tiles over the bundled tile:
//   * every facade-kit building in bounds (client/src/city/fk: specs fk/specs/{west,bid1..4,east}.js and the custom
//     builders fk/custom/*.js; the Apollo's front is w125cKit.js buildApollo33 through fk/custom/bid2.js), whole: walls,
//     windows, cornices, storefront bays, roll gates, signs, awnings, fire escapes;
//   * the landmarks in bounds (city/landmarks.js BUILDERS: whittierHall, schomburg, abyssinian; Hotel Theresa and the
//     State Office Building are facade-kit specs, acp-2082 and w125-163);
//   * the area parts w125cb (the State Office Building's plaza: w125cbKit.js plazaMeshes) and w125w (the 2023 hoarding;
//     its other structures lie outside the tile or are lane C's viaducts). w125c builds nothing while the kit owns the
//     Apollo; w125e's structures are the Park Avenue viaduct (lane C).
// Two levels, as Valdrada draws them:
//   * the shell, Valdrada's persistent tier (lod/bake_landmarks.js: meshoptimizer to at most 2000 triangles a structure,
//     its colours, the FW14 window grid), resident, drawn with its far material (shell-material.ts);
//   * the near level, the builders' own geometry welded and simplified to 2 cm (5 mm on the heroes), streamed by the cell
//     streamer in 128 m cells under its own budget; where a near cell is in, the shell cell under it hides (Valdrada's
//     near mask, NM24).
// The bundled tile's buildings each structure replaces (VD_BLOCKS.hide) leave the city mesh (world/index.ts).
//
// Legacy VDN1/2 near packs use the persistent tier's material. Authored VDN3 cells instead require their exact paired
// shader registry and original texture pages, authenticated and registered through the prereveal asset gate. Their
// registry must prove explicit bound program coverage; an unsupported family never becomes a generic material.
import type { Three } from '@acme/ui/three';
import { EMPTY_PART, type VdPortCtx, type VdPortPart } from '../types.ts';
import { cellNum, CELL } from '../../cells/cell-rules.ts';
import { ditherFadeMask } from '../../cells/cell-stream.ts';
import { decodeShellCell, type NearCellInfo, type ShellCellInfo } from './codec.ts';
import { sourceNearPackage } from './on-demand.ts';
import { vdBlockBytes } from './load.ts';
import { createResidentCollisionScene } from '../../../resident-collision.ts';
import { prepareTriangleCollision } from '../../../triangle-collision.ts';
import { collisionPackage } from './collision-package.ts';
import { shellCollisionRegion } from './shell-collision-pack.ts';
import { makeBlocksMaterial } from './shell-material.ts';
import { createNearCohortMask } from './cohort-mask.ts';
import { createSurfaceCohortPlan } from './surface-layers.ts';
import { buildSourceSurfacePart } from './surface-part.ts';
import { VD_BLOCKS, VD_FW14 } from './data/manifest.ts';
import { VD_BLOCKS_RING1 } from './data-ring1/manifest.ts';
import { VD_BLOCKS_RING2 } from './data-ring2/manifest.ts';
import { VD_BLOCKS_RING3 } from './data-ring3/manifest.ts';
import { VD_BLOCKS_RING4 } from './data-ring4/manifest.ts';
import { VD_BLOCKS_RING5 } from './data-ring5/manifest.ts';
import { VD_BLOCKS_RING6 } from './data-ring6/manifest.ts';
import { VD_BLOCKS_RING7 } from './data-ring7/manifest.ts';
import { VD_BLOCKS_RING8 } from './data-ring8/manifest.ts';
import { VD_BLOCKS_RING9 } from './data-ring9/manifest.ts';
import { VD_BLOCKS_RING10 } from './data-ring10/manifest.ts';
import { decodeBase64 } from '../../foliage.ts';
import { WORLD_PRESETS } from '../../../perf/tier-presets.ts';

type Mesh = InstanceType<Three['Mesh']>;

/** The near layer's mesh name (the streamer names its cells after the template). */
export const NEAR_NAME = 'city:vd-blocks-near';
export const SHELL_NAME = 'city:vd-blocks-shell';

/**
 * The near layer's stream spec. The streamer wants a layer while errorM x K / distance is at least the preset's
 * threshold. Valdrada draws its kit's near level within 120 m (fk/facadeKit.js LOD_D) on desktop GPUs; on the iPad preset
 * (K = 1536 / (2 tan 30 deg) = 1330 px, threshold 2 px) that reach held over a million near triangles resident along
 * 125th Street on the walk (cell-stream.walk.test.ts), so the reach here is 60 m there (errorM = 60 x 2 / 1330 = 0.09)
 * and 120 m on `high` (threshold 1). It is a reach, not the level's own 2 cm error. Fades in with the dither; never
 * pinned (a landmark's near cells evict like the rest; its shell stays).
 */
export const NEAR_LAYER = { errorM: 0.09, chunk: CELL, fade: true, pin: false } as const;

/** The near level's own budget on the ipad-a12x row (perf/tier-presets.ts vdPort.blocksNear); the ctx's preset wins. */
export const NEAR_BUDGET = WORLD_PRESETS['ipad-a12x'].vdPort.blocksNear;

/** The bundled tile's building ids lane A replaces, or null when the packs did not load (the tile keeps its own). */
export function vdHiddenBuildings(): ReadonlySet<string> | null {
  return vdBlockBytes() ? new Set<string>(VD_BLOCKS.hide) : null;
}

const inRing = (ring: readonly (readonly number[])[], x: number, z: number) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, zi = ring[i]![1]!, xj = ring[j]![0]!, zj = ring[j]![1]!;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};
let ownedSpecs: Set<string> | null = null;
type OwnedRing = readonly (readonly number[])[];
const OWNERSHIP_CELL = 128;
let ownedRings: Map<number, Map<number, OwnedRing[]>> | null = null;

function ownershipGrid(): Map<number, Map<number, OwnedRing[]>> {
  if (ownedRings) return ownedRings;
  const grid = new Map<number, Map<number, OwnedRing[]>>();
  for (const list of RING_STRUCTURES) for (const structure of list) for (const ring of structure.owned as readonly OwnedRing[]) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const point of ring) {
      x0 = Math.min(x0, point[0]!); x1 = Math.max(x1, point[0]!);
      z0 = Math.min(z0, point[1]!); z1 = Math.max(z1, point[1]!);
    }
    // Inclusive max buckets preserve the exact raycast's boundary behavior.
    for (let cx = Math.floor(x0 / OWNERSHIP_CELL); cx <= Math.floor(x1 / OWNERSHIP_CELL); cx++) {
      let column = grid.get(cx);
      if (!column) { column = new Map(); grid.set(cx, column); }
      for (let cz = Math.floor(z0 / OWNERSHIP_CELL); cz <= Math.floor(z1 / OWNERSHIP_CELL); cz++) {
        let candidates = column.get(cz);
        if (!candidates) { candidates = []; column.set(cz, candidates); }
        candidates.push(ring);
      }
    }
  }
  ownedRings = grid;
  return grid;
}

// Every ring's lane-A structures. A ring baked with none (ring 3) types as `readonly []`; iterating the list drops it.
const RING_STRUCTURES = [VD_BLOCKS.structures, VD_BLOCKS_RING1.structures, VD_BLOCKS_RING2.structures, VD_BLOCKS_RING3.structures, VD_BLOCKS_RING4.structures, VD_BLOCKS_RING5.structures, VD_BLOCKS_RING6.structures, VD_BLOCKS_RING7.structures, VD_BLOCKS_RING8.structures, VD_BLOCKS_RING9.structures, VD_BLOCKS_RING10.structures];

/**
 * Whether lane A draws this front whole, so another lane must not: a facade-kit face (`<spec>#<face>`, a spec lane A
 * baked) or any point inside a footprint lane A replaces. Always false when the packs did not load.
 */
export function vdBlocksOwn(frontId: string | null, x: number, z: number): boolean {
  if (!vdBlockBytes()) return false;
  if (!ownedSpecs) ownedSpecs = new Set(RING_STRUCTURES.flat().filter((s) => s.kind === 'fk').map((s) => s.id.slice(3)));
  if (frontId && ownedSpecs.has(frontId.split('#')[0]!)) return true;
  const candidates = ownershipGrid().get(Math.floor(x / OWNERSHIP_CELL))?.get(Math.floor(z / OWNERSHIP_CELL));
  for (const ring of candidates ?? []) if (inRing(ring, x, z)) return true;
  return false;
}

export function* prepare(ctx: VdPortCtx): Generator<number, VdPortPart> {
  const packs = vdBlockBytes();
  if (!packs) return EMPTY_PART;
  const { THREE } = ctx;
  const sourceCells = new Set(packs.surface?.cells.map((info) => cellNum(info.cx, info.cz)) ?? []);
  const fw14 = new THREE.DataTexture(decodeBase64(VD_FW14.rgba), VD_FW14.width, VD_FW14.height, THREE.RGBAFormat);
  fw14.wrapS = fw14.wrapT = THREE.RepeatWrapping;
  fw14.magFilter = THREE.LinearFilter;
  fw14.minFilter = THREE.LinearMipmapLinearFilter;
  fw14.generateMipmaps = true;
  fw14.anisotropy = 8;
  fw14.name = 'vd:far_windows_fw14';
  fw14.needsUpdate = true;
  // One material for both levels (makeBlocksMaterial), carrying the streamer's dither itself: the near cells fade by it,
  // the shell's meshes have no cellFade and keep every pixel. The layer is registered as sharing it (no clone, no
  // second mask), so the shell and the near level draw through one pipeline and one shadow program.
  const blocksMat = makeBlocksMaterial(THREE, ctx.env, fw14);
  (blocksMat as unknown as { maskNode: unknown }).maskNode = ditherFadeMask(THREE);
  const shellMat = blocksMat, nearMat = blocksMat;

  const initialChildren = new Set(ctx.group.children);
  const collisions = createResidentCollisionScene();
  // Camera collision is limited to40m chase range (<20m high); preserve all
  // source triangles in that reachable volume, including ground appendages.
  const collisionRegion = shellCollisionRegion(ctx.collisionExtent ?? Infinity);
  let completed = false;
  try {
  // ---- the shell: resident, one mesh per 128 m cell (the home pack's cells and, with its bytes in, ring 1's)
  const shells = new Map<number, Mesh[]>();
  let triangles = 0;
  // One layout with the near level (makeBlocksMaterial): the shell has no emission and no shared vertices, so every
  // shell cell reads one zero emission attribute and one identity index, sized to the largest cell and cut by its draw
  // range (one CPU array and one GPU buffer each, not one per cell).
  const shellSets: { ring: number; infos: readonly ShellCellInfo[]; bytes: Uint8Array }[] = [{ ring: 0, infos: VD_BLOCKS.shell as readonly ShellCellInfo[], bytes: packs.shell }];
  if (packs.ring1) shellSets.push({ ring: 1, infos: VD_BLOCKS_RING1.shell as readonly ShellCellInfo[], bytes: packs.ring1.shell });
  if (packs.ring2) shellSets.push({ ring: 2, infos: VD_BLOCKS_RING2.shell as readonly ShellCellInfo[], bytes: packs.ring2.shell });
  if (packs.ring3) shellSets.push({ ring: 3, infos: VD_BLOCKS_RING3.shell as readonly ShellCellInfo[], bytes: packs.ring3.shell });
  if (packs.ring4) shellSets.push({ ring: 4, infos: VD_BLOCKS_RING4.shell as readonly ShellCellInfo[], bytes: packs.ring4.shell });
  if (packs.ring5) shellSets.push({ ring: 5, infos: VD_BLOCKS_RING5.shell as readonly ShellCellInfo[], bytes: packs.ring5.shell });
  if (packs.ring6) shellSets.push({ ring: 6, infos: VD_BLOCKS_RING6.shell as readonly ShellCellInfo[], bytes: packs.ring6.shell });
  if (packs.ring7) shellSets.push({ ring: 7, infos: VD_BLOCKS_RING7.shell as readonly ShellCellInfo[], bytes: packs.ring7.shell });
  if (packs.ring8) shellSets.push({ ring: 8, infos: VD_BLOCKS_RING8.shell as readonly ShellCellInfo[], bytes: packs.ring8.shell });
  if (packs.ring9) shellSets.push({ ring: 9, infos: VD_BLOCKS_RING9.shell as readonly ShellCellInfo[], bytes: packs.ring9.shell });
  if (packs.ring10) shellSets.push({ ring: 10, infos: VD_BLOCKS_RING10.shell as readonly ShellCellInfo[], bytes: packs.ring10.shell });
  for (const { ring, infos } of shellSets) packs.shellCollision?.checkSourceSet(ring, infos, collisionRegion);
  const maxShell = Math.max(3, ...shellSets.flatMap((s) => s.infos.map((c) => c.triangles * 3)));
  const shellEmissive = new THREE.BufferAttribute(new Uint8Array(maxShell * 4), 4, true);
  const identity = maxShell > 65535 ? new Uint32Array(maxShell) : new Uint16Array(maxShell);
  for (let i = 0; i < maxShell; i++) identity[i] = i;
  const shellIndex = new THREE.BufferAttribute(identity, 1);
  const shellCount = shellSets.reduce((n, set) => n + set.infos.length, 0);
  let shellsDone = 0;
  let collisionLogAt = -Infinity;
  const collisionLog = (data: Record<string, unknown>) => {
    if (process.env.EXPO_PUBLIC_GAME_PERF === '1' && performance.now() - collisionLogAt >= 500) {
      collisionLogAt = performance.now(); console.info('[NYC-Mon/vd-blocks] collision-build', data);
    }
  };
  for (const { ring, infos, bytes: shellBytes } of shellSets) for (const info of infos) {
    const a = decodeShellCell(shellBytes, info, 'cell-local');
    const bounds = info.bounds;
    const intersectsCollisionRegion = bounds[0]! <= collisionRegion[3] && bounds[3]! >= collisionRegion[0] &&
      bounds[1]! <= collisionRegion[4] && bounds[4]! >= collisionRegion[1] && bounds[2]! <= collisionRegion[5] && bounds[5]! >= collisionRegion[2];
    let collision: import('../../../triangle-collision.ts').TriangleCollision | undefined;
    if (intersectsCollisionRegion) {
      if (packs.shellCollision) {
        const started = performance.now();
        collision = packs.shellCollision.create(THREE, ring, info, collisionRegion);
        if (process.env.EXPO_PUBLIC_GAME_PERF === '1') console.info('[NYC-Mon/vd-blocks] collision-cell', {
          cell: info.key, ring, precomputed: true, inputTriangles: info.triangles, retainedTriangles: collision.triangles,
          bytes: collision.bytes, activeMs: +(performance.now() - started).toFixed(2),
        });
      } else {
        // Generic injected geometry producers can still author the exact tree.
        // Production preload always supplies the paired immutable bank above.
        const work = { phase: 'scan', completed: 0, total: info.triangles, fraction: 0 };
        const collisionSteps = prepareTriangleCollision(THREE, { position: a.position, origin: a.positionFrame!.origin, region: collisionRegion, progress: work });
        const started = performance.now();
        let stepAt = started, next = collisionSteps.next();
        let activeMs = performance.now() - stepAt, maxStepMs = activeMs;
        try {
          while (!next.done) {
            collisionLog({ cell: info.key, ...work, bytes: collisions.bytes, completedCells: shellsDone, totalCells: shellCount,
              activeMs: +activeMs.toFixed(2), elapsedMs: +(performance.now() - started).toFixed(2), maxStepMs: +maxStepMs.toFixed(2) });
            yield (shellsDone + next.value) / (shellCount + 1);
            stepAt = performance.now(); next = collisionSteps.next();
            const ms = performance.now() - stepAt; activeMs += ms; maxStepMs = Math.max(maxStepMs, ms);
          }
          collision = next.value;
          if (process.env.EXPO_PUBLIC_GAME_PERF === '1') console.info('[NYC-Mon/vd-blocks] collision-cell', {
            cell: info.key, inputTriangles: info.triangles, retainedTriangles: collision.triangles, bytes: collision.bytes,
            activeMs: +activeMs.toFixed(2), elapsedMs: +(performance.now() - started).toFixed(2), maxStepMs: +maxStepMs.toFixed(2),
          });
        } finally { if (!next.done) collisionSteps.return(undefined as never); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
    g.setAttribute('color', new THREE.BufferAttribute(a.color, 4, true));
    g.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2));
    g.setAttribute('emissive', shellEmissive);
    g.setIndex(shellIndex);
    g.setDrawRange(0, a.position.length / 3);
    const b = info.bounds, o = a.positionFrame!.origin;
    g.boundingBox = new THREE.Box3(new THREE.Vector3(b[0]! - o[0]!, b[1]! - o[1]!, b[2]! - o[2]!), new THREE.Vector3(b[3]! - o[0]!, b[4]! - o[1]!, b[5]! - o[2]!));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
    const m = new THREE.Mesh(g, shellMat);
    m.name = SHELL_NAME;
    m.position.set(o[0]!, o[1]!, o[2]!);
    m.updateMatrix();
    m.matrixAutoUpdate = false;
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.cell = cellNum(info.cx, info.cz);
    m.userData.vdShell = 1;
    ctx.group.add(m);
    if (collision) collisions.add(collision, { camera: true, body: true }, () => m.visible);
    ctx.register(m, null);
    const num = m.userData.cell as number;
    (shells.get(num) ?? shells.set(num, []).get(num)!).push(m);
    triangles += info.triangles;
    yield ++shellsDone / (shellCount + 1);
  }

  // ---- the near level: a template (one zero-area triangle in the layer's layout) and the lazy cells
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  tg.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(12), 4, true));
  tg.setAttribute('emissive', new THREE.BufferAttribute(new Uint8Array(12), 4, true));
  tg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
  tg.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2]), 1));
  tg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
  tg.userData = { keepCpuArrays: true };
  const template = new THREE.Mesh(tg, nearMat);
  template.name = NEAR_NAME;
  template.matrixAutoUpdate = false;
  template.castShadow = true;
  template.receiveShadow = true;
  ctx.group.add(template);
  // the level the packs hold (load.ts: the preset's)
  const packages = (VD_BLOCKS[packs.level] as readonly NearCellInfo[]).filter((info) => !sourceCells.has(cellNum(info.cx, info.cz))).map((info) => {
    const file = packs.near.get(info.key);
    if (!file) throw new Error(`vd-port: near cell ${info.key} is in the manifest but not in the packs`);
    return sourceNearPackage(info, packs.level, () => Promise.resolve(file!.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer), 'cell-local');
  });
  // Ring 1's cells join the same layer under 'ring1-<level>/<cell>': the home-overlap cells carry a bundled loader,
  // the rest prefetch through the cell source only (a cell that never arrives keeps its far shell).
  if (packs.ring1) {
    for (const info of VD_BLOCKS_RING1[packs.level] as readonly NearCellInfo[]) {
      const file = info.bundled === false ? null : packs.ring1.bundled.get(info.key) ?? null;
      packages.push(sourceNearPackage(
        info, packs.level,
        file ? () => Promise.resolve(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer) : undefined,
        'cell-local', `ring1-${packs.level}/${info.key}`,
      ));
    }
  }
  if (packs.ring2) {
    for (const info of VD_BLOCKS_RING2[packs.level] as readonly NearCellInfo[]) {
      const file = info.bundled === false ? null : packs.ring2.bundled.get(info.key) ?? null;
      packages.push(sourceNearPackage(
        info, packs.level,
        file ? () => Promise.resolve(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer) : undefined,
        'cell-local', `ring2-${packs.level}/${info.key}`,
      ));
    }
  }
  if (packs.ring3) {
    for (const info of VD_BLOCKS_RING3[packs.level] as readonly NearCellInfo[]) {
      const file = info.bundled === false ? null : packs.ring3.bundled.get(info.key) ?? null;
      packages.push(sourceNearPackage(
        info, packs.level,
        file ? () => Promise.resolve(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer) : undefined,
        'cell-local', `ring3-${packs.level}/${info.key}`,
      ));
    }
  }
  if (packs.ring4) {
    for (const info of VD_BLOCKS_RING4[packs.level] as readonly NearCellInfo[]) {
      const file = info.bundled === false ? null : packs.ring4.bundled.get(info.key) ?? null;
      packages.push(sourceNearPackage(
        info, packs.level,
        file ? () => Promise.resolve(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer) : undefined,
        'cell-local', `ring4-${packs.level}/${info.key}`,
      ));
    }
  }
  if (packs.ring5) {
    for (const info of VD_BLOCKS_RING5[packs.level] as readonly NearCellInfo[]) {
      const file = info.bundled === false ? null : packs.ring5.bundled.get(info.key) ?? null;
      packages.push(sourceNearPackage(
        info, packs.level,
        file ? () => Promise.resolve(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer) : undefined,
        'cell-local', `ring5-${packs.level}/${info.key}`,
      ));
    }
  }
  if (packs.ring6) {
    for (const info of VD_BLOCKS_RING6[packs.level] as readonly NearCellInfo[]) {
      const file = info.bundled === false ? null : packs.ring6.bundled.get(info.key) ?? null;
      packages.push(sourceNearPackage(
        info, packs.level,
        file ? () => Promise.resolve(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer) : undefined,
        'cell-local', `ring6-${packs.level}/${info.key}`,
      ));
    }
  }
  if (packs.ring7) {
    for (const info of VD_BLOCKS_RING7[packs.level] as readonly NearCellInfo[]) {
      const file = info.bundled === false ? null : packs.ring7.bundled.get(info.key) ?? null;
      packages.push(sourceNearPackage(
        info, packs.level,
        file ? () => Promise.resolve(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer) : undefined,
        'cell-local', `ring7-${packs.level}/${info.key}`,
      ));
    }
  }
  if (packs.ring8) {
    for (const info of VD_BLOCKS_RING8[packs.level] as readonly NearCellInfo[]) {
      const file = info.bundled === false ? null : packs.ring8.bundled.get(info.key) ?? null;
      packages.push(sourceNearPackage(
        info, packs.level,
        file ? () => Promise.resolve(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer) : undefined,
        'cell-local', `ring8-${packs.level}/${info.key}`,
      ));
    }
  }
  if (packs.ring9) {
    for (const info of VD_BLOCKS_RING9[packs.level] as readonly NearCellInfo[]) {
      const file = info.bundled === false ? null : packs.ring9.bundled.get(info.key) ?? null;
      packages.push(sourceNearPackage(
        info, packs.level,
        file ? () => Promise.resolve(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer) : undefined,
        'cell-local', `ring9-${packs.level}/${info.key}`,
      ));
    }
  }
  if (packs.ring10) {
    for (const info of VD_BLOCKS_RING10[packs.level] as readonly NearCellInfo[]) {
      const file = info.bundled === false ? null : packs.ring10.bundled.get(info.key) ?? null;
      packages.push(sourceNearPackage(
        info, packs.level,
        file ? () => Promise.resolve(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer) : undefined,
        'cell-local', `ring10-${packs.level}/${info.key}`,
      ));
    }
  }
  for (let i = 0; i < packages.length; i++) packages[i] = collisionPackage(THREE, packages[i]!, collisions, collisionRegion);
  const nearBudget = ctx.preset?.vdPort.blocksNear ?? NEAR_BUDGET;
  if(packs.surface){
    const reserve=packs.surface.admission?.legacyMinimum ?? nearBudget;
    // The source reserve must never expand a device's existing legacy quota.
    const quota={...nearBudget,geometryBytes:Math.min(nearBudget.geometryBytes,reserve.geometryBytes),cellDraws:Math.min(nearBudget.cellDraws,reserve.cellDraws),triangles:Math.min(nearBudget.triangles,reserve.triangles)};
    for(const pkg of packages)Object.assign(pkg,{subBudget:quota});
  }
  const sourcePlan = packs.surface ? createSurfaceCohortPlan(packs.surface.cells, packages) : undefined;
  const budget = packs.surface?.budget ?? { name: 'blocks', ...nearBudget };
  // Authored facades stay eligible through the source kit's 120 m near range.
  // Admission still bounds complete cohorts before any page IO.
  const blockLayer = { ...NEAR_LAYER, errorM: nearBudget.errorM, ...(packs.surface ? {reachM:120} : {}) };
  ctx.registerChunks(template, { ...blockLayer, sharedMaterial: true }, packages, budget);

  // A shell cell hides only when every registered near part is attached and fully faded in. It starts
  // on the third update: every shell draws through the START compile and the first frame (behind the near level, by
  // its depth nudge), so each has its colour and shadow render objects from the start and leaving a near cell later
  // builds none.
  const cohorts = createNearCohortMask(() => collisions.changed());
  cohorts.register(NEAR_NAME, packages);
  const sourcePart = packs.surface ? buildSourceSurfacePart(ctx, packs.surface, cohorts,
    blockLayer, sourcePlan, { scene: collisions, region: collisionRegion }) : undefined;
  if (process.env.EXPO_PUBLIC_GAME_PERF === '1') console.info('[NYC-Mon/vd-blocks] collision-built', { bytes: collisions.bytes, triangles: collisions.triangles, cells: shellCount });
  let updates = 0;
  completed = true;
  return {
    ...(sourcePart?.ready ? { ready: sourcePart.ready } : {}),
    get animated() { return sourcePart?.animated === true; },
    ...(sourcePart?.prime ? { prime: sourcePart.prime } : {}),
    ...(sourcePart?.demand ? { demand: sourcePart.demand } : {}),
    update(timeS, reducedMotion) {
      sourcePart?.update?.(timeS, reducedMotion);
      if (++updates <= 2) return;
      const nearIn = cohorts.update(ctx.group.children);
      for (const [num, list] of shells) for (const m of list) {
        const visible = !nearIn.has(num);
        if (m.visible !== visible) { m.visible = visible; collisions.changed(); }
      }
    },
    dispose() {
      collisions.dispose();
      sourcePart?.dispose();
      for (const list of shells.values()) for (const m of list) m.geometry.dispose();
      tg.dispose();
      blocksMat.dispose();
      fw14.dispose();
    },
    stats: { meshes: [...shells.values()].reduce((a, l) => a + l.length, 0) + 1 + (sourcePart?.stats.meshes ?? 0), triangles, structures: VD_BLOCKS.structures.length + VD_BLOCKS_RING1.structures.length },
  };
  } finally {
    if (!completed) {
      collisions.dispose();
      for (const child of [...ctx.group.children]) if (!initialChildren.has(child)) {
        (child as Mesh).geometry?.dispose();
        ctx.group.remove(child);
      }
      blocksMat.dispose();
      fw14.dispose();
    }
  }
}

/** Synchronous builder for worklet/host callers that own their scheduling. */
export function build(ctx: VdPortCtx): VdPortPart {
  const steps = prepare(ctx);
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value;
}
