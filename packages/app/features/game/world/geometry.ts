// Geometry helpers for the baked city: a growable vertex buffer that ends as
// one BufferGeometry per material (the "merge by material" idea from
// vg-demos-all src/demos/metro-live/world/geometry.ts, MIT, built up front
// instead of merging per-feature meshes afterwards), polyline ribbons with
// mitred joins, ring helpers and a seeded PRNG (mulberry32, ported from the
// same file).
//
// MIT notice for the ported parts: Copyright (c) 2015-present 650 Industries,
// Inc. (aka Expo). Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software, subject to the MIT License text in
// docs/implementation/city-world.md.
import type { Three } from '@acme/ui/three';
import type { BufferGeometry } from 'three/webgpu';
import type { FlatPoints } from '../city-dataset.ts';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 0..1 hash of a string id, for per-building variation. */
export function hashUnit(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * Non-indexed triangles with position, normal, colour and uv, in typed
 * arrays that double as they fill. The city writes about a million
 * vertices at scene build; `number[]` pushes and the copy into
 * Float32BufferAttribute were most of the build time (and on Hermes, which
 * has no JIT, far more), so this writes floats in place and hands three
 * one exact-length copy. Bounds are tracked as it goes, so toGeometry sets
 * the bounding sphere without another pass.
 */
export class VertexBuffer {
  private pos: Float32Array;
  private nor: Float32Array;
  private col: Float32Array;
  private tex: Float32Array;
  private count = 0;

  /** `capacity` in vertices: the big city buffers pass a size near their final one to skip regrowth. */
  constructor(capacity = 1024) {
    const n = Math.max(16, capacity);
    this.pos = new Float32Array(3 * n);
    this.nor = new Float32Array(3 * n);
    this.col = new Float32Array(3 * n);
    this.tex = new Float32Array(2 * n);
  }
  private minX = Infinity; private minY = Infinity; private minZ = Infinity;
  private maxX = -Infinity; private maxY = -Infinity; private maxZ = -Infinity;

  get vertexCount(): number {
    return this.count;
  }

  /** Views of the written floats (tests and inspection; do not keep across writes). */
  get positions(): Float32Array { return this.pos.subarray(0, this.count * 3); }
  get normals(): Float32Array { return this.nor.subarray(0, this.count * 3); }
  get colors(): Float32Array { return this.col.subarray(0, this.count * 3); }
  get uvs(): Float32Array { return this.tex.subarray(0, this.count * 2); }

  private grow(): void {
    const next = (a: Float32Array) => { const b = new Float32Array(a.length * 2); b.set(a); return b; };
    this.pos = next(this.pos); this.nor = next(this.nor); this.col = next(this.col); this.tex = next(this.tex);
  }

  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, rgb: readonly number[], u = 0, v = 0): void {
    if ((this.count + 1) * 3 > this.pos.length) this.grow();
    const i = this.count * 3;
    const p = this.pos; const n = this.nor; const c = this.col;
    p[i] = x; p[i + 1] = y; p[i + 2] = z;
    n[i] = nx; n[i + 1] = ny; n[i + 2] = nz;
    c[i] = rgb[0]!; c[i + 1] = rgb[1]!; c[i + 2] = rgb[2]!;
    const t = this.count * 2;
    this.tex[t] = u; this.tex[t + 1] = v;
    this.count++;
    if (x < this.minX) this.minX = x; if (x > this.maxX) this.maxX = x;
    if (y < this.minY) this.minY = y; if (y > this.maxY) this.maxY = y;
    if (z < this.minZ) this.minZ = z; if (z > this.maxZ) this.maxZ = z;
  }

  /** Quad a-b-c-d (counter-clockwise seen from the normal side) as two triangles. */
  quad(
    a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[],
    n: readonly number[], rgb: readonly number[], uv?: readonly (readonly number[])[],
  ): void {
    const nx = n[0]!; const ny = n[1]!; const nz = n[2]!;
    const ua = uv?.[0]; const ub = uv?.[1]; const uc = uv?.[2]; const ud = uv?.[3];
    this.vertex(a[0]!, a[1]!, a[2]!, nx, ny, nz, rgb, ua?.[0] ?? 0, ua?.[1] ?? 0);
    this.vertex(b[0]!, b[1]!, b[2]!, nx, ny, nz, rgb, ub?.[0] ?? 0, ub?.[1] ?? 0);
    this.vertex(c[0]!, c[1]!, c[2]!, nx, ny, nz, rgb, uc?.[0] ?? 0, uc?.[1] ?? 0);
    this.vertex(a[0]!, a[1]!, a[2]!, nx, ny, nz, rgb, ua?.[0] ?? 0, ua?.[1] ?? 0);
    this.vertex(c[0]!, c[1]!, c[2]!, nx, ny, nz, rgb, uc?.[0] ?? 0, uc?.[1] ?? 0);
    this.vertex(d[0]!, d[1]!, d[2]!, nx, ny, nz, rgb, ud?.[0] ?? 0, ud?.[1] ?? 0);
  }

  toGeometry(THREE: Three): BufferGeometry {
    const geometry: BufferGeometry = new THREE.BufferGeometry();
    const n = this.count;
    geometry.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(0, n * 3), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(this.nor.slice(0, n * 3), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.col.slice(0, n * 3), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(this.tex.slice(0, n * 2), 2));
    if (n > 0) {
      // The box's circumsphere: a little larger than three's fit, and no extra pass over the vertices.
      const centre = new THREE.Vector3((this.minX + this.maxX) / 2, (this.minY + this.maxY) / 2, (this.minZ + this.maxZ) / 2);
      const radius = Math.hypot(this.maxX - this.minX, this.maxY - this.minY, this.maxZ - this.minZ) / 2;
      geometry.boundingSphere = new THREE.Sphere(centre, radius);
    } else {
      geometry.computeBoundingSphere();
    }
    return geometry;
  }
}

