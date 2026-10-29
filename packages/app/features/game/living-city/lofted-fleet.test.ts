// The lofted fleet behind EXPO_PUBLIC_WORLD_PHYSICAL: registry ranking, the flag-off invariant, the per-instance
// attribute contract (N5: paintColor vec3, carState vec4), snapshot-driven state, the tiered spots and flares, the
// WGSL compile of both materials on the real instanced meshes, and the plate atlas that replaces Slop's canvas.
// These pin the lofted bodies (vd: false); vd-fleet.test.ts covers the vd lane's baked near bodies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { physicalVehicles } from '@acme/theme';
import { candidates, createWorldAssetRegistry } from './asset-registry.ts';
import { validateRegistry } from './asset-validation.ts';
import { packEnvSection, DEFAULT_ENV_STATE } from './clock.ts';
import {
  LOFTED_INSTANCE_ATTRIBUTES,
  PLATE_BAND_HEIGHT,
  PLATE_BAND_WIDTH,
  PLATE_LABELS,
  carStateFromFlags,
  createLoftedBusMaterial,
  createLoftedCarMaterial,
  plateAtlasPixels,
  vehiclePaintToken,
} from './lofted-car-material.ts';
import { BODY_SPECS } from './lofted-car.ts';
import { emptyPedSection } from './ped-sim.ts';
import { LOFTED_VEHICLE_ASSETS, PHYSICAL_SEED_ASSETS, SEED_ASSETS } from './seed-assets.ts';
import { emptySignalSection } from './signal-viz.ts';
import { EXPERIMENTAL_WORLD_PHYSICAL, createVehicleActor, isLoftedRecipe, resolveVehicleEntry } from './vehicle-actor.ts';
import { HEADLIGHT_POOL } from './vehicle-physical-constants.ts';
import { VEHICLE_KINDS, VEHICLE_SEMANTIC_ID, VFLAG, VSNAP_STRIDE } from './vehicle-sim.ts';

type Builder = {
  scene: unknown;
  camera: unknown;
  material: unknown;
  context: { material: unknown };
  fogNode: unknown;
  build(): void;
  vertexShader?: string;
  fragmentShader?: string;
};
const WGSLNodeBuilder = (THREE as unknown as { WGSLNodeBuilder: new (object: unknown, renderer: unknown) => Builder }).WGSLNodeBuilder;

// Same stub-renderer convention as world/car-materials.test.ts and world/vd-materials.test.ts.
async function stubRenderer() {
  const canvas = {
    width: 300, height: 150, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null,
  } as unknown as HTMLCanvasElement;
  const renderer = new THREE.WebGPURenderer({ canvas });
  await renderer.init().catch(() => undefined);
  (renderer as unknown as { backend: { capabilities: unknown } }).backend.capabilities = { getUniformBufferLimit: () => 65_536 };
  (renderer as unknown as { hasFeature: () => boolean }).hasFeature = () => false;
  // The plate atlas is sampled; texture uniforms ask the backend for sample data (as world/vd-materials.test.ts stubs it).
  (renderer as unknown as { backend: { utils: unknown } }).backend.utils = {
    getTextureSampleData: () => ({ samples: 1, primarySamples: 1, isMSAA: false }),
  };
  return renderer;
}

/** A world snapshot: vehicle records, empty ped and signal sections, and an env tail at `lampLevel`. */
function snapshot(records: number[][], lampLevel: number): number[] {
  const head = [1, 1, 1 / 24, records.length, VSNAP_STRIDE, 3, 0, 0];
  const env = packEnvSection({ ...DEFAULT_ENV_STATE, lampLevel, headlights: lampLevel > 0.5 ? 1 : 0 }, 3);
  return [...head, ...records.flat(), ...emptyPedSection(), ...emptySignalSection(), ...env];
}
/** [id, kind, prevX, prevZ, prevYaw, x, z, yaw, speed, flags, age, reserved] */
const rec = (id: number, kind: number, x: number, z: number, flags = 0): number[] => [id, kind, x, z, 0, x, z, 0, 5, flags, 9, 0];
const KIND = { sedan: 0, taxi: 1, van: 2, bus: 3 } as const;

const frame = { delta: 1 / 60, time: 1, reducedMotion: false };

type Group = InstanceType<typeof THREE.Group>;
const byName = (group: Group, name: string) => group.getObjectByName(name) as THREE.InstancedMesh | undefined;

// --- Registry ---------------------------------------------------------------------------------------------------

