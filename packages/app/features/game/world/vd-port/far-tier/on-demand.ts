// The far tier's chunks and landmarks as streamer packages whose bytes come from the cell source (world/cell-source):
// prefetch asks for the file when the package enters the layer's reach plus a ring, ready() flips once verified bytes
// are in (the bundled home copy, the disk cache, or a hash-pinned download), and a file that never arrives stays
// unbuilt — that patch of far city simply draws nothing, never a hole and never a throw.
//
// A fetched CTL1 file decodes into the geometry a chunk draws (codec.ts): its int16 positions keep their 1/4 m (1/8 m
// on the landmarks) quantization on the GPU — the package's cell-local frame carries the chunk's scene-space origin
// and the quantized-to-scene scale, so the built mesh gets the same position=origin + scale matrix the resident mount
// used, under the floating origin's render root like every other cell.
//
// A chunk draws two meshes at two names (the buildings and, on L6, the ground strip): two packages sharing the file's
// fetch state. The landmark silhouettes draw one mesh per registry entry off one shared file, mounted lazily once its
// bytes land.
import type { CellAttribute, CellLocalPositionFrame, CellPackage } from '../../cells/cell-rules.ts';
import { cellNum } from '../../cells/cell-rules.ts';
import { vdCellFetch } from '../../cell-source/index.ts';
import { parseCtl1, type CtlTile } from './codec.ts';
import { vdFarBundled, vdFarBytes } from './load.ts';
import { VD_FAR } from './data/manifest.ts';

type U8 = Uint8Array;
type I16 = Int16Array;
type U32 = Uint32Array;
type F32 = Float32Array;
type SceneMap = (vx: number, vz: number) => [number, number];

/** One CTL1 file's fetch state, shared by every package it decodes into (a chunk's buildings + ground, every landmark). */
interface FarFileState {
  file: U8 | null;
  tile: CtlTile | null;
  pending: boolean;
  /** The fetch in flight (resolves true once the bytes are in), handed back to the streamer by prefetch. */
  fetch: Promise<boolean> | null;
  /** Landmark ground colours/uv are synthesized at decode and kept here between the two reads. */
  aux: Map<string, U8 | Float32Array>;
  /** False: drop the bytes on release (a fetched chunk re-reads from the disk cache). True: keep (the eager set). */
  keep: boolean;
}

const states = new Map<string, FarFileState>();

const stateOf = (key: string): FarFileState => {
  let s = states.get(key);
  if (!s) states.set(key, (s = { file: null, tile: null, pending: false, fetch: null, aux: new Map(), keep: false }));
  return s;
};

/** Bytes already held for a file (the preloaded home subset, or a test's injection via setVdFarBytes). */
const eager = (file: string): U8 | null => {
  const e = vdFarBytes();
  if (!e) return null;
  if (file === VD_FAR.landmarks?.f) return e.landmarks;
  return e.chunks.get(file) ?? null;
};

const ensure = (st: FarFileState, file: string): Promise<boolean> | void => {
  if (st.file) return;
  if (st.pending) return st.fetch ?? undefined;
  const e = eager(file);
  if (e) {
    st.file = e;
    st.keep = true;
    return;
  }
  st.pending = true;
  return (st.fetch = vdCellFetch(`far/${file}`, vdFarBundled(file))
    .then((got) => {
      st.file = got ? (got instanceof Uint8Array ? got : new Uint8Array(got)) : null;
      return st.file !== null;
    })
    .finally(() => {
      st.pending = false;
      st.fetch = null;
    }));
};

const tileOf = (st: FarFileState, file: string): CtlTile => {
  if (!st.file) {
    const e = eager(file);
    if (!e) throw new Error(`vd-port: far file ${file} built before its bytes`);
    st.file = e;
    st.keep = true;
  }
  return (st.tile ??= parseCtl1(st.file));
};

const release = (st: FarFileState): void => {
  st.tile = null;
  st.aux.clear();
  if (!st.keep) st.file = null;
};

const PY = VD_FAR.curb - VD_FAR.padY;

/** The chunk's scene-space box: bounds [x0, z0, x1, z1, y0, y1] in Valdrada metres through the affine. */
const sceneBounds = (b: readonly number[], toScene: SceneMap): Float64Array =>
  Float64Array.from([toScene(b[0]!, 0)[0], PY + b[4]!, toScene(0, b[1]!)[1], toScene(b[2]!, 0)[0], PY + b[5]!, toScene(0, b[3]!)[1]]);

const frameOf = (origin: readonly number[], scale: number, toScene: SceneMap): CellLocalPositionFrame => {
  const [px, pz] = toScene(origin[0]!, origin[1]!);
  const aff = VD_FAR.affine;
  return { kind: 'cell-local', origin: [px, PY, pz], scale: [scale * aff.sx, scale, scale * aff.sz] };
};

interface FarChunkInfo {
  readonly f: string;
  readonly lv: number;
  readonly ci: number;
  readonly cj: number;
  readonly origin: readonly number[];
  readonly scale: number;
  readonly tris: number;
  readonly gtris: number;
  readonly bytes: number;
  readonly bounds: readonly number[];
  readonly nv: number;
  readonly gnv: number;
}

interface FarLandmarkEntry {
  readonly key: string;
  readonly center: readonly number[];
  readonly radius: number;
  readonly l6: { readonly origin: readonly number[]; readonly v0: number; readonly nv: number; readonly i0: number; readonly ni: number; readonly tris: number };
}

