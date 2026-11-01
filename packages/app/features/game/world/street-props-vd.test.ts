// The vd lane's parked cars (street-props.ts): every car in CAR_RADIUS is a
// Valdrada baked body. The nearest VD_PARKED_CAP inside VD_PARKED_RADIUS draw
// LOD2, the rest the same body's `mid` decimation out to VD_PARKED_MID_RADIUS
// and its `far` one beyond. No box car is built, no car is drawn twice, and
// each keeps its tone. Each body level is a plain Mesh over an
// InstancedBufferGeometry with the pose in vdXform (vd-instanced.ts), so three
// builds the shared material once. Off the lane the mesh list is unchanged.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset } from '../city-dataset.ts';
import { createCityMaterials, TONE_ATTRIBUTE } from './materials.ts';
import { placeStreetFurniture } from './street-furniture.ts';
import { VD_XFORM_ATTRIBUTE } from './vd-instanced.ts';
import {
  buildStreetProps, CAR_CAP, CAR_RADIUS, placeStreetProps, VD_PARKED_CAP, VD_PARKED_CARS, VD_PARKED_MID_RADIUS, VD_PARKED_RADIUS,
  vdParkedCar,
} from './street-props.ts';
import { createStreetClearance } from './walkability.ts';

const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
const clearance = createStreetClearance(dataset);
const { signs, lights } = placeStreetFurniture(dataset, clearance);
const cars = placeStreetProps(dataset, clearance, signs, lights).cars;

type Inst = InstanceType<typeof THREE.Mesh> & { geometry: InstanceType<typeof THREE.InstancedBufferGeometry> };
const count = (m: Inst) => m.geometry.instanceCount;
const build = (vd: boolean) => {
  const materials = createCityMaterials(THREE as never, [0.5, 0.5, 0.7]);
  const props = buildStreetProps(THREE as never, dataset, materials, clearance, signs, lights, vd);
  return { materials, props };
};
const positions = (mesh: Inst) => {
  const out: [number, number][] = [];
  const xf = mesh.geometry.getAttribute(VD_XFORM_ATTRIBUTE);
  for (let k = 0; k < count(mesh); k++) out.push([xf.getX(k), xf.getY(k)]);
  return out;
};

test('vd off: the street props are the four meshes they were', () => {
  const { materials, props } = build(false);
  assert.deepEqual(props.objects.map((o) => o.name).sort(), ['city:cars', 'city:street-props', 'city:transit', 'city:transit-lights']);
  props.dispose();
  materials.dispose();
});

const lodOf = (name: string) => (name.endsWith('-mid') ? 'mid' : name.endsWith('-far') ? 'far' : 'near');
const bodyOf = (name: string) => name.slice('city:cars-vd-'.length).replace(/-(mid|far)$/, '');

test('vd on: no box car is built; each parked body has a near, mid and far mesh', () => {
  const { materials, props } = build(true);
  const names = props.objects.map((o) => o.name);
  assert.ok(!names.includes('city:cars'), 'no box car mesh');
  const vd = names.filter((n) => n.startsWith('city:cars-vd-'));
  const bodies = new Set(vd.map(bodyOf));
  for (const id of bodies) {
    assert.ok(VD_PARKED_CARS.includes(id as never), id);
    for (const suffix of ['', '-mid', '-far']) assert.ok(vd.includes(`city:cars-vd-${id}${suffix}`), `${id}${suffix}`);
  }
  assert.equal(vd.length, bodies.size * 3);
  const meshes = props.objects.filter((o) => o.name.startsWith('city:cars-vd-')) as unknown as unknown as Inst[];
  for (const m of meshes) {
    assert.ok(!(m as { isInstancedMesh?: boolean }).isInstancedMesh, `${m.name}: a plain Mesh, not an InstancedMesh`);
    assert.equal(m.geometry.isInstancedBufferGeometry, true);
  }
  assert.equal(new Set(meshes.map((m) => m.material)).size, 1, 'one shared material');
  props.dispose();
  materials.dispose();
});

