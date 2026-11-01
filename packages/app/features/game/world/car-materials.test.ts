// Lane L4 "cars": the flag is opt-in, the factory produces a
// MeshPhysicalNodeMaterial with the clearcoat slots bound and no env of its
// own, the lamps follow the sky pick through a live uniform, the graph
// compiles to WGSL on the real instanced mesh, and the unflagged world is
// untouched. Same stub-renderer convention as pbr-materials.test.ts.
import '../classic-flags.test-support.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset } from '../city-dataset.ts';
import { buildCityWorld } from './index.ts';
import { carLampsOn, createCarPbrMaterial, EXPERIMENTAL_WORLD_CAR_PBR } from './car-materials.ts';
import { parseSkyRigFlag } from './sky-rig.ts';
import { buildStreetProps } from './street-props.ts';
import { syntheticTileV2 } from './synthetic-tile.ts';
import { createStreetClearance } from './walkability.ts';

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

async function stubRenderer() {
  const canvas = {
    width: 300, height: 150, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null,
  } as unknown as HTMLCanvasElement;
  const renderer = new THREE.WebGPURenderer({ canvas });
  await renderer.init().catch(() => undefined);
  (renderer as unknown as { backend: { capabilities: unknown } }).backend.capabilities = { getUniformBufferLimit: () => 65_536 };
  (renderer as unknown as { hasFeature: () => boolean }).hasFeature = () => false;
  return renderer;
}

const carMesh = (world: ReturnType<typeof buildCityWorld>) => {
  const mesh = world.group.getObjectByName('city:cars') as THREE.InstancedMesh | undefined;
  assert.ok(mesh, 'city:cars mesh');
  return mesh;
};

test('car PBR flag is opt-in and shares the rig flag truth table', () => {
  assert.equal(EXPERIMENTAL_WORLD_CAR_PBR, parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_CAR_PBR));
});

test('the car material is physical, clearcoat-bound and pins no env', () => {
  const { material, lampsOn } = createCarPbrMaterial(THREE, { sky: 'dusk' });
  assert.equal((material as { isMeshPhysicalNodeMaterial?: boolean }).isMeshPhysicalNodeMaterial, true);
  assert.ok(material.clearcoatNode, 'clearcoat bound');
  assert.ok(material.clearcoatRoughnessNode, 'clearcoatRoughness bound');
  assert.ok(material.roughnessNode && material.metalnessNode, 'roughness/metalness bound');
  assert.ok(material.colorNode && material.emissiveNode && material.aoNode, 'colour/emissive/ao bound');
  // Lit by the one scene environment: no material-pinned env, ever.
  assert.equal(material.envNode, null);
  assert.equal(material.envMap, null);
  // Transmission deliberately unused: the tinted-clearcoat recipe, not the backbuffer pass.
  assert.equal(material.transmissionNode, null);
  assert.equal(material.transmission, 0);
  assert.equal(lampsOn.value, 1, 'dusk lights the lamps');
  material.dispose();
});

test('the lamp switch follows the sky pick and stays live', () => {
  assert.equal(carLampsOn('morning'), false);
  assert.equal(carLampsOn('dusk'), true);
  assert.equal(carLampsOn('night'), true);
  assert.equal(carLampsOn(undefined), true, 'the unflagged world is authored dusk');
  const morning = createCarPbrMaterial(THREE, { sky: 'morning' });
  assert.equal(morning.lampsOn.value, 0);
  morning.lampsOn.value = 1; // a sky swap flips the same material without a rebuild
  assert.equal(morning.lampsOn.value, 1);
  morning.material.dispose();
});

