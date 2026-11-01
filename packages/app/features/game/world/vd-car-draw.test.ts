// Every baked body at every detail level, drawn the way the city draws it:
// a Mesh over vdInstancedGeometry (vd-instanced.ts) with the parked-car
// material (car-materials.ts, vdXform positionNode) and the fleet material
// (living-city/vd-car-material.ts), rendered by three's WebGPURenderer on the
// capture device. The test then reads back what each draw would fetch (the
// index buffer, the vertex buffers through the pipeline's own layout) and
// checks the triangles the GPU would rasterise:
//
// - every index is under the vertex count of the buffer it indexes;
// - no triangle, after the instance transform, has an edge longer than the
//   body's bounding diagonal (an index list over the wrong vertices, or a
//   wrong stride or offset, throws triangles across the street);
// - every triangle is wound the way its vertex normals face, so front-face
//   culling never opens a hole in a panel;
// - seen from outside along the five open axes, the first surface a ray meets
//   inside the body's outline is a front face: no see-through panels and no
//   inside-out shards. The old bake's LOD2 cab failed this on 35 % of its
//   rays at full detail and its far Lincoln on 44 %. The clustered levels
//   keep small gaps (a few % mid, under a fifth far), so both vd car
//   materials draw double-sided and a gap shows the panel behind it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { captureGpuDevice, drawIndices, fetchAttribute, installGpuGlobals, recordingCanvas, type CapturedDraw } from '../render-runtime/capture-gpu.test-support.ts';
import { createVdCarMaterial } from '../living-city/vd-car-material.ts';
import { createCarPbrMaterial } from './car-materials.ts';
import { TONE_ATTRIBUTE } from './materials.ts';
import { decodeVdCar, VD_CAR_IDS, VD_LODS, vdCarLodGeometries, vdParkedCarLodGeometries, type VdCarData } from './vd-car-mesh.ts';
import { VD_XFORM_ATTRIBUTE, vdInstancedGeometry, writeVdXform } from './vd-instanced.ts';

/** Share of outside rays inside a body's outline allowed to meet a back face first, per level. */
export const BACK_FACE_SHARE = { near: 0.04, mid: 0.15, far: 0.2 } as const;

/**
 * Rays from outside along +-x, +-z and -y on a grid over the body's outline: the share whose first hit is a back
 * face (or that pass through a gap and hit the far side's inside). Positions and indices as decoded (car frame).
 */
export function backFaceShare(positions: Float32Array, normals: Float32Array, index: ArrayLike<number>): number {
  const lo = [Infinity, Infinity, Infinity]; const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < index.length; i++) for (let c = 0; c < 3; c++) {
    const x = positions[index[i]! * 3 + c]!;
    lo[c] = Math.min(lo[c]!, x); hi[c] = Math.max(hi[c]!, x);
  }
  let rays = 0; let back = 0;
  const axes: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]];
  const STEPS = 18;
  for (const dir of axes) {
    const along = dir.findIndex((d) => d !== 0);
    const [u, w] = [0, 1, 2].filter((c) => c !== along) as [number, number];
    for (let i = 1; i < STEPS; i++) for (let j = 1; j < STEPS; j++) {
      const o = [0, 0, 0];
      o[u] = lo[u]! + ((hi[u]! - lo[u]!) * i) / STEPS;
      o[w] = lo[w]! + ((hi[w]! - lo[w]!) * j) / STEPS;
      o[along] = dir[along]! > 0 ? lo[along]! - 1 : hi[along]! + 1;
      let best = Infinity; let facing = 0;
      for (let t = 0; t < index.length; t += 3) {
        const a = index[t]! * 3; const b = index[t + 1]! * 3; const c = index[t + 2]! * 3;
        const e1 = [positions[b]! - positions[a]!, positions[b + 1]! - positions[a + 1]!, positions[b + 2]! - positions[a + 2]!];
        const e2 = [positions[c]! - positions[a]!, positions[c + 1]! - positions[a + 1]!, positions[c + 2]! - positions[a + 2]!];
        const p = [dir[1] * e2[2]! - dir[2] * e2[1]!, dir[2] * e2[0]! - dir[0] * e2[2]!, dir[0] * e2[1]! - dir[1] * e2[0]!];
        const det = e1[0]! * p[0]! + e1[1]! * p[1]! + e1[2]! * p[2]!;
        if (Math.abs(det) < 1e-12) continue;
        const s = [o[0]! - positions[a]!, o[1]! - positions[a + 1]!, o[2]! - positions[a + 2]!];
        const bu = (s[0]! * p[0]! + s[1]! * p[1]! + s[2]! * p[2]!) / det;
        if (bu < 0 || bu > 1) continue;
        const q = [s[1]! * e1[2]! - s[2]! * e1[1]!, s[2]! * e1[0]! - s[0]! * e1[2]!, s[0]! * e1[1]! - s[1]! * e1[0]!];
        const bv = (dir[0] * q[0]! + dir[1] * q[1]! + dir[2] * q[2]!) / det;
        if (bv < 0 || bu + bv > 1) continue;
        const dist = (e2[0]! * q[0]! + e2[1]! * q[1]! + e2[2]! * q[2]!) / det;
        if (dist <= 0 || dist >= best) continue;
        best = dist;
        // Front face: counter-clockwise toward the viewer, the geometric normal against the ray.
        const gx = e1[1]! * e2[2]! - e1[2]! * e2[1]!; const gy = e1[2]! * e2[0]! - e1[0]! * e2[2]!; const gz = e1[0]! * e2[1]! - e1[1]! * e2[0]!;
        facing = gx * dir[0] + gy * dir[1] + gz * dir[2] < 0 ? 1 : -1;
      }
      if (best === Infinity) continue; // outside the outline
      rays++;
      if (facing < 0) back++;
    }
  }
  void normals;
  return rays === 0 ? 0 : back / rays;
}

