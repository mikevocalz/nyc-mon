// The vd lane on the physical fleet (vehicle-actor.ts createLoftedFleet with
// vd: true): every vehicle is a Valdrada baked body. Each car kind's near set
// draws LOD2, one mesh per body in VD_FLEET_BODIES, under the near cap; past
// the cap the same body's `mid` decimation; the bus is the baked MTA XD40. No
// lofted body or proxy is built. paintColor / carState keep the lofted
// instance contract beside the pose (vdXform, world/vd-instanced.ts); every
// level is a plain Mesh over an InstancedBufferGeometry sharing one material,
// so three builds it once; the vd material compiles to WGSL on a real mesh.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { DEFAULT_ENV_STATE, packEnvSection } from './clock.ts';
import { LOFTED_INSTANCE_ATTRIBUTES } from './lofted-car-material.ts';
import { emptyPedSection } from './ped-sim.ts';
import { emptySignalSection } from './signal-viz.ts';
import { createVehicleActor, VD_FLEET_BODIES } from './vehicle-actor.ts';
import { LOFTED_NEAR_VEHICLES } from './vehicle-physical-constants.ts';
import { VFLAG, VSNAP_STRIDE } from './vehicle-sim.ts';
import { decodeVdCar, VD_BUS_ID, VD_CAR_IDS, vdCarHash } from '../world/vd-car-mesh.ts';
import { VD_XFORM_ATTRIBUTE } from '../world/vd-instanced.ts';

type Group = InstanceType<typeof THREE.Group>;
type Inst = InstanceType<typeof THREE.Mesh> & { geometry: InstanceType<typeof THREE.InstancedBufferGeometry> };
/** Instances drawn by a vd level. */
const count = (m: Inst) => m.geometry.instanceCount;
const KIND = { sedan: 0, taxi: 1, van: 2, bus: 3 } as const;
const frame = { delta: 1 / 60, time: 1, reducedMotion: false };
const snapshot = (records: number[][], lampLevel: number): number[] => [
  1, 1, 1 / 24, records.length, VSNAP_STRIDE, 3, 0, 0, ...records.flat(), ...emptyPedSection(), ...emptySignalSection(),
  ...packEnvSection({ ...DEFAULT_ENV_STATE, lampLevel, headlights: lampLevel > 0.5 ? 1 : 0 }, 3),
];
const rec = (id: number, kind: number, x: number, z: number, flags = 0): number[] => [id, kind, x, z, 0, x, z, 0, 5, flags, 9, 0];
const meshes = (group: Group, prefix: string) => group.children.filter((c) => c.name.startsWith(prefix)) as Inst[];

test('every fleet body is a baked car', () => {
  for (const ids of Object.values(VD_FLEET_BODIES)) for (const id of ids) assert.ok(VD_CAR_IDS.includes(id), id);
});

test('vd on: a near and a far mesh per baked body, the baked bus, no lofted mesh, the instance contract', () => {
  const actor = createVehicleActor({ read: () => null, physical: true, vd: true, tier: 'phone' })(THREE);
  const group = actor.object as Group;
  for (const kind of ['sedan', 'taxi', 'van'] as const) {
    assert.equal(group.getObjectByName(`living-city:vehicles:${kind}:near`), undefined, `${kind}: no lofted near body`);
    assert.equal(group.getObjectByName(`living-city:vehicles:${kind}:far`), undefined, `${kind}: no lofted far proxy`);
    const near = meshes(group, `living-city:vehicles:${kind}:near-vd-`);
    const far = meshes(group, `living-city:vehicles:${kind}:far-vd-`);
    const bodies = [...new Set(VD_FLEET_BODIES[kind])].sort();
    assert.deepEqual(near.map((m) => m.name.split('near-vd-')[1]).sort(), bodies);
    assert.deepEqual(far.map((m) => m.name.split('far-vd-')[1]).sort(), bodies);
    for (const m of [...near, ...far]) {
      assert.equal(m.geometry.getAttribute('paintColor').itemSize, LOFTED_INSTANCE_ATTRIBUTES.paintColor);
      assert.equal(m.geometry.getAttribute('carState').itemSize, LOFTED_INSTANCE_ATTRIBUTES.carState);
      assert.ok(m.geometry.getAttribute('partId') && m.geometry.getAttribute('color'));
      assert.equal(m.geometry.getAttribute(VD_XFORM_ATTRIBUTE).itemSize, 4);
      assert.ok(!(m as { isInstancedMesh?: boolean }).isInstancedMesh, `${m.name}: a plain Mesh, not an InstancedMesh (one node build per InstancedMesh)`);
      assert.equal(m.geometry.isInstancedBufferGeometry, true);
    }
    for (const m of near) {
      assert.ok(m.castShadow, 'near bodies cast');
      assert.equal(m.geometry.getAttribute(VD_XFORM_ATTRIBUTE).count, LOFTED_NEAR_VEHICLES.phone);
      // The far mesh is the same body's decimation over the same vertices.
      const id = m.name.split('near-vd-')[1]!;
      const twin = far.find((f) => f.name.endsWith(`far-vd-${id}`))!;
      assert.equal(twin.geometry.getAttribute('position'), m.geometry.getAttribute('position'));
      assert.equal(twin.geometry.index!.count, decodeVdCar(id as never).lodIndices.mid.length);
    }
  }
  assert.equal(group.getObjectByName('living-city:vehicles:bus:near'), undefined, 'no lofted bus');
  assert.ok(group.getObjectByName(`living-city:vehicles:bus:near-vd-${VD_BUS_ID}`), 'the baked bus');
  const all = meshes(group, 'living-city:vehicles:').filter((m) => m.name.includes('-vd-'));
  assert.equal(new Set(all.map((m) => m.material)).size, 1, 'every vd level shares one material');
  actor.dispose();
});