test('the physical flag is on by default and the classic registry is unchanged', () => {
  assert.equal(EXPERIMENTAL_WORLD_PHYSICAL, true);
  assert.equal(PHYSICAL_SEED_ASSETS.length, SEED_ASSETS.length + LOFTED_VEHICLE_ASSETS.length);
  assert.ok(!SEED_ASSETS.some(isLoftedRecipe), 'SEED_ASSETS carries no lofted recipe');
  assert.equal(LOFTED_VEHICLE_ASSETS.length, VEHICLE_KINDS.length, 'one lofted recipe per VehicleKind');
});

test('the physical registry validates clean', () => {
  const issues = validateRegistry(createWorldAssetRegistry(PHYSICAL_SEED_ASSETS)).filter((i) => i.severity === 'error');
  assert.deepEqual(issues, []);
});

test('with the kind, every class resolves its own lofted recipe, ranked above proc:box-car', () => {
  const registry = createWorldAssetRegistry(PHYSICAL_SEED_ASSETS);
  for (const kind of VEHICLE_KINDS) {
    const id = VEHICLE_SEMANTIC_ID[kind];
    const entry = resolveVehicleEntry(registry, id, kind)!;
    assert.equal(entry.variant, `slop-lofted-${kind}`, kind);
    const chain = candidates(registry, id);
    const box = chain.findIndex((e) => e.uri === 'proc:box-car');
    assert.ok(box >= 0 && chain.indexOf(entry) < box, `${kind}: lofted ahead of the box fallback`);
  }
});

test('without the kind, resolution is exactly the pre-flag result on either registry', () => {
  const plain = createWorldAssetRegistry(SEED_ASSETS);
  const physical = createWorldAssetRegistry(PHYSICAL_SEED_ASSETS);
  for (const id of ['vehicle.sedan', 'vehicle.van', 'vehicle.bus']) {
    const before = resolveVehicleEntry(plain, id)!;
    assert.ok(before.uri!.startsWith('proc:box-'), `${id} stays on the box recipes`);
    assert.equal(resolveVehicleEntry(physical, id), physical.entries.find((e) => e.id === id && e.variant === before.variant));
  }
  // A kind on a registry with no lofted recipe falls back to the box path: the flag can never render nothing.
  assert.equal(resolveVehicleEntry(plain, 'vehicle.sedan', 'taxi')!.uri, 'proc:box-car');
});

// --- Paint, state, plate ----------------------------------------------------------------------------------------

test('paint is a token, deterministic per id, and every taxi is taxi yellow', () => {
  for (let id = 0; id < 40; id++) {
    assert.equal(vehiclePaintToken('taxi', id), physicalVehicles.paint.taxi[0]);
    assert.equal(vehiclePaintToken('sedan', id), vehiclePaintToken('sedan', id));
    assert.ok((physicalVehicles.paint.sedan as readonly string[]).includes(vehiclePaintToken('sedan', id)));
    assert.ok((physicalVehicles.paint.suv as readonly string[]).includes(vehiclePaintToken('van', id)));
  }
});

test('carState comes from the packed flag byte: brake, left (+x), right (-x), livery 0', () => {
  assert.deepEqual(carStateFromFlags(0, true, VFLAG), [0, 0, 0, 0]);
  assert.deepEqual(carStateFromFlags(VFLAG.braking, true, VFLAG), [1, 0, 0, 0]);
  assert.deepEqual(carStateFromFlags(VFLAG.blinkLeft, true, VFLAG), [0, 1, 0, 0]);
  assert.deepEqual(carStateFromFlags(VFLAG.blinkLeft, false, VFLAG), [0, 0, 0, 0], 'the blink parity gates the flash');
  assert.deepEqual(carStateFromFlags(VFLAG.blinkRight | VFLAG.braking, true, VFLAG), [1, 0, 1, 0]);
});

test('the plate atlas is four yellow bands of pixel-font ink, no canvas', () => {
  const { data, width, height } = plateAtlasPixels();
  assert.equal(width, PLATE_BAND_WIDTH);
  assert.equal(height, PLATE_BAND_HEIGHT * PLATE_LABELS.length);
  assert.equal(data.length, width * height * 4);
  const field = physicalVehicles.plate.field;
  const fieldRgb = [1, 3, 5].map((i) => Number.parseInt(field.slice(i, i + 2), 16));
  for (let band = 0; band < PLATE_LABELS.length; band++) {
    let ink = 0;
    for (let y = band * PLATE_BAND_HEIGHT; y < (band + 1) * PLATE_BAND_HEIGHT; y++) {
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4;
        if (data[o] !== fieldRgb[0] || data[o + 1] !== fieldRgb[1] || data[o + 2] !== fieldRgb[2]) ink++;
      }
    }
    assert.ok(ink > 40 && ink < 200, `band ${band} carries a label (${ink} ink texels)`);
  }
});

