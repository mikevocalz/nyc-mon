// Slop-grade city, light rig: the flag and probe tables (N3, Phase 0), the
// presets resolving only through @acme/theme (N2), the hex-literal guard on
// every file this lane touches (N2), and the rig's three objects built
// without a GPU. A frame on iPhone 17 / iPad Pro stays device-pending.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three/webgpu';
import { physicalCityLight } from '@acme/theme';
import { SunLight } from 'three/examples/jsm/lights/SunLight.js';
import { SkyMesh } from 'three/examples/jsm/objects/SkyMesh.js';
import { parseSkyRigFlag } from './sky-rig.ts';
import {
  DEFAULT_PHYSICAL_PRESET,
  DEVICE_LANE_PROBES,
  EXPERIMENTAL_WORLD_PHYSICAL,
  fullPhysicalFeatures,
  parsePhysicalPreset,
  parseWorldProbe,
  physicalRendererParams,
  PHYSICAL_GRADE,
  PHYSICAL_LIGHT,
  PHYSICAL_PRESET_IDS,
  PHYSICAL_RIG,
  physicalFeaturesFor,
  probeFeatures,
  RIG_PROBES,
  shadowFarForAltitude,
  sunShadowTile,
  type PhysicalFeatures,
} from './physical-look.ts';
import { PHYSICAL_NIGHT_SKY, PHYSICAL_PRESETS } from './physical-presets.ts';
import { applyPhysicalShadowRoles, cityUniforms, createPhysicalRig, swapInstanceMatricesToStorage } from './physical-rig.ts';
import { createTimeOfDayStore } from './time-of-day.store.ts';

const full = fullPhysicalFeatures(false);

test('the master flag is opt-in on the shared truth table', () => {
  assert.equal(EXPERIMENTAL_WORLD_PHYSICAL, parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_PHYSICAL));
  assert.equal(physicalFeaturesFor(false, null, true), null, 'flag off, no probe: today\'s path');
  assert.deepEqual(physicalFeaturesFor(true, null, false), fullPhysicalFeatures(false));
  assert.equal(physicalFeaturesFor(true, null, true)?.ssr, true, 'SSR follows the tier');
});

test('renderer params: reversed depth only for the full stack', () => {
  assert.deepEqual(physicalRendererParams(false, null), {});
  assert.deepEqual(physicalRendererParams(true, null), { reversedDepthBuffer: true });
  assert.deepEqual(physicalRendererParams(true, 'ssr'), {}, 'a probe keeps today\'s depth buffer');
  assert.deepEqual(physicalRendererParams(false, 'aces'), {});
});

test('probe names: exact, case-insensitive, unknown is null', () => {
  for (const name of [...RIG_PROBES, ...DEVICE_LANE_PROBES]) {
    assert.equal(parseWorldProbe(name), name);
    assert.equal(parseWorldProbe(` ${name.toUpperCase()} `), name);
  }
  for (const value of [undefined, null, '', '1', 'true', 'shadow', 'ssr2', 'all']) {
    assert.equal(parseWorldProbe(value), null, String(value));
  }
});

test('each rig probe turns on exactly its feature and the ones it needs', () => {
  const on = (f: PhysicalFeatures) =>
    Object.entries(f).filter(([, v]) => v !== false && v !== 0).map(([k, v]) => (k === 'sunShadow' ? `sunShadow${v}` : k)).sort();
  const expected: Record<string, string[]> = {
    srgb: ['srgbOutput'],
    aces: ['pipeline'],
    shadow1: ['sunShadow1'],
    shadow2: ['sunShadow2'],
    bgnull: ['colorBackground', 'sunShadow2'],
    pmrem: ['skyPmrem'],
    mrt: ['mrt', 'pipeline'],
    ssr: ['mrt', 'pipeline', 'ssr'],
    bloom: ['bloom', 'pipeline'],
    clustered: ['clustered'],
    storage: ['storage'],
    msaa: ['msaaDiscard', 'pipeline'],
  };
  for (const probe of RIG_PROBES) assert.deepEqual(on(probeFeatures(probe)), expected[probe], probe);
  for (const probe of DEVICE_LANE_PROBES) assert.deepEqual(on(probeFeatures(probe)), [], probe);
  // A probe wins over the master flag, so a probe build measures one feature.
  assert.deepEqual(physicalFeaturesFor(true, 'srgb', true), probeFeatures('srgb'));
});

