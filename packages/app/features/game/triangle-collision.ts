import type { Three } from '@acme/ui/three';

export interface CollisionWorkProgress { phase: string; completed: number; total: number; fraction: number }
export interface CollisionTriangleInput {
  progress?: CollisionWorkProgress;
  position: ArrayLike<number>;
  index?: ArrayLike<number> | null;
  origin?: ArrayLike<number>;
  scale?: ArrayLike<number>;
  count?: number;
  /** A coverage filter, never a solid: geometry outside the reachable region is not retained. */
  region?: readonly [number, number, number, number, number, number];
}
export interface TriangleCollision {
  readonly bytes: number;
  readonly triangles: number;
  blocked(x: number, y: number, z: number, radius: number): boolean;
  firstHit(from: readonly number[], to: readonly number[]): { distance: number; triangle: number; point: number[] } | null;
}

/** Exact CPU-only representation shared by the offline writer and live queries. */
export interface TriangleCollisionData {
  readonly positions: Float32Array;
  readonly originals: Uint32Array;
  readonly order: Uint32Array;
  readonly boxes: Float32Array;
  readonly nodes: Int32Array;
  readonly triangles: number;
}

/** Compact scene-space BVH over actual triangles. No render geometry/resources
 * are retained, so uploaded CPU buffers can leave and evicted cells release it. */
export function createTriangleCollision(THREE: Three, input: CollisionTriangleInput): TriangleCollision {
  const steps = prepareTriangleCollision(THREE, input);
  let next = steps.next(); while (!next.done) next = steps.next(); return next.value;
}

export function* prepareTriangleCollision(THREE: Three, input: CollisionTriangleInput): Generator<number, TriangleCollision, void> {
  const data = yield* prepareTriangleCollisionData(THREE, input);
  return createTriangleCollisionFromData(THREE, data);
}

/** Author the same tree offline; runtime geometry producers retain this exact path. */
export function* prepareTriangleCollisionData(THREE: Three, input: CollisionTriangleInput): Generator<number, TriangleCollisionData, void> {
  const source = input.position, sourceIndex = input.index;
  const count = Math.min(input.count ?? sourceIndex?.length ?? source.length / 3, sourceIndex?.length ?? source.length / 3);
  const origin = input.origin ?? [0, 0, 0], scale = input.scale ?? [1, 1, 1];
  const region = input.region ?? [-Infinity, -Infinity, -Infinity, Infinity, Infinity, Infinity];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const triangle = new THREE.Triangle(a, b, c);
  const vertex = (out: typeof a, at: number) => {
    const i = (sourceIndex ? sourceIndex[at]! : at) * 3;
    return out.set(source[i]! * scale[0]! + origin[0]!, source[i + 1]! * scale[1]! + origin[1]!, source[i + 2]! * scale[2]! + origin[2]!);
  };
  const accepted = (at: number) => {
    vertex(a, at); vertex(b, at + 1); vertex(c, at + 2);
    return Math.max(a.x, b.x, c.x) >= region[0] && Math.min(a.x, b.x, c.x) <= region[3] &&
      Math.max(a.y, b.y, c.y) >= region[1] && Math.min(a.y, b.y, c.y) <= region[4] &&
      Math.max(a.z, b.z, c.z) >= region[2] && Math.min(a.z, b.z, c.z) <= region[5] && triangle.getArea() > 1e-8;
  };
  const report = (phase: string, completed: number, total: number, fraction: number) => {
    if (input.progress) { input.progress.phase = phase; input.progress.completed = completed; input.progress.total = total; input.progress.fraction = fraction; }
    return fraction;
  };
  let n = 0;
  for (let at = 0; at + 2 < count; at += 3) { if (accepted(at)) n++; if (at % 6144 === 0) yield report('scan', at / 3, count / 3, count ? 0.2 * at / count : 0.2); }
  yield report('scan', count / 3, count / 3, 0.2);
  const positions = new Float32Array(n * 9), originals = new Uint32Array(n), order = new Uint32Array(n);
  let atTriangle = 0;
  for (let at = 0; at + 2 < count; at += 3) {
    if (at % 6144 === 0) yield report('copy', at / 3, count / 3, 0.2 + (count ? 0.2 * at / count : 0.2));
    if (!accepted(at)) continue;
    const offset = atTriangle * 9;
    a.toArray(positions, offset); b.toArray(positions, offset + 3); c.toArray(positions, offset + 6);
    originals[atTriangle] = at / 3; order[atTriangle] = atTriangle; atTriangle++;
  }
  yield report('copy', count / 3, count / 3, 0.4);
  const capacity = n ? 2 * 2 ** Math.ceil(Math.log2(Math.ceil(n / 12))) - 1 : 0;
  const boxes = new Float32Array(capacity * 6), nodes = new Int32Array(capacity * 4);
  let used = 0;
  const center = (id: number, axis: number) => positions[id * 9 + axis]! + positions[id * 9 + axis + 3]! + positions[id * 9 + axis + 6]!;
  function* select(lo: number, hi: number, middle: number, axis: number): Generator<number, void, void> {
    let work = 0;
    while (lo < hi) {
      const pivot = center(order[(lo + hi) >>> 1]!, axis);
      let i = lo, j = hi;
      while (i <= j) {
        while (center(order[i]!, axis) < pivot) { i++; if (++work % 1024 === 0) yield report('partition', work, 0, 0.4 + 0.6 * buildWork / totalBoundWork); }
        while (center(order[j]!, axis) > pivot) { j--; if (++work % 1024 === 0) yield report('partition', work, 0, 0.4 + 0.6 * buildWork / totalBoundWork); }
        if (++work % 1024 === 0) yield report('partition', work, 0, 0.4 + 0.6 * buildWork / totalBoundWork);
        if (i <= j) { const swap = order[i]!; order[i] = order[j]!; order[j] = swap; i++; j--; }
      }
      if (middle <= j) hi = j; else if (middle >= i) lo = i; else return;
    }
  };
  const counts = new Map<number, number>();
  const visits = (size: number): number => {
    if (size <= 12) return size;
    const old = counts.get(size); if (old !== undefined) return old;
    const half = size >>> 1, value = size + visits(half) + visits(size - half);
    counts.set(size, value); return value;
  };
  const totalBoundWork = Math.max(1, visits(n));
  let buildWork = 0;
  function* build(start: number, end: number): Generator<number, number, void> {
    const node = used++, box = node * 6, record = node * 4;
    boxes.fill(Infinity, box, box + 3); boxes.fill(-Infinity, box + 3, box + 6);
    for (let i = start; i < end; i++) {
    if (++buildWork % 1024 === 0) yield report('bounds', buildWork, totalBoundWork, 0.4 + 0.6 * buildWork / totalBoundWork);
    for (let corner = 0; corner < 3; corner++) for (let axis = 0; axis < 3; axis++) {
      const value = positions[order[i]! * 9 + corner * 3 + axis]!;
      boxes[box + axis] = Math.min(boxes[box + axis]!, value); boxes[box + axis + 3] = Math.max(boxes[box + axis + 3]!, value);
    }
    }
    nodes[record + 2] = start; nodes[record + 3] = end;
    if (end - start <= 12) { nodes[record] = -1; return node; }
    let axis = 0;
    for (let k = 1; k < 3; k++) if (boxes[box + k + 3]! - boxes[box + k]! > boxes[box + axis + 3]! - boxes[box + axis]!) axis = k;
    const middle = (start + end) >>> 1;
    yield* select(start, end - 1, middle, axis);
    nodes[record] = yield* build(start, middle); nodes[record + 1] = yield* build(middle, end);
    return node;
  };
  if (n) yield* build(0, n);
  yield report('complete', n, n, 1);
  return { positions, originals, order, boxes: used * 6 === boxes.length ? boxes : boxes.slice(0, used * 6),
    nodes: used * 4 === nodes.length ? nodes : nodes.slice(0, used * 4), triangles: n };
}

