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
import { nearCellPreparation, nearCellBytes, nearCellAttributes, type BlockCoordinateFrame, type NearCellInfo, type NearCellResources } from './codec.ts';

export function sourceNearPackage(
  info: NearCellInfo,
  level: 'near' | 'lite',
  bundled?: () => Promise<ArrayBuffer>,
  coordinateFrame: BlockCoordinateFrame = 'absolute',
  /** The cell-source key; defaults to '<level>/<cell>'. Ring cells live under 'ring1-<level>/<cell>'. */
  sourceKey?: string,
  resources?: NearCellResources,
): CellPackage {
  let file: Uint8Array | null = null;
  let pending: Promise<boolean> | null = null;
  let filePending: Promise<boolean> | null = null;
  let resourceEpoch = 0, desiredResources = false;
  const releaseResources = () => {
    desiredResources = false; resourceEpoch++; pending = null;
    resources?.release?.();
  };
  const source = () => {
    if (file) return Promise.resolve(true);
    if (filePending) return filePending;
    const request = vdCellFetch(sourceKey ?? `${level}/${info.key}`, bundled)
      .then(got => { file = got instanceof Uint8Array ? got : got ? new Uint8Array(got) : null; return file !== null; })
      .finally(() => { if (filePending === request) filePending = null; });
    filePending = request;
    return request;
  };
  const decoder = nearCellPreparation(() => {
    if (!file) throw new Error(`vd-port: near cell ${info.key} built before its bytes`);
    return file;
  }, info.cx, info.cz, coordinateFrame, info.surface);
  const get = () => {
    if (resources && !resources.ready()) throw new Error(`vd-port: near cell ${info.key} material resources are not ready`);
    return decoder.get();
  };
  const b = info.bounds;
  return {
    cx: info.cx, cz: info.cz, num: cellNum(info.cx, info.cz), size: CELL,
    positionFrame: coordinateFrame === 'cell-local'
      ? ({ kind: 'cell-local', origin: [info.cx * CELL + CELL / 2, 0, info.cz * CELL + CELL / 2] } as CellLocalPositionFrame)
      : undefined,
    get attributes(): Readonly<Record<string, CellAttribute>> {
      return nearCellAttributes(get());
    },
    get index() { return get().index; },
    vertexCount: info.vertices,
    triangles: info.triangles,
    bounds: Float64Array.from([b[0]!, b[1]!, b[2]!, b[3]!, b[4]!, b[5]!]),
    bytes: nearCellBytes(info),
    prepare: (deadline, now) => (!resources || resources.ready()) && decoder.prepare(deadline, now),
    release: decoder.release,
    releaseResources,
    ready: () => file !== null && (!resources || resources.ready()),
    prefetch(wanted = true) {
      if (!wanted) { releaseResources(); return source(); }
      desiredResources = true;
      if (file && (!resources || resources.ready())) return;
      if (pending) return pending;
      const generation = resourceEpoch;
      const material = resources && !resources.ready() ? Promise.resolve().then(() =>
        desiredResources && generation === resourceEpoch ? resources.prefetch() : false) : Promise.resolve(true);
      const request = Promise.all([source(), material])
        .then(() => desiredResources && generation === resourceEpoch && file !== null && (!resources || resources.ready()))
        .finally(() => { if (pending === request) pending = null; });
      pending = request;
      return request;
    },
  };
}
