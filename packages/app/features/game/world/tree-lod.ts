// Which trees draw as full leaf crowns and which as plain far crowns, around
// a focus point (the Caller). Pure and allocation-free after construction,
// so node tests pin it and the scene can call it every frame.
//
// Why it exists: on the Surface Duo (2026-10-16) every one of the 7 464
// trees drew as a 60-triangle leaf crown plus a 24-triangle trunk, every
// frame: 627 000 of the frame's 857 000 triangles. The GPU was vertex
// bound and presented 14.7 fps while walking, which read as a floor that
// "loads late". Now only the trees near the Caller get leaves and trunks.

/** Leaf crowns and trunks inside this radius of the focus, metres. */
export const NEAR_TREE_RADIUS = 70;
/** At most this many near crowns, nearest first; the rest fall to far crowns. */
export const NEAR_TREE_CAP = 240;
/** Far crowns inside this radius at chase range; it grows with camera distance. */
export const FAR_TREE_RADIUS = 400;
/** The focus has to move this far from the last refresh before the sets are rebuilt. */
export const TREE_REFRESH_METRES = 10;
/** Above this camera distance nobody sees leaves: every tree is a far crown. */
export const TREE_NEAR_LOD_METRES = 450;
/** Above this camera distance all trees hide. */
export const TREE_HIDE_METRES = 1600;

/** Far radius for a camera distance: the chase radius, or enough to cover what an overview sees. */
export function farTreeRadius(cameraDistance: number): number {
  return Math.max(FAR_TREE_RADIUS, cameraDistance * 1.6);
}

export class TreeLod {
  readonly near: Int32Array;
  readonly far: Int32Array;
  nearCount = 0;
  farCount = 0;
  private readonly d2: Float32Array;
  private readonly order: Int32Array;
  private cx = Number.NaN;
  private cz = Number.NaN;
  private radiusKey = -1;
  private readonly byDistance = (a: number, b: number) => this.d2[a]! - this.d2[b]!;

  private readonly xs: Float32Array;
  private readonly zs: Float32Array;

  constructor(xs: Float32Array, zs: Float32Array) {
    this.xs = xs;
    this.zs = zs;
    const n = xs.length;
    this.near = new Int32Array(n);
    this.far = new Int32Array(n);
    this.d2 = new Float32Array(n);
    this.order = new Int32Array(n);
  }

  /**
   * Rebuild the sets when the focus has moved more than TREE_REFRESH_METRES
   * since the last rebuild, or the camera crossed an LOD step. Returns true
   * when it rebuilt.
   */
  update(x: number, z: number, cameraDistance: number): boolean {
    const nearOn = cameraDistance <= TREE_NEAR_LOD_METRES;
    const hidden = cameraDistance > TREE_HIDE_METRES;
    // Far radius in 50 m steps so a slow zoom does not rebuild every frame.
    const farRadius = Math.ceil(farTreeRadius(cameraDistance) / 50) * 50;
    const key = hidden ? 0 : (nearOn ? 1 : 2) * 100_000 + farRadius;
    const moved = Math.hypot(x - this.cx, z - this.cz);
    if (key === this.radiusKey && moved <= TREE_REFRESH_METRES) return false;
    this.cx = x;
    this.cz = z;
    this.radiusKey = key;
    this.pick(x, z, hidden ? 0 : nearOn ? NEAR_TREE_RADIUS : 0, hidden ? 0 : farRadius);
    return true;
  }

  private pick(x: number, z: number, nearRadius: number, farRadius: number): void {
    const { xs, zs, d2, order } = this;
    const near2 = nearRadius * nearRadius;
    const far2 = farRadius * farRadius;
    let candidates = 0;
    let far = 0;
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i]! - x;
      const dz = zs[i]! - z;
      const d = dx * dx + dz * dz;
      d2[i] = d;
      if (d <= near2) order[candidates++] = i;
      else if (d <= far2) this.far[far++] = i;
    }
    // Over the cap: the nearest keep their leaves, the rest become far crowns.
    if (candidates > NEAR_TREE_CAP) order.subarray(0, candidates).sort(this.byDistance);
    const keep = Math.min(candidates, NEAR_TREE_CAP);
    for (let k = 0; k < keep; k++) this.near[k] = order[k]!;
    for (let k = keep; k < candidates; k++) this.far[far++] = order[k]!;
    this.nearCount = keep;
    this.farCount = far;
  }
}

/**
 * Indices of the points within `radius` of (x, z), nearest first, at most
 * `out.length`, written into `out`; returns how many. `scratch` holds the
 * squared distances (same length as xs). No allocation.
 */
export function pickWithin(xs: Float32Array, zs: Float32Array, x: number, z: number, radius: number, out: Int32Array, scratch: Float32Array): number {
  const r2 = radius * radius;
  let n = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i]! - x;
    const dz = zs[i]! - z;
    const d = dx * dx + dz * dz;
    scratch[i] = d;
    if (d > r2) continue;
    // Insertion into the sorted head; `out` is small (tens), so this stays cheap.
    const cap = out.length;
    if (cap === 0) break;
    let k: number;
    if (n === cap) {
      if (scratch[out[cap - 1]!]! <= d) continue;
      k = cap - 1;
    } else {
      k = n++;
    }
    while (k > 0 && scratch[out[k - 1]!]! > d) { out[k] = out[k - 1]!; k--; }
    out[k] = i;
  }
  return n;
}