test('vd on: the near cap holds across bodies, each vehicle lands in its hashed body, state and paint follow', () => {
  const focus = { x: 0, z: 0, fwdX: 0, fwdZ: 1 };
  const sedans = Array.from({ length: 12 }, (_, i) => rec(100 + i, KIND.sedan, 0, 5 + i * 6, i === 0 ? VFLAG.braking : 0));
  const snap = snapshot([...sedans, rec(7, KIND.taxi, 3, 9), rec(8, KIND.bus, -4, 20)], 1);
  const actor = createVehicleActor({ read: () => snap, physical: true, vd: true, tier: 'phone', focus: () => focus })(THREE);
  const group = actor.object as Group;
  actor.update(frame);
  const bodies = VD_FLEET_BODIES.sedan;
  const near = meshes(group, 'living-city:vehicles:sedan:near-vd-');
  const nearTotal = near.reduce((s, m) => s + count(m), 0);
  assert.equal(nearTotal, LOFTED_NEAR_VEHICLES.phone, 'six nearest sedans in full');
  const far = meshes(group, 'living-city:vehicles:sedan:far-vd-');
  assert.equal(far.reduce((s, m) => s + count(m), 0), 12 - LOFTED_NEAR_VEHICLES.phone, 'the rest at the mid level');
  for (const m of far) {
    // Every far sedan sits in the decimation of the body its id hashes to.
    const id = m.name.split('far-vd-')[1]!;
    const want = sedans.slice(LOFTED_NEAR_VEHICLES.phone).filter((r) => bodies[Math.floor(vdCarHash(r[0]!) * bodies.length) % bodies.length] === id).length;
    assert.equal(count(m), want, m.name);
  }
  // The six nearest ids (100..105), each in the body its id hashes to.
  const expected = new Map<string, number>();
  for (let i = 0; i < LOFTED_NEAR_VEHICLES.phone; i++) {
    const id = bodies[Math.floor(vdCarHash(100 + i) * bodies.length) % bodies.length]!;
    expected.set(id, (expected.get(id) ?? 0) + 1);
  }
  for (const m of near) assert.equal(count(m), expected.get(m.name.split('near-vd-')[1]!) ?? 0, m.name);
  // The braking sedan (id 100) is first in its body's mesh.
  const first = bodies[Math.floor(vdCarHash(100) * bodies.length) % bodies.length]!;
  const mesh = group.getObjectByName(`living-city:vehicles:sedan:near-vd-${first}`) as Inst;
  assert.equal(mesh.geometry.getAttribute('carState').getX(0), 1, 'brake lit');
  const paint = mesh.geometry.getAttribute('paintColor');
  assert.ok(paint.getX(0) + paint.getY(0) + paint.getZ(0) > 0, 'paint written');
  // The pose: x, z, then cos/sin of the yaw (scaled by `grow`).
  const xf = mesh.geometry.getAttribute(VD_XFORM_ATTRIBUTE);
  assert.deepEqual([xf.getX(0), xf.getY(0)], [0, 5], 'placed at the braking sedan');
  assert.ok(Math.abs(Math.hypot(xf.getZ(0), xf.getW(0)) - 1) < 1e-3, 'unit scale once grown in');
  const taxis = meshes(group, 'living-city:vehicles:taxi:near-vd-').reduce((s, m) => s + count(m), 0);
  assert.equal(taxis, 1);
  assert.equal(count(group.getObjectByName(`living-city:vehicles:bus:near-vd-${VD_BUS_ID}`) as Inst), 1);
  actor.dispose();
});

test('vd off on the physical fleet keeps the lofted near body', () => {
  const actor = createVehicleActor({ read: () => null, physical: true, vd: false })(THREE);
  const group = actor.object as Group;
  assert.ok(group.getObjectByName('living-city:vehicles:sedan:near'));
  assert.equal(meshes(group, 'living-city:vehicles:sedan:near-vd-').length, 0);
  actor.dispose();
});

test('the vd body material compiles to WGSL on the real mesh, the pose read from vdXform', async () => {
  const canvas = { width: 300, height: 150, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null } as unknown as HTMLCanvasElement;
  const renderer = new THREE.WebGPURenderer({ canvas });
  await renderer.init().catch(() => undefined);
  (renderer as unknown as { backend: { capabilities: unknown } }).backend.capabilities = { getUniformBufferLimit: () => 65_536 };
  (renderer as unknown as { hasFeature: () => boolean }).hasFeature = () => false;
  const WGSLNodeBuilder = (THREE as unknown as { WGSLNodeBuilder: new (o: unknown, r: unknown) => {
    scene: unknown; camera: unknown; material: unknown; context: { material: unknown }; fogNode: unknown; build(): void; vertexShader?: string; fragmentShader?: string;
  } }).WGSLNodeBuilder;
  const actor = createVehicleActor({ read: () => null, physical: true, vd: true })(THREE);
  const mesh = (actor.object as Group).getObjectByName('living-city:vehicles:taxi:near-vd-taxinv200') as Inst;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const b = new WGSLNodeBuilder(mesh, renderer);
  b.scene = scene; b.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000); b.material = mesh.material; b.context.material = mesh.material;
  b.fogNode = null;
  b.build();
  assert.ok((b.fragmentShader ?? '').length > 1000);
  for (const a of ['partId', 'carState', 'paintColor', 'color', VD_XFORM_ATTRIBUTE]) assert.match(b.vertexShader ?? '', new RegExp(a), a);
  actor.dispose();
});