// --- The actor --------------------------------------------------------------------------------------------------

test('physical on: lofted near/far meshes per car kind, one bus mesh, the instance attribute contract', () => {
  const actor = createVehicleActor({ read: () => null, physical: true, vd: false, tier: 'phone' })(THREE);
  const group = actor.object as Group;
  for (const kind of ['sedan', 'taxi', 'van'] as const) {
    for (const lod of ['near', 'far']) {
      const mesh = byName(group, `living-city:vehicles:${kind}:${lod}`);
      assert.ok(mesh?.isInstancedMesh, `${kind} ${lod}`);
      const paint = mesh!.geometry.getAttribute('paintColor') as THREE.InstancedBufferAttribute;
      const state = mesh!.geometry.getAttribute('carState') as THREE.InstancedBufferAttribute;
      assert.ok(paint.isInstancedBufferAttribute && state.isInstancedBufferAttribute);
      assert.equal(paint.itemSize, 3, 'paintColor is vec3');
      assert.equal(state.itemSize, 4, 'carState is vec4');
      assert.equal(paint.itemSize, LOFTED_INSTANCE_ATTRIBUTES.paintColor);
      assert.equal(state.itemSize, LOFTED_INSTANCE_ATTRIBUTES.carState);
      assert.equal(paint.count, mesh!.instanceMatrix.count);
      assert.equal(mesh!.geometry.getAttribute('partId').itemSize, 1);
    }
  }
  assert.ok(byName(group, 'living-city:vehicles:bus:near'));
  assert.equal(byName(group, 'living-city:vehicles:bus:far'), undefined, 'the bus has no proxy');
  assert.equal(byName(group, 'living-city:vehicles:sedan'), undefined, 'no box mesh for a lofted kind');
  const pool = (group.getObjectByName('living-city:vehicle-headlights') as Group).children;
  assert.equal(pool.length, 8, 'phone pool: one light per lit vehicle, eight vehicles');
  assert.ok(pool.every((c) => (c as THREE.PointLight).isPointLight && c.castShadow === false), 'unshadowed PointLights only');
  actor.dispose();
});

test('physical off: the actor builds exactly the box meshes and the PR07 light quads, nothing lofted', () => {
  const actor = createVehicleActor({ read: () => null, physical: false })(THREE);
  const group = actor.object as Group;
  const names = group.children.map((c) => c.name).sort();
  assert.deepEqual(names, [
    'living-city:vehicle-lights',
    'living-city:vehicles:bus',
    'living-city:vehicles:sedan',
    'living-city:vehicles:taxi',
    'living-city:vehicles:van',
  ]);
  actor.dispose();
});

test('a night snapshot drives paint, brake state, near/far split, headlight pools and flares', () => {
  const focus = { x: 0, z: 0, fwdX: 0, fwdZ: 1 };
  let snap = snapshot(
    [
      rec(1, KIND.sedan, 0, 8, VFLAG.braking | VFLAG.headlights),
      rec(2, KIND.taxi, 3, 12),
      rec(3, KIND.bus, -4, 20),
      ...Array.from({ length: 8 }, (_, i) => rec(10 + i, KIND.sedan, 0, 30 + i * 12)),
    ],
    1,
  );
  const actor = createVehicleActor({ read: () => snap, physical: true, vd: false, tier: 'phone', focus: () => focus })(THREE);
  const group = actor.object as Group;
  assert.equal(actor.update(frame), true, 'moving fleet keeps drawing');

  const sedanNear = byName(group, 'living-city:vehicles:sedan:near')!;
  const sedanFar = byName(group, 'living-city:vehicles:sedan:far')!;
  assert.equal(sedanNear.count, 6, 'phone tier draws the six nearest sedans in full');
  assert.equal(sedanFar.count, 3, 'the rest take the proxy');
  const state = sedanNear.geometry.getAttribute('carState').array as Float32Array;
  assert.equal(state[0], 1, 'the nearest sedan brakes');
  const paint = sedanNear.geometry.getAttribute('paintColor').array as Float32Array;
  const expected = new THREE.Color().setStyle(vehiclePaintToken('sedan', 1));
  assert.ok(Math.abs(paint[0]! - expected.r) < 1e-6 && Math.abs(paint[2]! - expected.b) < 1e-6, 'linear paint from the token');
  assert.equal(byName(group, 'living-city:vehicles:taxi:near')!.count, 1);
  assert.equal(byName(group, 'living-city:vehicles:bus:near')!.count, 1);

  const pools = (group.getObjectByName('living-city:vehicle-headlights') as Group).children as THREE.PointLight[];
  const lit = pools.filter((s) => s.intensity > 0);
  assert.equal(lit.length, 8, 'eight vehicles, one road pool each');
  assert.ok(lit.every((s) => s.intensity <= HEADLIGHT_POOL.busIntensity * 1.28));
  assert.ok(
    lit.some((s) => Math.abs(s.position.z - (8 + 2.25 + HEADLIGHT_POOL.ahead)) < 1e-5 && Math.abs(s.position.y - HEADLIGHT_POOL.height) < 1e-5),
    'the nearest sedan paints the road ahead of its nose',
  );

  const flares = group.getObjectByName('living-city:vehicle-flares') as THREE.Mesh;
  assert.ok(flares.visible && flares.count > 0 && flares.count % 4 === 0, `flares on distant cars (${flares.count})`);

  // Daylight: pools off and parked, flares hidden.
  snap = snapshot([rec(1, KIND.sedan, 0, 8), rec(18, KIND.sedan, 0, 90)], 0);
  actor.update(frame);
  assert.ok(pools.every((s) => s.intensity === 0));
  assert.equal(flares.visible, false);
  actor.dispose();
});

