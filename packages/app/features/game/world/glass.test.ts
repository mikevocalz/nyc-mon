// Lane L3 "glass and rooms": the flag is opt-in, the window material is a
// standard node material with the window layer bound, the seeded room
// parameters are deterministic and inside their ranges, the pixel-size
// fade produces the documented blend weights, the lit share follows the
// seeded probability by time of day, and both tiers compile to WGSL
// through three's own WGSLNodeBuilder. Same stub-renderer convention as
// pbr-materials.test.ts / shader-graphs.test.ts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { parseCityDataset } from '../city-dataset.ts';
import { buildCityWorld, SUN } from './index.ts';
import {
  createGlassCityMaterials,
  createWindowMaterial,
  EXPERIMENTAL_WORLD_GLASS,
  GLASS,
  glassFadeWeights,
  litShare,
  paneRoughness,
  paneTilt,
  roomAc,
  roomBlinds,
  roomDepth,
  roomLit,
  schlickFresnel,
} from './glass.ts';
import { parseSkyRigFlag } from './sky-rig.ts';
import { WINDOW_GRID } from './windows.ts';

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

const dataset = () =>
  parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));

test('glass flag is opt-in and shares the rig flag truth table', () => {
  for (const on of ['1', 'true', 'on', 'yes', ' TRUE ', 'On']) {
    assert.equal(parseSkyRigFlag(on), true, on);
  }
  for (const off of [undefined, null, '', '0', 'false', 'off', 'nope', '  ']) {
    assert.equal(parseSkyRigFlag(off), false, String(off));
  }
  assert.equal(EXPERIMENTAL_WORLD_GLASS, parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_GLASS));
});

test('room parameters are deterministic per cell and vary across the grid', () => {
  for (let c = 0; c < 12; c++) {
    for (let r = 1; r < 8; r++) {
      assert.equal(roomDepth(c, r, 41.5), roomDepth(c, r, 41.5));
      assert.deepEqual(roomBlinds(c, r, 41.5), roomBlinds(c, r, 41.5));
      assert.deepEqual(roomAc(c, r, 41.5), roomAc(c, r, 41.5));
      assert.deepEqual(paneTilt(c, r, 41.5), paneTilt(c, r, 41.5));
      assert.equal(paneRoughness(c, r, 41.5), paneRoughness(c, r, 41.5));
    }
  }
  // Ranges: every seeded pick stays inside its band, and the grid is not uniform.
  const depths = new Set<number>();
  const roughs = new Set<number>();
  const tilts = new Set<number>();
  let blinds = 0;
  let acs = 0;
  const cells = 40 * 30;
  for (let c = 0; c < 40; c++) {
    for (let r = 1; r < 31; r++) {
      const d = roomDepth(c, r, 9.25);
      assert.ok(d >= GLASS.roomDepth[0] && d <= GLASS.roomDepth[1], `depth ${d}`);
      depths.add(d);
      const rough = paneRoughness(c, r, 9.25);
      assert.ok(rough >= GLASS.paneRough[0] && rough <= GLASS.paneRough[1], `rough ${rough}`);
      roughs.add(rough);
      const [tx, ty] = paneTilt(c, r, 9.25);
      assert.ok(Math.abs(tx) <= GLASS.tiltRad + 1e-9 && Math.abs(ty) <= GLASS.tiltRad + 1e-9, `tilt ${tx},${ty}`);
      tilts.add(tx);
      const b = roomBlinds(c, r, 9.25);
      assert.ok(b.drop >= GLASS.blindsDrop[0] && b.drop <= GLASS.blindsDrop[1], `drop ${b.drop}`);
      if (b.on) blinds++;
      const a = roomAc(c, r, 9.25);
      assert.ok(a.centre >= 0.3 && a.centre <= 0.7, `ac centre ${a.centre}`);
      assert.ok(a.span >= GLASS.acSpan[0] && a.span <= GLASS.acSpan[1], `ac span ${a.span}`);
      if (a.on) acs++;
    }
  }
  assert.ok(depths.size > cells * 0.9, `depths nearly unique: ${depths.size}`);
  assert.ok(roughs.size > cells * 0.9 && tilts.size > cells * 0.9, 'cells vary');
  // Shares land near their seeded probabilities, loosely (finite grid).
  assert.ok(Math.abs(blinds / cells - GLASS.blindsShare) < 0.05, `blinds share ${blinds / cells}`);
  assert.ok(Math.abs(acs / cells - GLASS.acShare) < 0.05, `ac share ${acs / cells}`);
});

test('the pixel-size fade gives detail → bands → wall average', () => {
  assert.deepEqual(glassFadeWeights(60), { detail: 1, bands: 1 });
  assert.deepEqual(glassFadeWeights(4), { detail: 0, bands: 0 });
  // Midpoints land at the smoothstep centre (0.5), each side of 16 px.
  const mid = glassFadeWeights((GLASS.fade.detail[0] + GLASS.fade.detail[1]) / 2);
  assert.ok(Math.abs(mid.detail - 0.5) < 1e-6, `detail mid ${mid.detail}`);
  const band = glassFadeWeights((GLASS.fade.bands[0] + GLASS.fade.bands[1]) / 2);
  assert.ok(band.detail === 0 && Math.abs(band.bands - 0.5) < 1e-6, `bands mid ${band.bands}`);
  // Monotonic, and detail never leads bands.
  let prevD = 0;
  let prevB = 0;
  for (let px = 0; px <= 64; px += 4) {
    const w = glassFadeWeights(px);
    assert.ok(w.detail >= prevD && w.bands >= prevB && w.detail <= w.bands, `px ${px}`);
    prevD = w.detail;
    prevB = w.bands;
  }
});