test('presets resolve their colours only through @acme/theme (N2)', () => {
  assert.deepEqual([...PHYSICAL_PRESET_IDS], ['golden', 'midday', 'twilight', 'midnight']);
  assert.equal(DEFAULT_PHYSICAL_PRESET, 'twilight', 'G2 default');
  for (const id of PHYSICAL_PRESET_IDS) {
    const p = PHYSICAL_PRESETS[id];
    assert.deepEqual(p.colors, { ...physicalCityLight[id] }, id);
    for (const value of Object.values(p.colors)) assert.match(value, /^#[0-9A-F]{6}$/, `${id} ${value}`);
    assert.equal(p.grade, PHYSICAL_GRADE[id]);
    assert.equal(p.sunIntensity, PHYSICAL_LIGHT[id].sunIntensity);
    assert.ok(Math.abs(Math.hypot(...p.sunDirection) - 1) < 1e-12, `${id} sun direction is unit`);
    assert.ok(p.sunDirection[1] > 0, `${id} sun above the horizon`);
  }
  assert.equal(PHYSICAL_NIGHT_SKY, physicalCityLight.nightSky);
  assert.equal(parsePhysicalPreset('MIDNIGHT'), 'midnight');
  assert.equal(parsePhysicalPreset('noon'), 'twilight');
});

test('presets pin Slop\'s measured values (js/lighting.js, js/post-processing.js)', () => {
  assert.deepEqual(PHYSICAL_LIGHT.twilight.sunDir, [-0.52, 0.36, -0.77]);
  assert.equal(PHYSICAL_LIGHT.twilight.sunIntensity, 3.1);
  assert.equal(PHYSICAL_LIGHT.midday.fogDensity, 0.00018);
  assert.equal(PHYSICAL_LIGHT.midnight.skyExposure, 0.022);
  assert.equal(PHYSICAL_LIGHT.golden.interiorGlow, 0.48);
  assert.deepEqual(PHYSICAL_GRADE.twilight, { exposure: 1.06, contrast: 1.10, saturation: 1.08, balance: [1.025, 0.995, 1.015], bloom: 0.28, threshold: 1.05 });
  assert.equal(physicalCityLight.golden.sun, '#FFCA92');
  assert.equal(physicalCityLight.midnight.fog, '#0C1424');
  assert.equal(physicalCityLight.nightSky, '#0B1528');
});

test('no hex literal outside tokens.ts in the files this lane touches (N2)', () => {
  const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
  const files = [
    './physical-look.ts', './physical-presets.ts', './physical-rig.ts', './time-of-day.store.ts',
    '../city-scene.ts', '../post/pipeline.ts', '../perf/tier.ts',
  ].map(here);
  const hex = /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b|0x[0-9a-fA-F]{6}\b/;
  for (const sample of ["sunColor: '#FFCA92'", 'new Color(0xffca92)', "fill: '#0A1230D9'"]) assert.match(sample, hex, sample);
  for (const file of files) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      assert.doesNotMatch(line, hex, `${file}:${i + 1}`);
    });
  }
});

test('shadow tile: the tier caps it, the device atlas limit lowers it (js/lighting.js rule)', () => {
  assert.equal(sunShadowTile(3072, 8192), 3072);
  assert.equal(sunShadowTile(3072, 6144), 3072);
  assert.equal(sunShadowTile(3072, 6143), 2048);
  assert.equal(sunShadowTile(3072, undefined), 2048, 'unreadable limit falls back to 4096');
  assert.equal(sunShadowTile(2048, 16_384), 2048, 'the phone tier never goes above its row');
});

test('shadow far plane follows camera altitude between 300 and 720 m', () => {
  assert.equal(shadowFarForAltitude(0), 300);
  assert.equal(shadowFarForAltitude(100), 420);
  assert.equal(shadowFarForAltitude(1000), 720);
  assert.equal(shadowFarForAltitude(-5), 300);
  assert.equal(shadowFarForAltitude(Number.NaN), 300);
});

test('time-of-day store holds the preset, twilight first, rejects unknown ids', () => {
  const store = createTimeOfDayStore();
  assert.equal(store.getState().preset, 'twilight');
  store.getState().setPreset('midnight');
  assert.equal(store.getState().preset, 'midnight');
  store.getState().setPreset('noon' as never);
  assert.equal(store.getState().preset, 'midnight');
});