const mid = cars[cars.length >> 1]!;
for (const focus of [[-28, 22], [mid.x + 3, mid.z - 2]] as const) {
  test(`vd on at (${focus.map((v) => v.toFixed(0))}): every car in range is a baked body at its distance level, nobody twice`, () => {
    const { materials, props } = build(true);
    const vdMeshes = props.objects.filter((o) => o.name.startsWith('city:cars-vd-')) as unknown as Inst[];
    assert.ok(vdMeshes.length >= 9, `bodies: ${vdMeshes.map((m) => m.name)}`);
    props.setFocus(focus[0], focus[1], 0, 0);

    const dist = cars.map((c) => Math.hypot(c.x - focus[0], c.z - focus[1]));
    const within = (r: number) => dist.filter((d) => d <= r).length;
    const expectedNear = Math.min(VD_PARKED_CAP, within(VD_PARKED_RADIUS));
    const expectedAll = Math.min(CAR_CAP, within(CAR_RADIUS));
    assert.ok(expectedNear > 0, 'the focus has parked cars inside the near radius');

    const byLod = { near: [] as [number, number][], mid: [] as [number, number][], far: [] as [number, number][] };
    for (const m of vdMeshes) byLod[lodOf(m.name)].push(...positions(m));
    assert.equal(byLod.near.length, expectedNear, 'the nearest cars (to the cap) draw LOD2');
    assert.equal(byLod.near.length + byLod.mid.length + byLod.far.length, expectedAll, 'every car in CAR_RADIUS is drawn');
    const d = ([x, z]: [number, number]) => Math.hypot(x - focus[0], z - focus[1]);
    for (const p of byLod.near) assert.ok(d(p) <= VD_PARKED_RADIUS + 1e-3);
    for (const p of byLod.mid) assert.ok(d(p) <= VD_PARKED_MID_RADIUS + 1e-3);
    for (const p of byLod.far) assert.ok(d(p) > VD_PARKED_MID_RADIUS - 1e-3 && d(p) <= CAR_RADIUS + 1e-3);
    const key = ([x, z]: [number, number]) => `${x.toFixed(3)},${z.toFixed(3)}`;
    const all = [...byLod.near, ...byLod.mid, ...byLod.far].map(key);
    assert.equal(new Set(all).size, all.length, 'no car drawn twice');

    // Each mesh holds only cars that pick that body, with the car's own tone.
    for (const mesh of vdMeshes) {
      const id = bodyOf(mesh.name);
      const tones = mesh.geometry.getAttribute(TONE_ATTRIBUTE);
      positions(mesh).forEach(([x, z], k) => {
        const i = cars.findIndex((c) => Math.abs(c.x - x) < 1e-3 && Math.abs(c.z - z) < 1e-3);
        assert.ok(i >= 0);
        assert.equal(vdParkedCar(i, cars[i]!.taxi), id);
        assert.ok(tones.getX(k) + tones.getY(k) + tones.getZ(k) > 0, 'tone carried');
      });
      assert.equal(mesh.visible, count(mesh) > 0);
    }
    props.dispose();
    materials.dispose();
  });
}

test('vd on: a 10 m move refills the near set in place; far away it empties', () => {
  const { materials, props } = build(true);
  const vdMeshes = props.objects.filter((o) => o.name.startsWith('city:cars-vd-')) as unknown as Inst[];
  const buffer = (m: Inst) => (m.geometry.getAttribute(VD_XFORM_ATTRIBUTE) as InstanceType<typeof THREE.InterleavedBufferAttribute>).data.array;
  const arrays = vdMeshes.map(buffer);
  props.setFocus(-28, 22, 0, 0);
  props.setFocus(-28, 40, 0, 0);
  vdMeshes.forEach((m, k) => assert.equal(buffer(m), arrays[k], 'same buffer, no reallocation'));
  props.setFocus(5000, 5000, 0, 0);
  assert.equal(vdMeshes.reduce((s, m) => s + count(m), 0), 0);
  assert.ok(vdMeshes.every((m) => !m.visible));
  props.setDistance(400);
  props.setFocus(-28, 22, 0, 0);
  assert.ok(vdMeshes.every((m) => !m.visible), 'hidden from far out');
  props.dispose();
  materials.dispose();
});

test('taxis wear the cab (or a yellow sedan); other slots spread over the CARLA bodies', () => {
  const picks = new Map<string, number>();
  cars.forEach((c, i) => { const id = vdParkedCar(i, c.taxi); picks.set(id, (picks.get(id) ?? 0) + 1); if (c.taxi) assert.ok(id === 'taxinv200' || id === 'lincoln'); });
  for (const id of ['lincoln', 'suv', 'mercedes', 'charger', 'van']) assert.ok((picks.get(id) ?? 0) > 0, id);
});
