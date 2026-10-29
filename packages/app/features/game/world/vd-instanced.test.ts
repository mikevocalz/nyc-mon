// vd-instanced.ts: the vdXform pose places a vertex where the InstancedMesh
// matrix did (Matrix4.compose of (x, 0, z), a yaw about +Y and a uniform
// scale), and meshes over vdInstancedGeometry sharing one material run one
// node build between them where InstancedMeshes ran one each.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { VD_XFORM_ATTRIBUTE, vdInstancedGeometry, vdXformPositionNode, writeVdXform } from './vd-instanced.ts';

/** The vertex transform vdXformPositionNode emits, on the CPU. */
function applyXform(xf: ArrayLike<number>, o: number, p: readonly [number, number, number]): [number, number, number] {
  const [x, z, c, s] = [xf[o]!, xf[o + 1]!, xf[o + 2]!, xf[o + 3]!];
  const k = Math.hypot(c, s);
  return [c * p[0] + s * p[2] + x, p[1] * k, c * p[2] - s * p[0] + z];
}

test('vdXform matches Matrix4.compose with a yaw about +Y and a uniform scale', () => {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  const xf = new Float32Array(8);
  for (const [x, z, yaw, s] of [[3, -7, 0.4, 1], [-120, 55, -2.9, 0.6], [0, 0, Math.PI / 2, 1.2]] as const) {
    writeVdXform(xf, 1, 4, 0, x, z, yaw, s);
    m.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(up, yaw), new THREE.Vector3(s, s, s));
    for (const p of [[1, 0, 0], [0, 1.4, 0], [0.8, 0.3, -2.1]] as const) {
      v.set(p[0], p[1], p[2]).applyMatrix4(m);
      const got = applyXform(xf, 4, p);
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(got[i]! - v.getComponent(i)) < 1e-4, `${p} -> ${got} vs ${v.toArray()}`);
    }
  }
});

test('meshes over vdInstancedGeometry with one material share one node build; InstancedMeshes do not', async () => {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('../render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals();
  const builds = async (instanced: boolean, meshes: number) => {
    const { device } = recordingGpuDevice();
    const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(64, 64), device } as never);
    await renderer.init();
    const scene = new THREE.Scene();
    const material = new THREE.MeshStandardNodeMaterial();
    if (!instanced) material.positionNode = vdXformPositionNode(THREE as never);
    for (let i = 0; i < meshes; i++) {
      const base = new THREE.BoxGeometry(1 + i, 1, 1);
      if (instanced) {
        const mesh = new THREE.InstancedMesh(base, material, 8);
        mesh.count = 2;
        scene.add(mesh);
      } else {
        const made = vdInstancedGeometry(THREE as never, base as never, 8, [[VD_XFORM_ATTRIBUTE, 4]]);
        writeVdXform(made.buffer.array as Float32Array, 0, made.stride, 0, i, 0, 0);
        writeVdXform(made.buffer.array as Float32Array, 1, made.stride, 0, i, 3, 1);
        made.geometry.instanceCount = 2;
        scene.add(new THREE.Mesh(made.geometry, material));
      }
    }
    const proto = (THREE as unknown as { NodeBuilder: { prototype: { build: (...a: unknown[]) => unknown } } }).NodeBuilder.prototype;
    const original = proto.build;
    let n = 0;
    proto.build = function (this: unknown, ...a: unknown[]) { n++; return original.apply(this, a); };
    try {
      renderer.render(scene, new THREE.PerspectiveCamera());
    } finally {
      proto.build = original;
    }
    return n;
  };
  // The frame's own builds (the output pass) come on top of the meshes'.
  assert.equal(await builds(false, 4), await builds(false, 1), 'four vdXform meshes build no more than one');
  assert.equal(await builds(true, 4), (await builds(true, 1)) + 3, 'four InstancedMeshes, a build each (three r186 keys them on uuid)');
});
