// The gen lane (Phase 3 slice 1): seeded procedural buildings riding the Valdrada cell stack.
// Zero disk — a cell's package holds only its spec; `prefetch` runs the emission
// (buildings.ts, pure) when the streamer enters the reach plus a ring, `release` drops the
// arrays on eviction, and a regenerated cell is byte-identical to the one that left.
//
// Content draws through lane A's blocks material (makeBlocksMaterial) on the near branch —
// no `vdShell` marker — so generated massing gets the same facet-normal lighting, sky mirror,
// sun disc and night handling as the record buildings, with its dim per-use emission standing
// in for the real windows the infill does not have. The fw14 texture stays out (the shell's
// window grid is far-tier business): a material with `null` multiplies by white, which is one
// fewer texture bind per frame for content that never takes the shell branch anyway.
//
// Streaming: a mid/near fill layer. reachM 320 sits between the blocks' near reach (60–120 m,
// the lite/near level) and the far tier's 13 km macro — inside the ipad/phone resident radius
// (360 m) so a cell the layer wants is always admissible, and fixed across presets so the
// vdPort.gen budget rows mean the same thing everywhere. Fades with the dither, never pinned
// (generated detail around a landmark evicts like the rest).
//
// Flag: EXPO_PUBLIC_WORLD_GEN, opt-in (the parseSkyRigFlag truthy set). Off, the parts list
// — and the render — is byte-identical to before the lane existed.
//
// Deferred to later slices: the district authority (real parcelization — interior lots sit on
// a fixed 38 m grid today and only approximate blocks), area massing past school/pitch, the
// VGC1 kind producers (colliders/pednet/spawns/labels read the spec's use tags, not written
// yet), and any look-verification on device.
import type { Three } from '@acme/ui/three';
import type { CityDatasetV3 } from '../../city-dataset.ts';
import { EMPTY_PART, type VdPortCtx, type VdPortPart, type VdStreamLayer } from '../vd-port/types.ts';
import { CELL, type CellAttribute, type CellLocalPositionFrame, type CellPackage } from '../cells/cell-rules.ts';
import { ditherFadeMask } from '../cells/cell-stream.ts';
import { makeBlocksMaterial } from '../vd-port/blocks/shell-material.ts';
import type { NearArrays } from '../vd-port/blocks/codec.ts';
import { parseSkyRigFlag } from '../sky-rig.ts';
import { WORLD_PRESETS } from '../../perf/tier-presets.ts';
import { buildGenIndex, genSpecForCell, type GenDataset, type GenSpec } from './spec.ts';
import { emitGenCell, genCellBounds, genCellBoxes, GEN_TRIS_PER_BOX, GEN_VERTS_PER_BOX } from './buildings.ts';

type Mesh = InstanceType<Three['Mesh']>;

/** Opt-in lane flag — default OFF, matching the other experimental world lanes. `EXPO_PUBLIC_WORLD_GEN=1`. */
export const EXPERIMENTAL_WORLD_GEN = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_GEN);

/** The layer's mesh name (the streamer names its cells after the template). */
export const GEN_NAME = 'city:vd-gen';

/**
 * The layer's fixed reach, metres. Inside the ipad/phone residentRadiusM (360), so every cell
 * the layer wants is admissible; fixed across presets so the want set — and the vdPort.gen
 * budget — is the same on every device class.
 */
export const GEN_REACH_M = 320;

/** The gen layer's own budget on the ipad-a12x row (perf/tier-presets.ts vdPort.gen); the ctx's preset wins. */
export const GEN_BUDGET = WORLD_PRESETS['ipad-a12x'].vdPort.gen;

/**
 * A gen cell as a streamer package: the spec is computed at registration (cheap: a handful of
 * rects, the package's counts and bounds come from the massing boxes, not the arrays), and the
 * arrays exist only between `prefetch` and `release`. Same contract as sourceNearPackage, with
 * the generation itself standing in for the fetch — `ready` flips the moment it runs, and the
 * resolved promise is the land-report that wakes the streamer for a fresh pick.
 */
