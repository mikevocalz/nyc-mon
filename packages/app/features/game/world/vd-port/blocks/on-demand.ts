// A near/lite block cell as a streamer package whose bytes come from the on-demand cell source
// (world/cell-source): prefetch asks for the cell when the streamer enters its reach plus a ring, ready() flips
// once verified bytes are in (bundled, disk cache, or a hash-pinned download), and a cell that never arrives
// stays unbuilt so the far shell keeps drawing instead of the layer throwing.
//
// Integration hook for the lane owner: blocks/index.ts builds its packages as
//   (VD_BLOCKS[packs.level] as readonly NearCellInfo[]).map((info) => lazyNearPackage(info, () => file))
// over eagerly preloaded packs (blocks/load.ts). To stream them on demand instead, map to
//   sourceNearPackage(info, packs.level, () => fetchAssetBytes(assetFor(info.key)))
// and let load.ts skip the near/lite packs when the source is configured (the shell stays eagerly bundled).
import type { CellAttribute, CellLocalPositionFrame, CellPackage } from '../../cells/cell-rules.ts';
import { cellNum, CELL } from '../../cells/cell-rules.ts';
import { vdCellFetch } from '../../cell-source/index.ts';
import { decodeNearCell, nearCellBytes, type BlockCoordinateFrame, type NearArrays, type NearCellInfo } from './codec.ts';

export function sourceNearPackage(
  info: NearCellInfo,
  level: 'near' | 'lite',
  bundled?: () => Promise<ArrayBuffer>,
  coordinateFrame: BlockCoordinateFrame = 'absolute',
  /** The cell-source key; defaults to '<level>/<cell>'. Ring cells live under 'ring1-<level>/<cell>'. */
  sourceKey?: string,
): CellPackage {
  let file: Uint8Array | null = null;
  let arrays: NearArrays | null = null;
  let pending: Promise<boolean> | null = null;
  const get = () => {
    if (!file) throw new Error(`vd-port: near cell ${info.key} built before its bytes`);
    return (arrays ??= decodeNearCell(file, info.cx, info.cz, coordinateFrame));
  };
  const b = info.bounds;
  return {
    cx: info.cx, cz: info.cz, num: cellNum(info.cx, info.cz), size: CELL,
    positionFrame: coordinateFrame === 'cell-local'
      ? ({ kind: 'cell-local', origin: [info.cx * CELL + CELL / 2, 0, info.cz * CELL + CELL / 2] } as CellLocalPositionFrame)
      : undefined,
    get attributes(): Readonly<Record<string, CellAttribute>> {
      const a = get();
      return {
        position: { array: a.position, itemSize: 3, normalized: false },
        color: { array: a.color, itemSize: 4, normalized: true },
        emissive: { array: a.emissive, itemSize: 4, normalized: true },
        uv: { array: new Float32Array(a.position.length / 3 * 2), itemSize: 2, normalized: false },
      };
    },
    get index() { return get().index; },
    vertexCount: info.vertices,
    triangles: info.triangles,
    bounds: Float64Array.from([b[0]!, b[1]!, b[2]!, b[3]!, b[4]!, b[5]!]),
    bytes: nearCellBytes(info),
    release() { arrays = null; },
    ready: () => file !== null,
    prefetch() {
      if (file) return;
      if (pending) return pending;
      return (pending = vdCellFetch(sourceKey ?? `${level}/${info.key}`, bundled)
        .then((got) => { file = got instanceof Uint8Array ? got : got ? new Uint8Array(got) : null; return file !== null; })
        .finally(() => { pending = null; }));
    },
  };
}
