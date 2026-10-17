// L1 "one light" rig: the committed sky JSONs are well-formed, the flag
// parses, both dome paths (HDR texture + JSON-colour fallback) compile to
// WGSL through three's own WGSLNodeBuilder, the baked env equirect puts the
// sun where the JSON says, and attachEnvironment degrades instead of
// throwing when the renderer can't do the HDR path.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { SKY_PRESETS } from '@acme/assets/skies';
import { parseCityDataset } from '../city-dataset.ts';
import { buildCityWorld, SUN } from './index.ts';
import {
  bakeSkyEquirect,
  createSkyDomeMaterial,
  createSkyRig,
  evalSkyIrradiance,
  EXPERIMENTAL_SKY_RIG,
  FOG_DENSITY,
  parseSkyRigFlag,
  skyEquirectUV,
  skyGradientRadiance,
  SKY_RIG,
  sunKeyLight,
} from './sky-rig.ts';

type Builder = {
  scene: unknown;
  camera: unknown;
  material: unknown;
  context: { material: unknown };
  fogNode: unknown;
  build(): void;
  fragmentShader?: string;
  uniforms: { vertex: unknown[]; fragment: unknown[] };
};
const WGSLNodeBuilder = (THREE as unknown as { WGSLNodeBuilder: new (object: unknown, renderer: unknown) => Builder }).WGSLNodeBuilder;

async function stubRenderer() {
  const canvas = {
    width: 300,
    height: 150,
    style: {},
    addEventListener() {},
    removeEventListener() {},
    getContext: () => null,
  } as unknown as HTMLCanvasElement;
  const renderer = new THREE.WebGPURenderer({ canvas });
  await renderer.init().catch(() => undefined);
  const backend = (renderer as unknown as { backend: { capabilities: unknown; utils: unknown } }).backend;
  backend.capabilities = { getUniformBufferLimit: () => 65_536 };
  // The builder asks backend.utils for texture sample metadata; node has no GPU.
  backend.utils = { getTextureSampleData: () => ({ samples: 1, primarySamples: 1, isMSAA: false }) };
  (renderer as unknown as { hasFeature: () => boolean }).hasFeature = () => false;
  return renderer;
}

function boundValues(builder: Builder): unknown[] {
  const vertex = builder.uniforms.vertex ?? [];
  const fragment = builder.uniforms.fragment ?? [];
  return [...vertex, ...fragment].map((u) => (u as { value?: unknown }).value);
}

const dataset = () =>
  parseCityDataset(
    JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')),
  );

test('sky rig flag is opt-in and parses the truthy set', () => {
  for (const on of ['1', 'true', 'on', 'yes', ' TRUE ', 'On']) {
    assert.equal(parseSkyRigFlag(on), true, on);
  }
  for (const off of [undefined, null, '', '0', 'false', 'off', 'nope', '  ']) {
    assert.equal(parseSkyRigFlag(off), false, String(off));
  }
  assert.equal(EXPERIMENTAL_SKY_RIG, parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_SKY_RIG));
});

test('each committed sky JSON loads with a unit sunDirection and 9 SH coefficients', () => {
  const names = ['morning', 'dusk', 'night'] as const;
  assert.deepEqual(Object.keys(SKY_PRESETS), names);
  for (const name of names) {
    const sky = SKY_PRESETS[name];
    assert.ok(sky.id.startsWith('qwantani_'), name);
    assert.ok(sky.source.fileUrl.startsWith('https://'), `${name} source url`);
    const len = Math.hypot(
      sky.sunDirection[0] ?? 0,
      sky.sunDirection[1] ?? 0,
      sky.sunDirection[2] ?? 0,
    );
    assert.ok(Math.abs(len - 1) < 1e-4, `${name} sunDirection |v|=${len}`);
    assert.ok(
      Math.abs(Math.asin(sky.sunDirection[1] ?? 0) * (180 / Math.PI) - sky.sunElevationDeg) < 0.2,
      `${name} sunElevationDeg`,
    );
    assert.equal(sky.skyIrradianceSH.length, 9, `${name} SH count`);
    for (const coeff of sky.skyIrradianceSH) {
      assert.equal(coeff.length, 3, `${name} SH row`);
      assert.ok(coeff.every((v) => Number.isFinite(v)), `${name} SH finite`);
    }
    assert.equal(sky.horizonColor.length, 3, `${name} horizonColor`);
    assert.ok(sky.horizonColor.every((v) => Number.isFinite(v) && v >= 0), `${name} horizon rgb`);
    // The README's promise behind picking this trio: a real compact disc, not a blob.
    assert.ok(sky.sunClusterSpreadDeg > 0 && sky.sunClusterSpreadDeg < 0.5, `${name} disc spread`);
    assert.ok(sky.shConvention.cosineLobe.foldedIn === true, `${name} cosine lobe folded in`);
  }
});

