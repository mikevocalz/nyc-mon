// Lane B's streamed storefronts (the tile's and the ring districts') as lazy cell packages (cells/cell-rules.ts
// CellPackage), for the streamer.
//
// Lane B used to write every front of the union plan into one mesh per slot and hand it to the streamer, which cut it
// into chunks and kept every chunk's arrays as its CPU store. With ten rings that is ~17 M triangles: several GB of
// Float32Arrays built at once (more while the growing buffers double) and held for the session, past what the iPad
// and the phone have. Here the fronts are written once, a batch at a time, only to count each chunk's triangles,
// bounds and the fronts that reach it; a chunk's arrays are written when the streamer first reads them and dropped
// again on eviction (CellPackage.release).
//
// The packages are the ones splitByCell would cut from the whole mesh: a triangle goes to the chunk of its plan
// centroid, degenerate triangles are dropped, a chunk's triangles keep the plan's order, and the attributes have the
// layout build() gives the resident meshes (position f32 x 3, colour and aBg as unorm8, the rest f32).
import { cellFromNum, cellNum, type CellAttribute, type CellPackage } from '../../cells/cell-rules.ts';
import { emitPlan, EXTRA, SLOTS, type EmitResult, type Slot } from './emit.ts';
import type { Front, StorefrontPlan } from './plan-types.ts';

/** Fronts written together while counting: bounds the counting pass's buffers (about 100 MB for ring 4's fronts). */
const BATCH = 1000;

/** The attribute layout build() gives a slot's mesh, in the order it sets them. */
export function storefrontLayout(slot: Slot): { name: string; itemSize: number; unorm8: boolean }[] {
  return [
    { name: 'position', itemSize: 3, unorm8: false },
    { name: 'color', itemSize: 4, unorm8: true },
    ...Object.entries(EXTRA[slot]).map(([name, itemSize]) => ({ name, itemSize, unorm8: name === 'aBg' })),
  ];
}

interface Chunk {
  num: number;
  triangles: number;
  bounds: Float64Array;
  /** Indices into the ring fronts of the fronts with a triangle here, ascending. */
  fronts: number[];
}

export interface RingStorefronts {
  packages: Record<Slot, CellPackage[]>;
  /** What the fronts place (EmitResult.features), counted while packaging. */
  features: EmitResult['features'];
}

/**
 * Packages `fronts` per slot at `chunk[slot]` metres. `groundY` is the walking surface (ctx.groundY), read as build()
 * reads it.
 */