test('without a focus no headlight light or flare is assigned and the near cap still holds', () => {
  const snap = snapshot(Array.from({ length: 9 }, (_, i) => rec(i + 1, KIND.van, 0, i * 5)), 1);
  const actor = createVehicleActor({ read: () => snap, physical: true, vd: false, tier: 'high' })(THREE);
  const group = actor.object as Group;
  actor.update(frame);
  assert.equal(byName(group, 'living-city:vehicles:van:near')!.count, 9, 'high tier: twelve near slots');
  const pools = (group.getObjectByName('living-city:vehicle-headlights') as Group).children as THREE.PointLight[];
  assert.equal(pools.length, 24, 'high pool: 24 vehicles');
  assert.ok(pools.every((s) => s.intensity === 0));
  assert.equal((group.getObjectByName('living-city:vehicle-flares') as THREE.Mesh).visible, false);
  actor.dispose();
});

test('headlightLights: false builds no lights', () => {
  const actor = createVehicleActor({ read: () => null, physical: true, vd: false, headlightLights: false })(THREE);
  assert.equal((actor.object as Group).getObjectByName('living-city:vehicle-headlights'), undefined);
  actor.dispose();
});

// --- WGSL ---------------------------------------------------------------------------------------------------------

test('the car and bus graphs compile to WGSL on the real lofted instanced meshes', async () => {
  const renderer = await stubRenderer();
  const actor = createVehicleActor({ read: () => null, physical: true, vd: false })(THREE);
  const group = actor.object as Group;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  for (const name of ['living-city:vehicles:taxi:near', 'living-city:vehicles:van:far', 'living-city:vehicles:bus:near']) {
    const mesh = byName(group, name)!;
    scene.add(mesh);
    const b = new WGSLNodeBuilder(mesh, renderer);
    b.scene = scene;
    b.camera = camera;
    b.material = mesh.material;
    b.context.material = mesh.material;
    b.fogNode = null;
    const started = performance.now();
    b.build();
    const ms = performance.now() - started;
    const frag = b.fragmentShader ?? '';
    const vert = b.vertexShader ?? '';
    assert.ok(frag.length > 2000, `${name}: fragment ${frag.length} chars in ${ms.toFixed(0)} ms`);
    assert.match(vert, /partId/, `${name}: partId bound`);
    assert.match(vert, /carState/, `${name}: carState bound`);
    if (!name.includes('bus')) assert.match(vert, /paintColor/, `${name}: paintColor bound`);
  }
  actor.dispose();
});

test('a caller-supplied plate texture is used and not disposed by the material', () => {
  const plate = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  const made = createLoftedCarMaterial(THREE, BODY_SPECS.sedan, { glow: THREE.TSL.float(1), plateTexture: plate });
  assert.equal(made.plateTexture, plate);
  assert.equal(made.ownsPlateTexture, false);
  made.material.dispose();
  const bus = createLoftedBusMaterial(THREE, { glow: THREE.TSL.float(1) });
  assert.ok(bus.colorNode && bus.emissiveNode && bus.roughnessNode && bus.metalnessNode);
  bus.dispose();
});

// --- N2 guard for this lane's files --------------------------------------------------------------------------------

test('no hex colour literal in the lofted fleet modules (tokens only)', () => {
  const files = ['lofted-car.ts', 'lofted-car-material.ts', 'vehicle-headlights.ts', 'vehicle-physical-constants.ts'];
  for (const f of files) {
    const src = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /#[0-9a-fA-F]{6}\b|0x[0-9a-fA-F]{6}\b/, f);
  }
});
