// Compiles the toon material's TSL graph to WGSL in node through three's own
// WGSLNodeBuilder (same trick as shader-graphs.test.ts), so a broken graph
// fails here rather than on the device. Also pins the SH probe's shape and
// the spec §2.1/§2.3 construction variants: two/three bands, occlusion
// on/off, rim on/off, flat-colour albedo.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { createToonMaterial, createToonRig, toonAmbientProbe, TOON_SH_BASIS } from './toon-material.ts';
import { CITY_COLORS } from './palette.ts';

// The dusk sun from docs/design/toon-look-spec.md §3 (same direction
// world/index.ts exports as SUN); passed in as data so this test stays
// standalone.
const SUN_DIR: readonly [number, number, number] = (() => {
  const v = [-0.62, 0.45, 0.64];
  const l = Math.hypot(v[0]!, v[1]!, v[2]!);
  return [v[0]! / l, v[1]! / l, v[2]! / l] as const;
})();

type Builder = { scene: unknown; camera: unknown; material: unknown; context: { material: unknown }; fogNode: unknown; build(): void; fragmentShader?: string };
const WGSLNodeBuilder = (THREE as unknown as { WGSLNodeBuilder: new (object: unknown, renderer: unknown) => Builder }).WGSLNodeBuilder;

const canvas = { width: 300, height: 150, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null } as unknown as HTMLCanvasElement;

async function makeCompiler() {
  const renderer = new THREE.WebGPURenderer({ canvas });
  await renderer.init().catch(() => undefined);
  // The two backend capabilities the builder asks for; node has no GPU.
  (renderer as unknown as { backend: { capabilities: unknown } }).backend.capabilities = { getUniformBufferLimit: () => 65_536 };
  (renderer as unknown as { hasFeature: () => boolean }).hasFeature = () => false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 200);
  camera.position.set(4, 4, 8);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(24 * 3).fill(0.5), 3));
  const mesh: THREE.Mesh = new THREE.Mesh(geometry, new THREE.MeshBasicNodeMaterial());
  scene.add(mesh);
  return (material: THREE.Material) => {
    mesh.material = material;
    const b = new WGSLNodeBuilder(mesh, renderer);
    b.scene = scene; b.camera = camera; b.material = material; b.context.material = material;
    // No node manager without a backend, so scene fog is left out.
    b.fogNode = null;
    const started = performance.now();
    b.build();
    return { ms: performance.now() - started, size: b.fragmentShader?.length ?? 0 };
  };
}

test('SH ambient probe: nine finite coefficients matching the hemisphere recipe', () => {
  const probe = toonAmbientProbe(THREE, SUN_DIR);
  assert.equal(probe.length, TOON_SH_BASIS.length);
  assert.equal(TOON_SH_BASIS.length, 9);
  for (const c of probe) {
    assert.ok(c instanceof THREE.Color);
    assert.ok([c.r, c.g, c.b].every(Number.isFinite), 'finite channels');
  }
  // Pole term: up reads sky, down reads ground -> K0 = (sky+ground)/2.
  const sky = new THREE.Color(CITY_COLORS.hemiSky);
  const ground = new THREE.Color(CITY_COLORS.hemiGround);
  assert.ok(Math.abs(probe[0]!.r - (sky.r + ground.r) / 2) < 1e-6);
  assert.ok(probe[2]!.b > 0, 'up slope keeps the cool sky sign');
  // The horizon ring dims the poles a touch (negative 3y²-1 coefficient).
  assert.ok(probe[6]!.r < 0 && probe[6]!.g < 0 && probe[6]!.b < 0);
});

test('rig + material: graphs build, uniforms bind, all variants compile to WGSL', async () => {
  const compile = await makeCompiler();
  const rig = createToonRig(THREE, { sunDirection: SUN_DIR });
  assert.equal(rig.uniforms.ambient.length, 9);
  // Uniform handles stay mutable for the debug overlay (spec §4).
  rig.uniforms.keyIntensity.value = 1.2;
  assert.equal(rig.uniforms.keyIntensity.value, 1.2);

  const variants: Record<string, Parameters<typeof createToonMaterial>[2]> = {
    'two-band default': {},
    'three bands': { bands: 3 },
    'half-Lambert': { halfLambert: true },
    'occlusion input': { occlusion: THREE.TSL.attribute('aOcc', 'float') },
    'rim off': { rim: false },
    'flat colour albedo': { color: 'brick' },
    'fill light on': { fill: true },
    'emissive input': { emissive: THREE.TSL.vec3(1, 0.5, 0) },
  };
  for (const [name, options] of Object.entries(variants)) {
    const toon = createToonMaterial(THREE, rig, options);
    assert.ok(toon.material.colorNode, `${name}: colorNode set`);
    assert.equal(typeof toon.uniforms.threshold.value, 'number', `${name}: threshold uniform binds`);
    const { ms, size } = compile(toon.material);
    assert.ok(ms < 200 && size > 400 && size < 20_000, `${name}: ${ms.toFixed(1)} ms, ${size} chars`);
  }

  // Rim-on graph must actually carry the rim terms.
  const rimOn = createToonMaterial(THREE, rig, { rim: true });
  const rimOff = createToonMaterial(THREE, rig, { rim: false });
  const on = compile(rimOn.material);
  const off = compile(rimOff.material);
  assert.ok(on.size > off.size, 'rim terms present only when enabled');
});
