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

/** Non-indexed triangles with position, normal, colour and uv, grown in chunks. */
export class VertexBuffer {
  positions: number[] = [];
  normals: number[] = [];
  colors: number[] = [];
  uvs: number[] = [];

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, rgb: readonly number[], u = 0, v = 0): void {
    this.positions.push(x, y, z);
    this.normals.push(nx, ny, nz);
    this.colors.push(rgb[0]!, rgb[1]!, rgb[2]!);
    this.uvs.push(u, v);
  }

  /** Quad a-b-c-d (counter-clockwise seen from the normal side) as two triangles. */
  quad(
    a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[],
    n: readonly number[], rgb: readonly number[], uv?: readonly (readonly number[])[],
  ): void {
    const corners = [a, b, c, a, c, d];
    const uvOrder = uv ? [uv[0]!, uv[1]!, uv[2]!, uv[0]!, uv[2]!, uv[3]!] : null;
    corners.forEach((p, k) => this.vertex(p[0]!, p[1]!, p[2]!, n[0]!, n[1]!, n[2]!, rgb, uvOrder?.[k]?.[0] ?? 0, uvOrder?.[k]?.[1] ?? 0));
  }

  toGeometry(THREE: Three): BufferGeometry {
    const geometry: BufferGeometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.computeBoundingSphere();
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