test('the dome UV convention matches the measured sun pixel', () => {
  // decode-hdr verified the morning disc's brightest texel at u≈0.6001 and,
  // counting rows from the top, v≈0.3877 — v = asin(y)/π+0.5 is the same
  // coordinate from the bottom (1 − 0.3877 = 0.6123).
  const [u, v] = skyEquirectUV(SKY_PRESETS.morning.sunDirection);
  assert.ok(Math.abs(u - 0.6001) < 0.002, `u=${u}`);
  assert.ok(Math.abs(v - 0.6123) < 0.002, `v=${v}`);
  const [uZen, vZen] = skyEquirectUV([0, 1, 0]);
  assert.equal(vZen, 1);
  assert.ok(uZen >= 0 && uZen <= 1);
});

test('evalSkyIrradiance reproduces the JSON convention and gradient radiance is positive', () => {
  for (const name of ['morning', 'dusk', 'night'] as const) {
    const sky = SKY_PRESETS[name];
    const up = evalSkyIrradiance(sky, [0, 1, 0]);
    assert.ok(up.every((v) => Number.isFinite(v) && v > 0), `${name} zenith irradiance ${up}`);
    const toward = evalSkyIrradiance(sky, sky.sunDirection);
    assert.ok(toward.every((v) => Number.isFinite(v) && v > 0), `${name} sunward irradiance`);
    const gradient = skyGradientRadiance(sky);
    assert.ok(gradient.horizon.every((v) => v > 0), `${name} horizon`);
    assert.ok(gradient.mid.every((v) => v > 0), `${name} mid`);
    assert.ok(gradient.zenith.every((v) => v > 0), `${name} zenith`);
  }
});

test('sun key light is JSON-derived and dusk stays at the unflagged anchor', () => {
  const dusk = sunKeyLight(SKY_PRESETS.dusk);
  const dirLen = Math.hypot(...dusk.direction);
  assert.ok(Math.abs(dirLen - 1) < 1e-6, `direction |v|=${dirLen}`);
  assert.equal(dusk.intensity, SKY_RIG.sunKeyLevel);
  const peak = Math.max(...dusk.color);
  assert.equal(peak, 1, 'colour is irradiance normalised to its peak');
  const morning = sunKeyLight(SKY_PRESETS.morning);
  const night = sunKeyLight(SKY_PRESETS.night);
  assert.ok(morning.intensity > dusk.intensity, 'morning sun is stronger than the sunset key');
  assert.ok(night.intensity > 0, 'night key stays positive');
  // Dusk's irradiance is warm — red peak; the moonrise key stays cooler.
  assert.ok(dusk.color[0] === 1, 'dusk key peaks red');
});

test('rig builds FogExp2, a non-shadowing sun and a fallback dome', () => {
  const rig = createSkyRig(THREE, { sky: 'night' });
  assert.ok(
    rig.sunDirection.every(
      (v, i) => Math.abs(v - (SKY_PRESETS.night.sunDirection[i] ?? 0)) < 1e-6,
    ),
  );
  assert.equal(rig.sun.castShadow, false);
  const pos = [rig.sun.position.x, rig.sun.position.y, rig.sun.position.z].map((v) => v / 1000);
  assert.ok(
    pos.every((v, i) => Math.abs(v - (rig.sunDirection[i] ?? 0)) < 1e-6),
    'sun sits on its direction',
  );
  assert.ok(rig.fog instanceof THREE.FogExp2);
  assert.equal(rig.fog.density, FOG_DENSITY);
  assert.ok(
    Math.abs(rig.fog.color.r - (SKY_PRESETS.night.horizonColor[0] ?? 0)) < 1e-3,
    'fog colour',
  );
  assert.ok(rig.dome instanceof THREE.MeshBasicNodeMaterial);
  assert.ok(rig.dome.colorNode, 'dome has a colour node');
  assert.equal(rig.equirect, null);
  rig.dispose();
});