interface Expect { readonly data: VdCarData; readonly lod: (typeof VD_LODS)[number]; readonly kind: string; readonly instances: number }

async function drawAll(): Promise<{ draws: CapturedDraw[]; expected: Map<number, Expect> }> {
  installGpuGlobals();
  const { device, draws } = captureGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(64, 64), device } as never);
  await renderer.init();
  renderer.shadowMap.enabled = false;
  const scene = new THREE.Scene();
  const { vdParkedCarMaterial } = await import('./street-props.ts');
  const parked = createCarPbrMaterial(THREE as never).material;
  vdParkedCarMaterial(THREE as never, parked as never);
  const fleet = createVdCarMaterial(THREE as never, { glow: THREE.TSL.uniform(0) as never });
  // Each mesh draws a distinct index count (the instance count tags it), so a draw maps back to its body and level.
  const expected = new Map<number, Expect>();
  let tag = 2;
  for (const id of VD_CAR_IDS) {
    const data = decodeVdCar(id);
    const sets = [
      ['parked', vdParkedCarLodGeometries(THREE as never, id), parked, [[VD_XFORM_ATTRIBUTE, 4], [TONE_ATTRIBUTE, 3]]],
      ['fleet', vdCarLodGeometries(THREE as never, id), fleet, [[VD_XFORM_ATTRIBUTE, 4], ['carState', 4], ['paintColor', 3]]],
    ] as const;
    for (const [kind, geometries, material, fields] of sets) {
      for (const lod of VD_LODS) {
        const made = vdInstancedGeometry(THREE as never, geometries[lod] as never, tag, fields as never);
        const array = made.buffer.array as Float32Array;
        for (let i = 0; i < tag; i++) writeVdXform(array, i, made.stride, made.offsets[VD_XFORM_ATTRIBUTE]!, i * 20 - 300, i * 7, i * 0.9, 0.6 + (i % 3) * 0.2);
        made.geometry.instanceCount = tag;
        made.buffer.needsUpdate = true;
        const mesh = new THREE.Mesh(made.geometry as never, material as never);
        mesh.frustumCulled = false;
        scene.add(mesh);
        expected.set(tag, { data, lod, kind, instances: tag });
        tag++;
      }
    }
  }
  const camera = new THREE.PerspectiveCamera();
  renderer.render(scene, camera);
  return { draws: [...draws], expected };
}