/** Flat [x, z, ...] to point pairs. */
export function pairs(points: FlatPoints): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < points.length; i += 2) out.push([points[i]!, points[i + 1]!]);
  return out;
}

/**
 * Signed area in map orientation (x east, y north = -z). Positive means the
 * ring runs counter-clockwise on a north-up map.
 */
export function mapArea(ring: readonly (readonly [number, number])[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i]!;
    const [x2, z2] = ring[(i + 1) % ring.length]!;
    sum += x1 * -z2 - x2 * -z1;
  }
  return sum / 2;
}

/** The ring counter-clockwise on a north-up map (outward normal = right of travel, in map space). */
export function counterClockwise(ring: [number, number][]): [number, number][] {
  return mapArea(ring) >= 0 ? ring : [...ring].reverse();
}

export function pointInRing(x: number, z: number, ring: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i]!;
    const [xj, zj] = ring[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function ringCentroid(ring: readonly (readonly [number, number])[]): [number, number] {
  let x = 0;
  let z = 0;
  for (const [px, pz] of ring) { x += px; z += pz; }
  return [x / ring.length, z / ring.length];
}

/** Squared distance from (x, z) to segment a-b. */
export function segmentDistanceSq(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len = dx * dx + dz * dz;
  const t = len > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len)) : 0;
  const px = ax + dx * t - x;
  const pz = az + dz * t - z;
  return px * px + pz * pz;
}

/**
 * Left/right offsets of a polyline with mitred joins (miter capped at 2x
 * the half-width so hairpins do not spike). `v` is the running length, for
 * dashes along the road.
 */
export function ribbon(points: readonly (readonly [number, number])[], half: number): { left: [number, number][]; right: [number, number][]; v: number[] } {
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  const v: number[] = [];
  let run = 0;
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i]!;
    const prev = points[i - 1];
    const next = points[i + 1];
    if (prev) run += Math.hypot(x - prev[0], z - prev[1]);
    // Direction of the incoming and outgoing segments.
    const dIn = prev ? norm(x - prev[0], z - prev[1]) : null;
    const dOut = next ? norm(next[0] - x, next[1] - z) : null;
    const d = dIn && dOut ? norm(dIn[0] + dOut[0], dIn[1] + dOut[1]) ?? dOut : (dIn ?? dOut ?? [1, 0]);
    // Left of travel in scene space (x east, z south) is (dz, -dx).
    let nx = d[1];
    let nz = -d[0];
    let scale = half;
    if (dIn && dOut) {
      const cos = Math.max(0.5, nx * dIn[1] + nz * -dIn[0]);
      scale = half / cos;
    }
    if (!Number.isFinite(nx) || !Number.isFinite(nz)) { nx = 0; nz = 0; }
    left.push([x + nx * scale, z + nz * scale]);
    right.push([x - nx * scale, z - nz * scale]);
    v.push(run);
  }
  return { left, right, v };
}

function norm(x: number, z: number): [number, number] | null {
  const length = Math.hypot(x, z);
  return length > 1e-9 ? [x / length, z / length] : null;
}