const attrs = (
  position: I16, itemVertexCount: number, zeros: U8,
  color: U8, uv: F32, ao: U8 | null,
): Readonly<Record<string, CellAttribute>> => ({
  position: { array: position, itemSize: 3, normalized: false },
  color: { array: color, itemSize: 4, normalized: true },
  uv: { array: uv, itemSize: 2, normalized: false },
  // the shared zero bytes serve `ao` (0 -> sky share 1) and `emissive` (no emission), one CPU array for every far mesh
  ao: { array: ao ?? zeros.subarray(0, itemVertexCount), itemSize: 1, normalized: true },
  emissive: { array: zeros.subarray(0, itemVertexCount * 4), itemSize: 4, normalized: true },
});

const base = (st: FarFileState, file: string): Pick<CellPackage, 'ready' | 'prefetch' | 'release'> => ({
  ready: () => st.file !== null || eager(file) !== null,
  prefetch() {
    if (st.keep) return;
    return ensure(st, file);
  },
  release() {
    release(st);
  },
});

/** A far chunk's buildings (sections pos/col/uv/ao/idx) as a lazy package, quantized int16 kept. */
export function sourceFarChunk(info: FarChunkInfo, toScene: SceneMap, zeros: U8): CellPackage {
  const st = stateOf(info.f);
  const size = info.lv === 6 ? 8192 : 2048;
  return {
    cx: info.ci, cz: info.cj, num: cellNum(info.ci, info.cj) + info.lv, size,
    positionFrame: frameOf(info.origin, info.scale, toScene),
    get attributes() {
      const S = tileOf(st, info.f).S;
      return attrs(S.pos as I16, info.nv, zeros, S.col as U8, S.uv as F32, (S.ao as U8 | undefined) ?? null);
    },
    get index() {
      return tileOf(st, info.f).S.idx as U32;
    },
    vertexCount: info.nv,
    triangles: info.tris,
    bounds: sceneBounds(info.bounds, toScene),
    bytes: info.nv * 23 + info.tris * 12,
    ...base(st, info.f),
  };
}

/** A far chunk's ground strip (gpos/gidx, L6 chunks), colour and uv synthesized from the manifest's ground colour. */
export function sourceFarGround(info: FarChunkInfo, toScene: SceneMap, zeros: U8): CellPackage {
  const st = stateOf(info.f);
  const size = info.lv === 6 ? 8192 : 2048;
  const decoded = (st_: FarFileState) => {
    const S = tileOf(st_, info.f).S;
    let col = st_.aux.get('gcol') as U8 | undefined;
    let uv = st_.aux.get('guv') as F32 | undefined;
    if (!col || !uv) {
      const nv = S.gpos!.length / 3;
      const c = VD_FAR.groundColor;
      const colNew: U8 = new Uint8Array(nv * 4);
      const uvNew = new Float32Array(nv * 2);
      for (let i = 0; i < nv; i++) {
        colNew[i * 4] = c[0]!;
        colNew[i * 4 + 1] = c[1]!;
        colNew[i * 4 + 2] = c[2]!;
        uvNew[i * 2] = 0.06;
        uvNew[i * 2 + 1] = 0.24;
      }
      col = colNew;
      uv = uvNew;
      st_.aux.set('gcol', colNew);
      st_.aux.set('guv', uvNew);
    }
    return { S, col, uv };
  };
  return {
    cx: info.ci, cz: info.cj, num: cellNum(info.ci, info.cj) + info.lv + 10, size,
    positionFrame: frameOf(info.origin, info.scale, toScene),
    get attributes() {
      const { S, col, uv } = decoded(st);
      return attrs(S.gpos as I16, info.gnv, zeros, col, uv, null);
    },
    get index() {
      return tileOf(st, info.f).S.gidx as U32;
    },
    vertexCount: info.gnv,
    triangles: info.gtris,
    bounds: sceneBounds(info.bounds, toScene),
    bytes: info.gnv * 23 + info.gtris * 12,
    ...base(st, info.f),
  };
}

/** One landmark silhouette: its vertex window and index range of the shared landmarks file, mounted lazily. */
export function sourceFarLandmark(entry: FarLandmarkEntry, toScene: SceneMap, zeros: U8): CellPackage {
  const file = VD_FAR.landmarks!.f;
  const st = stateOf(file);
  const it = entry.l6;
  const [cx, cz] = toScene(entry.center[0]!, entry.center[2]!);
  const r = entry.radius * Math.max(VD_FAR.affine.sx, VD_FAR.affine.sz);
  const cy = entry.center[1]! + PY;
  const scale = VD_FAR.landmarks!.scale;
  const aff = VD_FAR.affine;
  const [px, pz] = toScene(it.origin[0]!, it.origin[2]!);
  const [ci, cj] = [Math.floor(it.origin[0]! / 2048), Math.floor(it.origin[2]! / 2048)];
  return {
    cx: ci, cz: cj, num: cellNum(ci, cj) + 60, size: 2048,
    positionFrame: { kind: 'cell-local', origin: [px, it.origin[1]! + PY, pz], scale: [scale * aff.sx, scale, scale * aff.sz] },
    get attributes() {
      const S = tileOf(st, file).S;
      return attrs(
        (S.pos as I16).subarray(it.v0 * 3, (it.v0 + it.nv) * 3), it.nv, zeros,
        (S.col as U8).subarray(it.v0 * 4, (it.v0 + it.nv) * 4),
        (S.uv as F32).subarray(it.v0 * 2, (it.v0 + it.nv) * 2),
        null,
      );
    },
    get index() {
      return (tileOf(st, file).S.idx as U32).subarray(it.i0, it.i0 + it.ni);
    },
    vertexCount: it.nv,
    triangles: it.tris,
    bounds: Float64Array.from([cx - r, cy - r, cz - r, cx + r, cy + r, cz + r]),
    bytes: it.nv * 23 + it.ni * 4,
    ...base(st, file),
  };
}
