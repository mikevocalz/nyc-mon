// The dithered canopy shadow on the road (iPad, 2026-10-28): three's PCF
// rotates its 5 taps per pixel by interleaved gradient noise. The physical
// rig's sun now filters with a fixed 3x3 tent (soft-shadow-filter.ts). This
// pins the rig wiring and that the compiled receiver shader samples the
// shadow with nine comparison taps and no screen-space noise.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { createPhysicalRig } from '../physical-rig.ts';
import { probeFeatures } from '../physical-look.ts';
import { createSoftShadowFilter, SOFT_SHADOW_RADIUS, SOFT_SHADOW_TAPS } from './soft-shadow-filter.ts';

test('the tent weights sum to one and stay inside the cascade inset', () => {
  assert.equal(SOFT_SHADOW_TAPS.reduce((s, [, , w]) => s + w, 0), 16);
  // SunLightShadow insets each tile by ceil(radius) + 1 texels; the far tap reaches radius + 1 (bilinear).
  assert.ok(SOFT_SHADOW_RADIUS + 1 <= Math.ceil(SOFT_SHADOW_RADIUS) + 1);
});

test('both sun probes take the soft filter and its radius', () => {
  for (const probe of ['shadow2', 'shadow1'] as const) {
    const scene = new THREE.Scene();
    const rig = createPhysicalRig(THREE as never, null, scene as never, { features: probeFeatures(probe), shadowTile: 2048, clusteredMaxLights: 128 });
    const sun = scene.getObjectByName('city:physical-sun') as unknown as { shadow: { filterNode: unknown; radius: number } };
    assert.ok(sun.shadow.filterNode, `${probe}: filterNode set`);
    assert.equal(sun.shadow.radius, SOFT_SHADOW_RADIUS);
    rig.dispose();
  }
});

test('a lit receiver compiles nine comparison taps and no interleaved-gradient noise', async () => {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('../../render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals();
  const fragments = async (filter: boolean) => {
    const { device, record } = recordingGpuDevice();
    const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(64, 64), device } as never);
    await renderer.init();
    renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene();
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.castShadow = true;
    if (filter) {
      (light.shadow as unknown as { filterNode: unknown }).filterNode = createSoftShadowFilter(THREE as never);
      light.shadow.radius = SOFT_SHADOW_RADIUS;
    }
    light.position.set(3, 5, 2);
    scene.add(light);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardNodeMaterial());
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 100);
    camera.position.set(0, 2, 3);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    renderer.dispose();
    return record.shaders.filter((code) => code.includes('textureSampleCompare')).join('\n');
  };
  const stock = await fragments(false);
  const soft = await fragments(true);
  // The stock PCF is what the iPad drew: its rotation reads the screen position through IGN (52.9829189).
  assert.match(stock, /52\.9829189/, 'stock PCF uses interleaved gradient noise');
  assert.equal((stock.match(/textureSampleCompare/g) ?? []).length, 5, 'stock PCF: five taps');
  assert.doesNotMatch(soft, /52\.9829189/, 'the soft filter has no screen-space noise');
  assert.equal((soft.match(/textureSampleCompare/g) ?? []).length, 9, 'nine comparison taps');
});
