// "Look at textures on the walls, it's glitching" (iPad, 2026-10-28). The
// default build (physical + vd) walked along 125th Street on the recording
// GPU device at the iPad drawing buffer: every wall-hugging draw keeps its
// material, its material state, its UVs and its depth offset from frame to
// frame, so nothing the CPU does swaps or re-biases a wall while the Caller
// walks. The causes found were in the shaders (world/vd-materials.ts course
// footprint and flat facade data, world/physical/tsl-common.ts line helpers,
// world/physical/facelift.ts sub-pixel lines) and the reversed-depth polygon
// offsets (world/reversed-depth-offset.ts); this pins the last and the
// shader inputs it can see.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

process.env.EXPO_PUBLIC_WORLD_PHYSICAL = '1';
delete process.env.EXPO_PUBLIC_WORLD_VD;
delete process.env.EXPO_PUBLIC_WORLD_PROBE;
delete process.env.EXPO_PUBLIC_WORLD_TIER;

const WALLS = ['city:walls-masonry', 'city:walls-glass', 'city:facelift', 'city:street-detail', 'city:contact-shadows'];
const GROUND = ['city:roads', 'city:sidewalks', 'city:areas', 'city:contact-shadows', 'city:lamp-pools'];

type Mat = {
  uuid: string; version: number; polygonOffset: boolean; polygonOffsetFactor: number; polygonOffsetUnits: number;
  side: number; depthWrite: boolean; depthTest: boolean; transparent: boolean; alphaTest: number; visible: boolean;
};
type Attr = { array: ArrayLike<number>; version: number } | undefined;
type Obj = {
  name: string; visible: boolean; material: Mat;
  geometry: { attributes: Record<string, Attr>; drawRange: { start: number; count: number } };
};

const snapshot = (o: Obj) => {
  const m = o.material;
  const uv = o.geometry.attributes.uv;
  return JSON.stringify({
    visible: o.visible,
    material: [m.uuid, m.version, m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits, m.side, m.depthWrite, m.depthTest, m.transparent, m.alphaTest, m.visible],
    uv: uv ? [uv.version, uv.array.length] : null,
    // Walls draw whole; a band swap on a wall would show as a moving range.
    range: o.name === 'city:contact-shadows' || o.name === 'city:street-detail' ? null : [o.geometry.drawRange.start, o.geometry.drawRange.count],
  });
};

test('walking a facade: wall materials, UVs and depth offsets hold still; offsets face the camera under reversed depth', async () => {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('./render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals();
  const THREE = await import('three/webgpu');
  const { parseCityDataset } = await import('./city-dataset.ts');
  const { createCityScene } = await import('./city-scene.ts');
  const { physicalRendererParams } = await import('./world/physical-look.ts');
  const { advanceNodeFrame } = await import('@acme/ui/three/internals');
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('./data/harlem-apollo.json', import.meta.url), 'utf8')));
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(2732, 2048), device, antialias: true, ...physicalRendererParams() } as never);
  await renderer.init();
  renderer.setPixelRatio(2);
  renderer.setSize(1366, 1024, false);
  assert.equal((renderer as unknown as { reversedDepthBuffer: boolean }).reversedDepthBuffer, true, 'the default stack runs reversed depth');
  const params = { camera: { x: -28, z: 22, yaw: Math.PI / 2, distance: 8 }, dataset };
  const built = createCityScene({ THREE, renderer, invalidate: () => {} } as never, params as never);
  let time = 0;
  const frame = () => {
    time += 1 / 60;
    built.update!({ delta: 1 / 60, time, reducedMotion: false } as never, params as never);
    advanceNodeFrame(renderer as never);
    renderer.render(built.scene as never, built.camera as never);
  };
  const objects = new Map<string, Obj>();
  (built.scene as unknown as { traverse(f: (o: Obj & { isMesh?: boolean }) => void): void }).traverse((o) => {
    if (o.isMesh && (WALLS.includes(o.name) || GROUND.includes(o.name))) objects.set(o.name, o);
  });
  for (const name of ['city:walls-masonry', 'city:walls-glass', 'city:sidewalks', 'city:roads', 'city:contact-shadows']) {
    assert.ok(objects.has(name), `${name} mounted`);
  }

  // Every ground layer's offset pulls it toward the camera: positive bias on a greater-equal depth test.
  for (const name of GROUND) {
    const m = objects.get(name)?.material;
    if (!m?.polygonOffset) continue;
    assert.ok(m.polygonOffsetFactor > 0 && m.polygonOffsetUnits > 0, `${name}: ${m.polygonOffsetFactor}/${m.polygonOffsetUnits} under reversed depth`);
  }

  // Warm up (first frame, release settle), then walk 40 m along the street, half a metre a frame.
  for (let i = 0; i < 4; i++) frame();
  const first = new Map([...objects].filter(([n]) => WALLS.includes(n)).map(([n, o]) => [n, snapshot(o)]));
  for (let i = 1; i <= 80; i++) {
    params.camera = { ...params.camera, x: -28 - i * 0.5 };
    frame();
    for (const [name, before] of first) assert.equal(snapshot(objects.get(name)!), before, `${name} changed at step ${i}`);
  }

  // The masonry shader reads its facade data flat (no interpolated layer index or hash seed).
  // A vertex stage that hands aFacade to a varying declares that varying flat.
  const handoffs = record.shaders.flatMap((code) => [...code.matchAll(/varyings\.(\w+) = aFacade;/g)].map((m) => ({ code, name: m[1]! })));
  assert.ok(handoffs.length > 0, 'the masonry vertex stage passes aFacade on');
  for (const { code, name } of handoffs) {
    assert.match(code, new RegExp(`@interpolate\\(\\s*flat[^)]*\\)\\s*${name}\\b`), `${name} (aFacade) is flat`);
  }
  built.dispose?.();
});