test('buildCityWorld swaps dome, fog and sun only when the rig is on', () => {
  const unflagged = buildCityWorld(THREE, dataset());
  assert.ok(unflagged.fog instanceof THREE.Fog, 'unflagged keeps linear Fog');
  assert.equal(unflagged.skyRig, null);
  unflagged.setViewDistance(220, 3000);
  assert.ok(unflagged.fog instanceof THREE.Fog && unflagged.fog.near > 0);
  unflagged.dispose();

  const flagged = buildCityWorld(THREE, dataset(), { skyRig: true, sky: 'dusk' });
  assert.ok(flagged.fog instanceof THREE.FogExp2, 'flagged swaps to FogExp2');
  const rigged = flagged.skyRig;
  assert.ok(rigged);
  assert.equal(flagged.sky.material, rigged.dome, 'dome material replaced');
  const riggedDir = rigged.sunDirection;
  assert.notDeepEqual(riggedDir, SUN, 'flagged world no longer uses the hardcoded SUN');
  const sun = flagged.group.children.find(
    (c) => (c as { isDirectionalLight?: boolean }).isDirectionalLight,
  ) as THREE.DirectionalLight;
  assert.ok(sun, 'sun light in group');
  const pos = [sun.position.x, sun.position.y, sun.position.z].map((v) => v / 1000);
  assert.ok(
    pos.every((v, i) => Math.abs(v - (riggedDir[i] ?? 0)) < 1e-6),
    'group sun follows the JSON',
  );
  flagged.setViewDistance(220, 3000); // FogExp2 branch: no near/far writes
  flagged.dispose();
});

test('fallback dome compiles to WGSL with the JSON uniforms bound', async () => {
  const renderer = await stubRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  const material = createSkyDomeMaterial(THREE, SKY_PRESETS.dusk);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 4), material);
  const b = new WGSLNodeBuilder(mesh, renderer);
  b.scene = scene;
  b.camera = camera;
  b.material = material;
  b.context.material = material;
  b.fogNode = null;
  b.build();
  assert.ok((b.fragmentShader?.length ?? 0) > 400, 'fragment shader generated');
  const values = boundValues(b);
  const sun = sunKeyLight(SKY_PRESETS.dusk);
  assert.ok(
    values.some(
      (v) =>
        v instanceof THREE.Vector3 &&
        Math.abs(v.x - sun.direction[0]) < 1e-6 &&
        Math.abs(v.y - sun.direction[1]) < 1e-6,
    ),
    'sunDirection uniform bound',
  );
  // horizon + mid + zenith + sun tint colours.
  const colors = values.filter((v) => v instanceof THREE.Color);
  assert.ok(colors.length >= 4, `${colors.length} colour uniforms bound`);
  assert.ok(
    colors.some(
      (v) => Math.abs((v as THREE.Color).r - (SKY_PRESETS.dusk.horizonColor[0] ?? 0)) < 1e-4,
    ),
    'JSON horizon colour bound',
  );
});