test('the car graph compiles to WGSL on the real instanced mesh', async () => {
  const renderer = await stubRenderer();
  // The real car geometry through buildStreetProps on the synthetic tile:
  // cheap to build, and it carries the actual attributes the graph reads.
  const data = parseCityDataset(syntheticTileV2());
  const { material } = createCarPbrMaterial(THREE, { sky: 'dusk' });
  const props = buildStreetProps(
    THREE,
    data,
    { roofs: new THREE.MeshBasicNodeMaterial(), neon: new THREE.MeshBasicNodeMaterial(), cars: material },
    createStreetClearance(data),
    [],
    [],
  );
  const mesh = props.objects.find((o) => o.name === 'city:cars') as THREE.InstancedMesh;
  assert.ok(mesh, 'city:cars instanced mesh');
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  const b = new WGSLNodeBuilder(mesh, renderer);
  b.scene = scene; b.camera = camera; b.material = mesh.material; b.context.material = mesh.material;
  b.fogNode = null;
  const started = performance.now();
  b.build();
  const ms = performance.now() - started;
  const frag = b.fragmentShader ?? '';
  const vert = b.vertexShader ?? '';
  assert.ok(ms < 500 && frag.length > 400 && frag.length < 60_000, `cars: ${ms.toFixed(1)} ms, ${frag.length} chars`);
  assert.match(frag, /clearcoat/i, 'clearcoat path in the fragment');
  assert.match(vert, /aRoughMetal/, 'surface attribute bound');
  assert.match(vert, /aOcclusion/, 'occlusion attribute bound');
  assert.match(vert, /instanceTone/, 'instance tone bound');
  props.dispose();
  material.dispose();
});

test('flag on swaps only the cars material, flag off keeps the default path', () => {
  // The synthetic tile is enough: the cars InstancedMesh always exists,
  // even where no slot placed — and it keeps the suite's wall-clock budget
  // test out of the neighbours' load.
  const tile = () => parseCityDataset(syntheticTileV2());
  const off = buildCityWorld(THREE, tile(), { carPbr: false });
  const offCars = carMesh(off).material as { isMeshPhysicalNodeMaterial?: boolean; isMeshStandardNodeMaterial?: boolean };
  assert.ok(!offCars.isMeshPhysicalNodeMaterial, 'default cars stay on the lane body');
  off.dispose();

  const on = buildCityWorld(THREE, tile(), { pbr: true, carPbr: true });
  const onCars = carMesh(on).material as { isMeshPhysicalNodeMaterial?: boolean; isMeshStandardNodeMaterial?: boolean };
  assert.ok(onCars.isMeshPhysicalNodeMaterial, 'flagged cars are physical');
  // The rest of the PBR lane is unchanged — walls are still standard.
  const walls = on.group.getObjectByName('city:walls-masonry') as THREE.Mesh;
  const wallMat = walls.material as { isMeshPhysicalNodeMaterial?: boolean; isMeshStandardNodeMaterial?: boolean };
  assert.ok(wallMat.isMeshStandardNodeMaterial && !wallMat.isMeshPhysicalNodeMaterial, 'walls stay standard');
  on.dispose();

  // The flag composes over the cel lane too: cars physical, walls cel.
  const celLane = buildCityWorld(THREE, tile(), { carPbr: true });
  const celCars = carMesh(celLane).material as { isMeshPhysicalNodeMaterial?: boolean };
  assert.ok(celCars.isMeshPhysicalNodeMaterial, 'cars are physical over the cel lane');
  const celWalls = (celLane.group.getObjectByName('city:walls-masonry') as THREE.Mesh).material as {
    isMeshStandardNodeMaterial?: boolean;
    isMeshPhysicalNodeMaterial?: boolean;
  };
  assert.ok(!celWalls.isMeshStandardNodeMaterial && !celWalls.isMeshPhysicalNodeMaterial, 'walls stay cel');
  celLane.dispose();

  // The L2 flag alone does not upgrade cars to physical.
  const pbrOnly = buildCityWorld(THREE, tile(), { pbr: true, carPbr: false });
  const pbrCars = carMesh(pbrOnly).material as { isMeshPhysicalNodeMaterial?: boolean; isMeshStandardNodeMaterial?: boolean };
  assert.ok(pbrCars.isMeshStandardNodeMaterial && !pbrCars.isMeshPhysicalNodeMaterial, 'L2 cars are standard, not physical');
  pbrOnly.dispose();
});