export function genCellPackage(spec: GenSpec, groundY: (x: number, z: number) => number): CellPackage | null {
  const boxes = genCellBoxes(spec, groundY);
  if (boxes.length === 0) return null;
  const vertexCount = boxes.length * GEN_VERTS_PER_BOX;
  const triangles = boxes.length * GEN_TRIS_PER_BOX;
  let arrays: NearArrays | null = null;
  const get = () => (arrays ??= emitGenCell(spec, boxes));
  return {
    cx: spec.cx,
    cz: spec.cz,
    num: spec.num,
    size: CELL,
    positionFrame: {
      kind: 'cell-local',
      origin: [spec.cx * CELL + CELL / 2, 0, spec.cz * CELL + CELL / 2],
    } as CellLocalPositionFrame,
    get attributes(): Readonly<Record<string, CellAttribute>> {
      const a = get();
      return {
        position: { array: a.position, itemSize: 3, normalized: false },
        color: { array: a.color, itemSize: 4, normalized: true },
        emissive: { array: a.emissive, itemSize: 4, normalized: true },
        // the FW14 uv slot: unused on the near branch (blocks material), present to share its layout
        uv: { array: new Float32Array((a.position.length / 3) * 2), itemSize: 2, normalized: false },
      };
    },
    get index() {
      return get().index;
    },
    vertexCount,
    triangles,
    bounds: genCellBounds(boxes),
    // the near cell byte convention (blocks codec nearCellBytes): 28 B a vertex, u16 index
    bytes: vertexCount * 28 + triangles * 3 * 2,
    release() {
      arrays = null;
    },
    ready: () => arrays !== null,
    prefetch() {
      if (arrays) return;
      get();
      return Promise.resolve(true);
    },
  };
}

/** The layer's stream spec. `errorM` is the required vestige — reachM overrides it both ways (cell-stream.ts wanted/reachOf). */
export const GEN_LAYER: VdStreamLayer = { errorM: 0.48, chunk: CELL, fade: true, pin: false, reachM: GEN_REACH_M, sharedMaterial: true };

/**
 * The lane's packages: every 128 m cell intersecting the tile's square, specced once against
 * the bucketed keep-out geometry (spec.ts buildGenIndex) and packaged only where the spec left
 * massing. Specs are eager — a package's vertexCount/bytes/bounds must exist before it ever
 * prefetches — and the per-cell work is a few dozen rect tests, well under the frame's stream
 * budget; the arrays stay lazy.
 */
export function genCellPackages(dataset: GenDataset & { readonly extentMeters: number }, groundY: (x: number, z: number) => number, inside: (x: number, z: number) => boolean): CellPackage[] {
  const index = buildGenIndex(dataset);
  const half = dataset.extentMeters;
  const packages: CellPackage[] = [];
  for (let cx = Math.floor(-half / CELL); cx <= Math.floor(half / CELL); cx++) {
    for (let cz = Math.floor(-half / CELL); cz <= Math.floor(half / CELL); cz++) {
      const spec = genSpecForCell(cx, cz, { index, inside });
      if (spec.lots.length === 0) continue;
      const pkg = genCellPackage(spec, groundY);
      if (pkg) packages.push(pkg);
    }
  }
  return packages;
}

export function buildGen(ctx: VdPortCtx, dataset: CityDatasetV3): VdPortPart {
  // A streaming layer: a whole-built world has no streamer to feed, so the lane does nothing
  // there rather than registering packages nobody reads.
  if (!ctx.preset) return EMPTY_PART;
  const { THREE } = ctx;
  const mat = makeBlocksMaterial(THREE, ctx.env, null);
  // The fade rides the layer's own mask (sharedMaterial: the streamer adds no second one).
  (mat as unknown as { maskNode: unknown }).maskNode = ditherFadeMask(THREE);

  // The template: one zero-area triangle in the near layout, drawn by the START compile so a
  // streamed gen cell never compiles a pipeline.
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  tg.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(12), 4, true));
  tg.setAttribute('emissive', new THREE.BufferAttribute(new Uint8Array(12), 4, true));
  tg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
  tg.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2]), 1));
  tg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
  tg.userData = { keepCpuArrays: true };
  const template: Mesh = new THREE.Mesh(tg, mat);
  template.name = GEN_NAME;
  template.matrixAutoUpdate = false;
  template.castShadow = true;
  template.receiveShadow = true;
  ctx.group.add(template);

  const packages = genCellPackages(dataset, ctx.groundY, ctx.inBounds);
  const budget = ctx.preset.vdPort.gen ?? GEN_BUDGET;
  ctx.registerChunks(template, GEN_LAYER, packages, { name: 'gen', ...budget });

  return {
    dispose() {
      tg.dispose();
      mat.dispose();
    },
    stats: { meshes: 1, triangles: 0, structures: packages.length },
  };
}
