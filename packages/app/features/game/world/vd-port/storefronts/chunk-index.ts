// Exact storefront chunk metadata baked beside plan.bin. Runtime only merges
// these records; it never tessellates the whole city's 75k fronts to count them.
import { cellNum } from '../../cells/cell-rules.ts';
import { emitPlan, SLOTS, type Slot } from './emit.ts';
import type { Front, StorefrontPlan } from './plan-types.ts';

export const STOREFRONT_CHUNKS = { paint: 256, detail: 128, glass: 256 } as const;
const MAGIC = 0x31495356; // VSI1
const HEADER = 28, FRONT_BYTES = 16, RECORD_BYTES = 36;
export interface FrontChunkRecord { slot: Slot; num: number; triangles: number; bounds: Float64Array }
export interface StorefrontChunkIndex {
  readonly frontCount: number;
  readonly planBytes: number;
  readonly chunks: Readonly<Record<Slot, number>>;
  ground(front: number): number;
  features(front: number): number;
  records(front: number, visit: (record: FrontChunkRecord) => void): void;
}

export function decodeStorefrontChunkIndex(input: Uint8Array | ArrayBuffer): StorefrontChunkIndex {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < HEADER || d.getUint32(0, true) !== MAGIC) throw new Error('vd storefronts: invalid chunk index');
  const frontCount = d.getUint32(4, true), count = d.getUint32(8, true), planBytes = d.getUint32(12, true);
  const recordsAt = HEADER + frontCount * FRONT_BYTES + 4;
  if (recordsAt + count * RECORD_BYTES !== bytes.byteLength) throw new Error('vd storefronts: truncated chunk index');
  const chunks = Object.fromEntries(SLOTS.map((slot, i) => [slot, d.getUint32(16 + i * 4, true)])) as Record<Slot, number>;
  let previous = 0;
  for (let i = 0; i <= frontCount; i++) {
    const end = d.getUint32(HEADER + i * FRONT_BYTES, true);
    if (end < previous || end > count) throw new Error('vd storefronts: invalid front index');
    previous = end;
  }
  if (previous !== count) throw new Error('vd storefronts: incomplete front index');
  return {
    frontCount, planBytes, chunks,
    ground: (front) => d.getFloat64(HEADER + front * FRONT_BYTES + 4, true),
    features: (front) => d.getUint32(HEADER + front * FRONT_BYTES + 12, true),
    records(front, visit) {
      const row = HEADER + front * FRONT_BYTES;
      const start = d.getUint32(row, true), end = d.getUint32(row + FRONT_BYTES, true);
      for (let i = start; i < end; i++) {
        const at = recordsAt + i * RECORD_BYTES;
        const slot = SLOTS[d.getUint32(at, true)];
        if (!slot) throw new Error('vd storefronts: invalid index slot');
        visit({ slot, num: d.getUint32(at + 4, true), triangles: d.getUint32(at + 8, true), bounds: new Float64Array(Array.from({ length: 6 }, (_, j) => d.getFloat32(at + 12 + j * 4, true))) });
      }
    },
  };
}

/** The exact sample emitPlan uses for a front's vertical placement. */
export function storefrontGround(front: Front, groundY: (x: number, z: number) => number): number {
  const mid = front.len / 2;
  return groundY(front.p0[0]! + front.u[0]! * mid + front.n[0]! * 1.2, front.p0[1]! + front.u[1]! * mid + front.n[1]! * 1.2);
}

/** Offline bake only. Batches bound the scratch buffers; no renderer is used. */
export function bakeStorefrontChunkIndex(plan: StorefrontPlan, planBytes: number, groundY: (x: number, z: number) => number): Uint8Array {
  const fronts: { ground: number; features: number; records: FrontChunkRecord[] }[] = [];
  for (let b = 0; b < plan.fronts.length; b += 500) {
    const batch = plan.fronts.slice(b, b + 500);
    const ends: Record<Slot, number>[] = [];
    const result = emitPlan({ ...plan, fronts: batch }, groundY, undefined, (_front, vertices) => ends.push({ ...vertices }), true);
    const counts = new Map<string, number>();
    for (const feature of result.features) counts.set(feature.front, (counts.get(feature.front) ?? 0) + 1);
    const starts = { paint: 0, detail: 0, glass: 0 };
    for (let f = 0; f < batch.length; f++) {
      const records: FrontChunkRecord[] = [];
      for (const slot of SLOTS) {
        const p = result.buffers[slot].position, size = STOREFRONT_CHUNKS[slot], map = new Map<number, FrontChunkRecord>();
        const end = ends[f]![slot];
        for (let a = starts[slot] * 3; a < end * 3; a += 9) {
          if (p[a] === p[a + 3] && p[a] === p[a + 6] && p[a + 1] === p[a + 4] && p[a + 1] === p[a + 7] && p[a + 2] === p[a + 5] && p[a + 2] === p[a + 8]) continue;
          const num = cellNum(Math.floor((p[a]! + p[a + 3]! + p[a + 6]!) / 3 / size), Math.floor((p[a + 2]! + p[a + 5]! + p[a + 8]!) / 3 / size));
          let record = map.get(num);
          if (!record) map.set(num, record = { slot, num, triangles: 0, bounds: new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]) });
          record.triangles++;
          for (let k = a; k < a + 9; k += 3) for (let axis = 0; axis < 3; axis++) {
            record.bounds[axis] = Math.min(record.bounds[axis]!, p[k + axis]!);
            record.bounds[axis + 3] = Math.max(record.bounds[axis + 3]!, p[k + axis]!);
          }
        }
        records.push(...map.values());
        starts[slot] = end;
      }
      fronts.push({ ground: storefrontGround(batch[f]!, groundY), features: counts.get(batch[f]!.id) ?? 0, records });
    }
  }
  const count = fronts.reduce((n, front) => n + front.records.length, 0);
  const recordsAt = HEADER + fronts.length * FRONT_BYTES + 4;
  const bytes = new Uint8Array(recordsAt + count * RECORD_BYTES), d = new DataView(bytes.buffer);
  for (const [offset, value] of [[0, MAGIC], [4, fronts.length], [8, count], [12, planBytes]] as const) d.setUint32(offset, value, true);
  SLOTS.forEach((slot, i) => d.setUint32(16 + i * 4, STOREFRONT_CHUNKS[slot], true));
  let n = 0;
  fronts.forEach((front, i) => {
    const row = HEADER + i * FRONT_BYTES;
    d.setUint32(row, n, true); d.setFloat64(row + 4, front.ground, true); d.setUint32(row + 12, front.features, true);
    for (const record of front.records) {
      const at = recordsAt + n++ * RECORD_BYTES;
      d.setUint32(at, SLOTS.indexOf(record.slot), true); d.setUint32(at + 4, record.num, true); d.setUint32(at + 8, record.triangles, true);
      for (let axis = 0; axis < 6; axis++) d.setFloat32(at + 12 + axis * 4, record.bounds[axis]!, true);
    }
  });
  d.setUint32(HEADER + fronts.length * FRONT_BYTES, n, true);
  return bytes;
}