/** A decoded asset owns these arrays for one scene; no render mesh or source buffer is retained. */
export function createTriangleCollisionFromData(THREE: Three, data: TriangleCollisionData): TriangleCollision {
  if (!data.triangles) return { bytes: 0, triangles: 0, blocked: () => false, firstHit: () => null };
  return collisionQueries(THREE, data.positions, data.originals, data.order, data.boxes, data.nodes, data.triangles);
}

function collisionQueries(THREE: Three, positions: Float32Array, originals: Uint32Array, order: Uint32Array,
  boxes: Float32Array, nodes: Int32Array, n: number): TriangleCollision {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3(), nearest = new THREE.Vector3();
  const triangle = new THREE.Triangle(a, b, c);
  const read = (id: number) => { const at = id * 9; a.fromArray(positions, at); b.fromArray(positions, at + 3); c.fromArray(positions, at + 6); };
  const stack = new Int32Array(64);
  // A decoded asset shares one owned buffer across its array views; include
  // the header/alignment bytes it retains without charging that buffer five times.
  const buffers = new Set([positions.buffer, originals.buffer, order.buffer, boxes.buffer, nodes.buffer]);
  let storageBytes = stack.byteLength;
  for (const buffer of buffers) storageBytes += buffer.byteLength;
  const ray = new THREE.Ray(), direction = new THREE.Vector3(), intersection = new THREE.Vector3();
  return {
    bytes: storageBytes,
    triangles: n,
    blocked(x, y, z, radius) {
      if (!n) return false;
      p.set(x, y, z); const r2 = radius * radius;
      let top = 1; stack[0] = 0;
      while (top) {
        const node = stack[--top]!, box = node * 6, record = node * 4;
        if (x + radius < boxes[box]! || x - radius > boxes[box + 3]! || y + radius < boxes[box + 1]! || y - radius > boxes[box + 4]! || z + radius < boxes[box + 2]! || z - radius > boxes[box + 5]!) continue;
        if (nodes[record]! >= 0) { stack[top++] = nodes[record]!; stack[top++] = nodes[record + 1]!; continue; }
        for (let i = nodes[record + 2]!; i < nodes[record + 3]!; i++) {
          read(order[i]!); triangle.closestPointToPoint(p, nearest);
          if (p.distanceToSquared(nearest) <= r2) return true;
        }
      }
      return false;
    },
    firstHit(from, to) {
      ray.origin.fromArray(from); direction.fromArray(to).sub(ray.origin);
      const length = direction.length(); ray.direction.copy(direction).normalize();
      let distance = length + 1, hit = -1;
      // Diagnostics/tests only; the hot path above traverses the spatial BVH.
      for (let id = 0; id < n; id++) { read(id); if (ray.intersectTriangle(a, b, c, false, intersection)) {
        const d = ray.origin.distanceTo(intersection);
        if (d <= length && d < distance) { distance = d; hit = id; nearest.copy(intersection); }
      } }
      return hit < 0 ? null : { distance, triangle: originals[hit]!, point: nearest.toArray() };
    },
  };
}
