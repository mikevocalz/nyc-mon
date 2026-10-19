// The vd lane's model-tree tiers: which placements draw as full models, which
// as the thinned mid level and which as cross-card imposters. The candidate
// list comes from tree-lod.ts (the Caller's near and far sets, already gated
// by its refresh hysteresis); this class only ranks and splits it. Pure and
// allocation-free after construction, so node tests pin it and foliage.ts can
// call it on every refresh.
//
// Why it exists: on the Surface Duo the mid tier's ~900-triangle card trees
// ran out to the 400 m far radius and the overflow drew as 80-triangle crown
// blobs — trees were ~92% of the 1.14M-triangle frame (2026-10-18). Past
// VD_FAR_TREE_RADIUS a tree is a cross of two leaf-atlas quads plus a trunk
// cross (~8 triangles), which holds the species colour and silhouette without
// the card geometry.

import { VD_MID_TREE_CAP, VD_NEAR_TREE_CAP } from './vd-trees-mesh.ts';

/** Metres: past this distance a tree drops from the mid level to a cross-card imposter. */
export const VD_FAR_TREE_RADIUS = 140;
/**
 * At most this many far imposters, nearest first; the rest fall back to the
 * plain far crowns. Sized over the tile's worst 400 m tree density (~1 240
 * trees inside the old far radius around the Apollo).
 */
export const VD_FAR_TREE_CAP = 2048;

/** The sets tree-lod.ts produces around the focus (TreeLod exposes exactly this). */
export interface TreeLodSets {
  readonly near: Int32Array;
  readonly nearCount: number;
  readonly far: Int32Array;
  readonly farCount: number;
}

export interface VdTreeTiersOptions {
  /** Nearest trees that draw as full models. */
  nearCap?: number;
  /** Trees after the near set that draw the mid level — while they stay inside midRadius. */
  midCap?: number;
  /** Mid-level radius in metres; candidates past it go to the far tier even under the cap. */
  midRadius?: number;
  /** Far-imposter cap; the overflow returns `over` for the plain far crowns. */
  farCap?: number;
}

/**
 * Ranks the Caller's candidate trees nearest-first and splits them into the
 * near, mid and far instance lists plus the overflow tail. `update` writes
 * into preallocated buffers and allocates nothing.
 */
export class VdTreeTiers {
  /** Candidate indices, nearest first: the full-model tier. */
  readonly near: Int32Array;
  /** Next candidates inside midRadius: the thinned card tier. */
  readonly mid: Int32Array;
  /** The rest, up to farCap: cross-card imposters. */
  readonly far: Int32Array;
  /** Candidates past the far cap: the plain far crowns. */
  readonly over: Int32Array;
  nearCount = 0;
  midCount = 0;
  farCount = 0;
  overCount = 0;
  private readonly d2: Float32Array;
  private readonly order: Int32Array;
  private readonly xs: Float32Array;
  private readonly zs: Float32Array;
  private readonly nearCap: number;
  private readonly midCap: number;
  private readonly midRadius2: number;
  private readonly farCap: number;

  constructor(xs: Float32Array, zs: Float32Array, options: VdTreeTiersOptions = {}) {
    this.xs = xs;
    this.zs = zs;
    this.nearCap = options.nearCap ?? VD_NEAR_TREE_CAP;
    this.midCap = options.midCap ?? VD_MID_TREE_CAP;
    this.midRadius2 = (options.midRadius ?? VD_FAR_TREE_RADIUS) ** 2;
    this.farCap = options.farCap ?? VD_FAR_TREE_CAP;
    const n = xs.length;
    this.near = new Int32Array(Math.min(n, this.nearCap));
    this.mid = new Int32Array(Math.min(n, this.midCap));
    this.far = new Int32Array(Math.min(n, this.farCap));
    this.over = new Int32Array(n);
    this.d2 = new Float32Array(n);
    this.order = new Int32Array(n);
  }

  /**
   * Rebuild the tiers around (x, z) from the lod sets. Call only when the lod
   * rebuilt — the refresh cadence lives there (TREE_REFRESH_METRES).
   */
  update(x: number, z: number, lod: TreeLodSets): void {
    const { xs, zs, d2, order } = this;
    let n = 0;
    for (let k = 0; k < lod.nearCount; k++) order[n++] = lod.near[k]!;
    for (let k = 0; k < lod.farCount; k++) order[n++] = lod.far[k]!;
    for (let k = 0; k < n; k++) {
      const i = order[k]!;
      d2[i] = (xs[i]! - x) ** 2 + (zs[i]! - z) ** 2;
    }
    order.subarray(0, n).sort((a, b) => d2[a]! - d2[b]! || a - b);
    const near = Math.min(n, this.nearCap);
    // The mid run ends at the mid cap or at the first candidate past the mid
    // radius; the order is sorted, so both boundaries land on the same scan.
    let midEnd = near;
    while (midEnd < n && midEnd - near < this.midCap && d2[order[midEnd]!]! <= this.midRadius2) midEnd++;
    const far = Math.min(n - midEnd, this.farCap);
    this.near.set(order.subarray(0, near));
    this.mid.set(order.subarray(near, midEnd));
    this.far.set(order.subarray(midEnd, midEnd + far));
    this.over.set(order.subarray(midEnd + far, n));
    this.nearCount = near;
    this.midCount = midEnd - near;
    this.farCount = far;
    this.overCount = n - midEnd - far;
  }
}