test('the full rig without a renderer: SkyMesh, SunLight with two cascades, hemisphere, preset uniforms', () => {
  const scene = new THREE.Scene();
  const priorFog = new THREE.Fog(0, 1, 2);
  scene.fog = priorFog;
  const rig = createPhysicalRig(THREE, null, scene, { features: full, shadowTile: 2048, clusteredMaxLights: 128 });
  assert.ok(rig.sky instanceof SkyMesh);
  assert.equal(rig.sky.scale.x, PHYSICAL_RIG.skyScale);
  assert.equal(rig.sky.cloudElevation.value, PHYSICAL_RIG.cloudElevation);
  assert.ok(rig.sun instanceof SunLight);
  assert.equal(rig.sun.castShadow, true);
  assert.equal(rig.sun.shadow.mapSize.x, 2048);
  assert.equal(rig.sun.shadow.normalBias, 0.05);
  assert.ok(rig.hemi instanceof THREE.HemisphereLight);
  assert.ok(scene.fog instanceof THREE.FogExp2, 'aerial haze replaces the world fog');
  assert.equal(rig.environment, null, 'no renderer, no bake');
  assert.equal(scene.background, null);

  // The default preset reached every consumer.
  const twilight = PHYSICAL_PRESETS.twilight;
  assert.equal(rig.preset, 'twilight');
  assert.ok(rig.sun.color.equals(new THREE.Color(twilight.colors.sun)));
  assert.equal(rig.sun.intensity, twilight.sunIntensity);
  assert.ok(rig.hemi.groundColor.equals(new THREE.Color(twilight.colors.hemiGround)));
  assert.equal(rig.uniforms.uInteriorGlow.value, twilight.interiorGlow);
  assert.equal(rig.sky.turbidity.value, twilight.turbidity);

  rig.applyPreset('golden');
  const golden = PHYSICAL_PRESETS.golden;
  assert.equal(rig.preset, 'golden');
  assert.ok(rig.sun.color.equals(new THREE.Color(golden.colors.sun)));
  assert.equal(rig.uniforms.uRoadWetness.value, golden.roadWetness);
  assert.ok(rig.uniforms.uSkySunDir.value.equals(new THREE.Vector3(...golden.sunDirection)));
  assert.equal((scene.fog as THREE.FogExp2).density, golden.fogDensity);
  assert.equal(rig.sun.position.length().toFixed(6), '1.000000', 'SunLight points from a unit direction');

  rig.update(100, 0, 0);
  assert.equal(rig.sun.shadow.camera.far, 420);

  // The materials lane reads the same uniform nodes.
  assert.equal(cityUniforms(THREE), rig.uniforms);

  rig.dispose();
  assert.equal(scene.fog, priorFog, 'dispose restores the world fog');
  assert.equal(scene.getObjectByName('city:physical-sky'), undefined);
  assert.equal(scene.getObjectByName('city:physical-sun'), undefined);
  rig.dispose();
});

test('the rig mounts only the features it is given', () => {
  const scene = new THREE.Scene();
  const none = probeFeatures('srgb');
  const rig = createPhysicalRig(THREE, null, scene, { features: none, shadowTile: 2048, clusteredMaxLights: 128 });
  assert.equal(rig.sky, null);
  assert.equal(rig.sun, null);
  assert.equal(rig.hemi, null);
  assert.equal(scene.children.length, 0);
  rig.dispose();

  const single = createPhysicalRig(THREE, null, scene, { features: probeFeatures('shadow1'), shadowTile: 2048, clusteredMaxLights: 128 });
  assert.ok(single.sun instanceof THREE.DirectionalLight, 'shadow1 is a one-map DirectionalLight');
  assert.equal(single.sun.castShadow, true);
  single.update(30, 120, -40);
  const target = (single.sun as THREE.DirectionalLight).target.position;
  assert.deepEqual([target.x, target.z], [120, -40], 'the one map follows the focus');
  single.dispose();
});