test('lit share scales with time of day and the cell hits its probability', () => {
  for (const seed of [3.5, 18.25, 77.75]) {
    assert.ok(litShare(seed, 0) < litShare(seed, 0.8) && litShare(seed, 0.8) <= litShare(seed, 1), `seed ${seed}`);
    assert.ok(litShare(seed, 1) <= 0.95, 'capped under certainty');
    for (const tod of [0, 0.5, 1]) {
      let lit = 0;
      let all = 0;
      for (let c = 0; c < 60; c++) for (let r = 1; r < 41; r++) { all++; if (roomLit(c, r, seed, tod)) lit++; }
      assert.ok(Math.abs(lit / all - litShare(seed, tod)) < 0.06, `seed ${seed} tod ${tod}: ${lit / all} vs ${litShare(seed, tod)}`);
    }
  }
  // Ground floor rooms stay dark like the facade's ground-floor windows.
  for (let c = 0; c < 50; c++) assert.equal(roomLit(c, 0, 12.25, 1), false);
});

test('Schlick fresnel: F0 at normal incidence, full at grazing', () => {
  assert.ok(Math.abs(schlickFresnel(1) - GLASS.f0) < 1e-9);
  assert.ok(Math.abs(schlickFresnel(0) - 1) < 1e-9);
  assert.ok(schlickFresnel(0.5) > GLASS.f0 && schlickFresnel(0.5) < 1);
});

test('flagged world swaps the wall materials; unflagged and flat tier are untouched', () => {
  const off = buildCityWorld(THREE, dataset());
  const offWall = off.group.getObjectByName('city:walls-masonry') as THREE.Mesh;
  assert.ok(!(offWall.material as { isMeshStandardNodeMaterial?: boolean }).isMeshStandardNodeMaterial);
  assert.equal((offWall.material as { normalNode?: unknown }).normalNode ?? null, null);
  off.dispose();

  for (const pbr of [false, true]) {
    const on = buildCityWorld(THREE, dataset(), { glass: true, pbr });
    for (const name of ['city:walls-masonry', 'city:walls-glass']) {
      const mesh = on.group.getObjectByName(name) as THREE.Mesh;
      const material = mesh.material as { isMeshStandardNodeMaterial?: boolean; normalNode?: unknown };
      assert.ok(material.isMeshStandardNodeMaterial, `${name} pbr=${pbr} is standard`);
      assert.ok(material.normalNode != null, `${name} pbr=${pbr} has the tilt normal`);
    }
    // Non-wall lit materials: standard only under the PBR lane.
    const roofs = on.group.getObjectByName('city:roofs') as THREE.Mesh;
    assert.equal(
      Boolean((roofs.material as { isMeshStandardNodeMaterial?: boolean }).isMeshStandardNodeMaterial),
      pbr,
      `roofs pbr=${pbr}`,
    );
    on.dispose();
  }
});

test('window material graphs compile to WGSL, both tiers and both flag states', async () => {
  const renderer = await stubRenderer();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  const compile = (mesh: THREE.Mesh) => {
    const material = mesh.material as THREE.Material;
    const b = new WGSLNodeBuilder(mesh, renderer);
    b.scene = mesh.parent ?? new THREE.Scene();
    b.camera = camera;
    b.material = material;
    b.context.material = material;
    b.fogNode = null;
    const started = performance.now();
    b.build();
    return { b, ms: performance.now() - started };
  };
  const sizes: Record<string, number> = {};
  for (const pbr of [false, true]) {
    for (const tier of ['full', 'flat'] as const) {
      const world = buildCityWorld(THREE, dataset(), { glass: true, pbr, glassTier: tier });
      const scene = new THREE.Scene();
      scene.add(world.sky, world.group);
      for (const name of ['city:walls-masonry', 'city:walls-glass']) {
        const mesh = world.group.getObjectByName(name) as THREE.Mesh;
        assert.ok(mesh, `${name} mesh`);
        const { b, ms } = compile(mesh);
        const size = b.fragmentShader?.length ?? 0;
        assert.ok(ms < 1000 && size > 400 && size < 80_000, `${name} ${tier} pbr=${pbr}: ${ms.toFixed(1)} ms, ${size} chars`);
        assert.match(b.fragmentShader ?? '', /fwidth/, `${name} ${tier} pbr=${pbr} uses the pixel fade`);
        sizes[`${name}:${tier}:${pbr}`] = size;
      }
      world.dispose();
    }
  }
  // The flat tier skips the room-box ray work: its fragment is smaller.
  assert.ok(
    sizes['city:walls-masonry:flat:false']! < sizes['city:walls-masonry:full:false']!,
    `flat ${sizes['city:walls-masonry:flat:false']} < full ${sizes['city:walls-masonry:full:false']}`,
  );
});

test('standalone and combined material sets dispose cleanly', () => {
  for (const pbr of [false, true]) {
    const materials = createGlassCityMaterials(THREE, { sunDirection: SUN, pbr });
    assert.ok(materials.masonry && materials.glass);
    materials.dispose();
  }
  const solo = createWindowMaterial(THREE, { grid: WINDOW_GRID.masonry, glassy: false, tier: 'flat' });
  solo.dispose();
});