test('texture dome compiles to WGSL and binds the equirect', async () => {
  const renderer = await stubRenderer();
  const equirect = new THREE.DataTexture(
    new Uint16Array(4 * 4 * 4).fill(0x3c00),
    4,
    4,
    THREE.RGBAFormat,
    THREE.HalfFloatType,
  );
  equirect.mapping = THREE.EquirectangularReflectionMapping;
  equirect.flipY = true; // HDRLoader's orientation
  const material = createSkyDomeMaterial(THREE, SKY_PRESETS.morning, equirect);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 4), material);
  const b = new WGSLNodeBuilder(mesh, renderer);
  b.scene = new THREE.Scene();
  b.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  b.material = material;
  b.context.material = material;
  b.fogNode = null;
  b.build();
  const wgsl = b.fragmentShader ?? '';
  assert.ok(wgsl.length > 400, 'fragment shader generated');
  assert.match(wgsl, /texture_2d/, 'texture binding declared');
  const values = boundValues(b);
  assert.ok(values.some((v) => v === equirect), 'equirect texture uniform bound');
  assert.ok(values.some((v) => v instanceof THREE.Color), 'haze/sun colours still bound');
});

test('baked env equirect puts the measured sun disc at the JSON direction', () => {
  const sky = SKY_PRESETS.dusk;
  const tex = bakeSkyEquirect(THREE, sky);
  const { width, height, data } = tex.image as { width: number; height: number; data: Uint16Array };
  assert.equal(width, SKY_RIG.envWidth);
  assert.equal(height, SKY_RIG.envHeight);
  assert.equal(tex.type, THREE.HalfFloatType);
  assert.equal(tex.flipY, false, 'baked rows are stored bottom-up');
  const fromHalf = THREE.DataUtils.fromHalfFloat;
  const lum = (i: number) =>
    fromHalf(data[i] ?? 0) * 0.2126 +
    fromHalf(data[i + 1] ?? 0) * 0.7152 +
    fromHalf(data[i + 2] ?? 0) * 0.0722;
  // Find the brightest texel — the sun disc must be it.
  let peak = -1;
  let peakIdx = 0;
  for (let i = 0; i < data.length; i += 4) {
    const l = lum(i);
    if (l > peak) {
      peak = l;
      peakIdx = i;
    }
  }
  const peakRow = Math.floor(peakIdx / 4 / width);
  const peakCol = (peakIdx / 4) % width;
  const [u, v] = skyEquirectUV(sky.sunDirection);
  assert.ok(
    Math.abs(peakCol / width - u) < 2 / width && Math.abs(peakRow / height - v) < 2 / height,
    `disc at col ${peakCol} row ${peakRow}, expected u=${u.toFixed(3)} v=${v.toFixed(3)}`,
  );
  assert.ok(peak > 1, `sun disc radiance ${peak} is over-bright`);
  // The sky far from the disc is ordinary sky, not clamped.
  const farIdx = 4 * (Math.floor(height * 0.3) * width + Math.floor(width * ((u + 0.5) % 1)));
  assert.ok(lum(farIdx) > 0 && lum(farIdx) < peak, 'background sky below the disc level');
  tex.dispose();
});

test('attachEnvironment degrades: no renderer, failed load, uninitialised backend', async () => {
  const scene = new THREE.Scene();
  const rig = createSkyRig(THREE, { sky: 'morning', loadEquirect: async () => null });
  assert.equal(await rig.attachEnvironment(null as never, scene), false, 'null renderer');
  assert.equal(scene.environment, null);

  const renderer = await stubRenderer();
  assert.equal(await rig.attachEnvironment(renderer, scene), false, 'backend not initialised');
  assert.equal(scene.environment, null, 'no env leaks on failure');
  assert.equal(rig.environment, null);
  rig.dispose();
  assert.equal(await rig.attachEnvironment(renderer, scene), false, 'disposed rig no-ops');
});

test('HDR loader failure keeps the JSON dome', async () => {
  const renderer = await stubRenderer();
  const scene = new THREE.Scene();
  let attempted = 0;
  const rig = createSkyRig(THREE, {
    sky: 'night',
    loadEquirect: async () => {
      attempted++;
      throw new Error('simulated upload failure');
    },
  });
  const fallbackNode = rig.dome.colorNode;
  assert.equal(await rig.attachEnvironment(renderer, scene), false);
  assert.equal(attempted, 1, 'loader was attempted once');
  assert.equal(rig.equirect, null, 'no texture recorded');
  assert.equal(rig.dome.colorNode, fallbackNode, 'dome still on the fallback graph');
  assert.equal(scene.environment, null);
  rig.dispose();
});