test('with a renderer: SunLightNode registered once, PMREM baked into one reused target, fog node, clustered lighting', () => {
  const calls: unknown[] = [];
  const proto = THREE.PMREMGenerator.prototype as unknown as { fromScene: (scene: unknown, sigma: unknown, near: unknown, far: unknown, options: { renderTarget?: THREE.RenderTarget | null }) => unknown };
  const original = proto.fromScene;
  proto.fromScene = function (_scene: unknown, sigma: unknown, near: unknown, far: unknown, options: { renderTarget?: THREE.RenderTarget | null }) {
    calls.push({ sigma, near, far, reused: options.renderTarget ?? null });
    return options.renderTarget ?? new THREE.RenderTarget(4, 4);
  };
  try {
    const registered = new Map<unknown, unknown>();
    const renderer = {
      reversedDepthBuffer: true,
      library: {
        getLightNodeClass: (light: unknown) => registered.get(light) ?? null,
        addLight: (node: unknown, light: unknown) => { registered.set(light, node); },
      },
      lighting: new THREE.Lighting(),
      backend: { device: { limits: { maxTextureDimension2D: 8192 } } },
    } as unknown as THREE.WebGPURenderer;
    const priorLighting = renderer.lighting;
    const scene = new THREE.Scene();
    const rig = createPhysicalRig(THREE, renderer, scene, { features: full, shadowTile: 3072, clusteredMaxLights: 256 });
    assert.equal(registered.get(SunLight)?.constructor !== undefined, true, 'SunLightNode registered');
    assert.equal(rig.shadowTile, 3072, '8192 limit fits the 6144 atlas');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { sigma: 0, near: 0.1, far: 100, reused: null });
    assert.ok(rig.environment);
    assert.equal(scene.environment, rig.environment);
    assert.equal(scene.environmentIntensity, PHYSICAL_PRESETS.twilight.envIntensity);
    assert.ok((scene as unknown as { fogNode: unknown }).fogNode, 'aerial fog node attached after the bake');
    assert.equal(rig.sky!.showSunDisc.value, 1, 'the disc is back on after the bake');
    assert.equal(rig.sky!.parent, scene, 'the sky returns to the scene after the bake');
    const lighting = renderer.lighting as unknown as { maxLights: number; tileSize: number; zSlices: number; maxLightsPerCluster: number };
    assert.deepEqual(
      [lighting.maxLights, lighting.tileSize, lighting.zSlices, lighting.maxLightsPerCluster],
      [256, 32, 28, 48],
    );

    const env = rig.environment;
    rig.applyPreset('midnight');
    assert.equal(calls.length, 2);
    assert.equal(rig.environment, env, 'the preset change rebakes into the same target');
    rig.applyPreset('midnight');
    assert.equal(calls.length, 2, 'same preset, no rebake');

    // A second rig on the same renderer does not register the node again.
    const again = createPhysicalRig(THREE, renderer, new THREE.Scene(), { features: probeFeatures('shadow2'), shadowTile: 2048, clusteredMaxLights: 128 });
    assert.equal(registered.size, 1);
    again.dispose();

    rig.dispose();
    assert.equal(renderer.lighting, priorLighting, 'dispose restores the renderer lighting');
    assert.equal(scene.environment, null);
    assert.equal((scene as unknown as { fogNode?: unknown }).fogNode, undefined, 'fog node restored to unset');
  } finally {
    proto.fromScene = original;
  }
});

test('shadow roles: opaque meshes cast, flat ground layers and the sky do not', () => {
  const root = new THREE.Group();
  const mesh = (name: string, transparent = false) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ transparent }));
    m.name = name;
    root.add(m);
    return m;
  };
  const walls = mesh('city:walls-masonry');
  const roads = mesh('city:roads');
  const sky = mesh('city:sky');
  const glow = mesh('living-city:lamp-glow', true);
  assert.equal(applyPhysicalShadowRoles(root), 1);
  assert.deepEqual([walls.castShadow, walls.receiveShadow], [true, true]);
  assert.deepEqual([roads.castShadow, roads.receiveShadow], [false, true]);
  assert.deepEqual([sky.castShadow, sky.receiveShadow], [false, false]);
  assert.equal(glow.castShadow, false);
});

test('storage swap: WebGPU backend only, every InstancedMesh once, same matrices', () => {
  const root = new THREE.Group();
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 3);
  instanced.setMatrixAt(1, new THREE.Matrix4().makeTranslation(4, 5, 6));
  root.add(instanced, new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  const before = Array.from(instanced.instanceMatrix.array);
  const webgl = { backend: { isWebGLBackend: true } } as unknown as THREE.WebGPURenderer;
  assert.equal(swapInstanceMatricesToStorage(THREE, webgl, root), 0);
  const webgpu = { backend: { isWebGPUBackend: true } } as unknown as THREE.WebGPURenderer;
  assert.equal(swapInstanceMatricesToStorage(THREE, webgpu, root), 1);
  assert.ok(instanced.instanceMatrix instanceof THREE.StorageInstancedBufferAttribute);
  assert.deepEqual(Array.from(instanced.instanceMatrix.array), before);
  assert.equal(swapInstanceMatricesToStorage(THREE, webgpu, root), 0, 'already swapped');
});