test('every body, level and material draws in-range indices, no stretched triangle and front faces that match its normals', async () => {
  const { draws, expected } = await drawAll();
  const seen = new Set<number>();
  for (const draw of draws) {
    const e = expected.get(draw.instanceCount);
    if (!e) continue;
    seen.add(draw.instanceCount);
    const name = `${e.kind} ${e.data.id} ${e.lod}`;
    const idx = drawIndices(draw);
    assert.equal(idx.length, e.data.lodIndices[e.lod].length, `${name}: index count`);
    const vertexCount = e.data.partIds.length;
    for (let i = 0; i < idx.length; i++) assert.ok(idx[i]! < vertexCount, `${name}: index ${idx[i]} of ${vertexCount}`);
    const diagonal = Math.hypot(...e.data.size);
    for (let inst = 0; inst < draw.instanceCount; inst++) {
      const xf = fetchAttribute(draw, VD_XFORM_ATTRIBUTE, 0, inst)!;
      const scale = Math.hypot(xf[2]!, xf[3]!);
      // The vertex stage of vdXformPositionNode, on the CPU.
      const world = (v: number) => {
        const p = fetchAttribute(draw, 'position', v, inst)!;
        return [xf[2]! * p[0]! + xf[3]! * p[2]! + xf[0]!, p[1]! * scale, xf[2]! * p[2]! - xf[3]! * p[0]! + xf[1]!];
      };
      const cache = new Map<number, number[]>();
      const at = (v: number) => cache.get(v) ?? cache.set(v, world(v)).get(v)!;
      let longest = 0;
      for (let t = 0; t < idx.length; t += 3) {
        const [a, b, c] = [at(idx[t]!), at(idx[t + 1]!), at(idx[t + 2]!)];
        for (const [p, q] of [[a, b], [b, c], [c, a]] as const) longest = Math.max(longest, Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!));
      }
      assert.ok(longest <= diagonal * scale + 1e-3, `${name} instance ${inst}: edge ${longest.toFixed(2)} m over the ${(diagonal * scale).toFixed(2)} m diagonal`);
      if (inst > 0) continue;
      // Winding against the fetched normals (the transform turns both alike, so the car frame is enough).
      let wrong = 0;
      for (let t = 0; t < idx.length; t += 3) {
        const [a, b, c] = [idx[t]!, idx[t + 1]!, idx[t + 2]!].map((v) => fetchAttribute(draw, 'position', v, 0)!);
        const n = [idx[t]!, idx[t + 1]!, idx[t + 2]!].map((v) => fetchAttribute(draw, 'normal', v, 0)!);
        const e1 = [b![0]! - a![0]!, b![1]! - a![1]!, b![2]! - a![2]!]; const e2 = [c![0]! - a![0]!, c![1]! - a![1]!, c![2]! - a![2]!];
        const g = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
        const sum = [0, 1, 2].map((k) => n[0]![k]! + n[1]![k]! + n[2]![k]!);
        if (g[0]! * sum[0]! + g[1]! * sum[1]! + g[2]! * sum[2]! < 0) wrong++;
      }
      assert.ok(wrong <= idx.length / 3 / 500, `${name}: ${wrong} of ${idx.length / 3} triangles wound against their normals`);
    }
  }
  assert.equal(seen.size, expected.size, 'every mesh drew');
});

test('both vd car materials draw double-sided, so a clustered level\'s gaps show the panel behind', async () => {
  const { vdParkedCarMaterial } = await import('./street-props.ts');
  const parked = createCarPbrMaterial(THREE as never).material;
  vdParkedCarMaterial(THREE as never, parked as never);
  assert.equal(parked.side, THREE.DoubleSide);
  assert.equal(createVdCarMaterial(THREE as never, { glow: THREE.TSL.uniform(0) as never }).side, THREE.DoubleSide);
});

test('seen from outside, every body and level shows front faces: no see-through panels, no inside-out shards', () => {
  for (const id of VD_CAR_IDS) {
    const d = decodeVdCar(id);
    for (const lod of VD_LODS) {
      const share = backFaceShare(d.positions, d.normals, d.lodIndices[lod]);
      assert.ok(share <= BACK_FACE_SHARE[lod], `${id} ${lod}: ${(share * 100).toFixed(1)} % of outside rays meet a back face first`);
    }
  }
});