export function packageRingStorefronts(
  plan: StorefrontPlan, fronts: readonly Front[], groundY: (x: number, z: number) => number, chunk: Readonly<Record<Slot, number>>,
): RingStorefronts {
  const chunks = Object.fromEntries(SLOTS.map((s) => [s, new Map<number, Chunk>()])) as Record<Slot, Map<number, Chunk>>;
  const features: EmitResult['features'] = [];
  const index = new Map<Front, number>(fronts.map((f, i) => [f, i]));
  for (let b = 0; b < fronts.length; b += BATCH) {
    const batch = fronts.slice(b, b + BATCH);
    const ends: { front: number; v: Record<Slot, number> }[] = [];
    const result = emitPlan({ ...plan, fronts: batch }, groundY, undefined, (front, v) => ends.push({ front: index.get(front)!, v: { ...v } }));
    for (const f of result.features) features.push(f);
    for (const slot of SLOTS) {
      const p = result.buffers[slot].position, size = chunk[slot], map = chunks[slot];
      let start = 0;
      for (const { front, v } of ends) {
        const end = v[slot];
        for (let t = start / 3; t < end / 3; t++) {
          const a = t * 9;
          if (p[a] === p[a + 3] && p[a] === p[a + 6] && p[a + 1] === p[a + 4] && p[a + 1] === p[a + 7] && p[a + 2] === p[a + 5] && p[a + 2] === p[a + 8]) continue;
          const num = cellNum(Math.floor((p[a]! + p[a + 3]! + p[a + 6]!) / 3 / size), Math.floor((p[a + 2]! + p[a + 5]! + p[a + 8]!) / 3 / size));
          let c = map.get(num);
          if (!c) map.set(num, (c = { num, triangles: 0, bounds: new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]), fronts: [] }));
          c.triangles++;
          if (c.fronts[c.fronts.length - 1] !== front) c.fronts.push(front);
          const bb = c.bounds;
          for (let k = a; k < a + 9; k += 3) {
            const x = p[k]!, y = p[k + 1]!, z = p[k + 2]!;
            if (x < bb[0]!) bb[0] = x; if (y < bb[1]!) bb[1] = y; if (z < bb[2]!) bb[2] = z;
            if (x > bb[3]!) bb[3] = x; if (y > bb[4]!) bb[4] = y; if (z > bb[5]!) bb[5] = z;
          }
        }
        start = end;
      }
    }
  }
  const packages = {} as Record<Slot, CellPackage[]>;
  for (const slot of SLOTS) {
    const layout = storefrontLayout(slot);
    const bytesPerVertex = layout.reduce((n, a) => n + a.itemSize * (a.unorm8 ? 1 : 4), 0);
    const size = chunk[slot];
    packages[slot] = [...chunks[slot].values()].sort((a, b) => a.num - b.num).map((c) => {
      const [cx, cz] = cellFromNum(c.num);
      let held: Record<string, CellAttribute> | null = null;
      const decode = (): Record<string, CellAttribute> => {
        const sources = c.fronts.map((i) => fronts[i]!);
        const B = emitPlan({ ...plan, fronts: sources }, groundY).buffers[slot];
        const src = layout.map((a) => (a.name === 'position' ? B.position : a.name === 'color' ? B.color : B.extra[a.name]!));
        const out = layout.map((a) => (a.unorm8 ? new Uint8Array(c.triangles * 3 * a.itemSize) : new Float32Array(c.triangles * 3 * a.itemSize)));
        const p = B.position;
        let w = 0;
        for (let t = 0; t < p.length / 9; t++) {
          const a = t * 9;
          if (p[a] === p[a + 3] && p[a] === p[a + 6] && p[a + 1] === p[a + 4] && p[a + 1] === p[a + 7] && p[a + 2] === p[a + 5] && p[a + 2] === p[a + 8]) continue;
          if (cellNum(Math.floor((p[a]! + p[a + 3]! + p[a + 6]!) / 3 / size), Math.floor((p[a + 2]! + p[a + 5]! + p[a + 8]!) / 3 / size)) !== c.num) continue;
          for (let s = 0; s < layout.length; s++) {
            const { itemSize, unorm8, name } = layout[s]!;
            const from = src[s]!, to = out[s]!, n = 3 * itemSize, o = t * n, d = w * n;
            if (!unorm8) (to as Float32Array).set(from.subarray(o, o + n), d);
            // build(): colour clamped to [0, 1] then rounded; aBg rounded as written
            else if (name === 'color') for (let j = 0; j < n; j++) to[d + j] = Math.round(Math.min(1, Math.max(0, from[o + j]!)) * 255);
            else for (let j = 0; j < n; j++) to[d + j] = Math.round(from[o + j]! * 255);
          }
          w++;
        }
        if (w !== c.triangles) throw new Error(`vd storefronts: chunk ${cx},${cz} (${slot}) wrote ${w} of its ${c.triangles} triangles`);
        return Object.fromEntries(layout.map((a, s) => [a.name, { array: out[s]!, itemSize: a.itemSize, normalized: a.unorm8 }]));
      };
      return {
        cx, cz, num: c.num, size,
        get attributes() { return (held ??= decode()); },
        vertexCount: c.triangles * 3,
        bounds: c.bounds,
        bytes: c.triangles * 3 * bytesPerVertex,
        release() { held = null; },
      } satisfies CellPackage;
    });
  }
  return { packages, features };
}
