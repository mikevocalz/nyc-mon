// The vd port with every lane on, through the recording GPU device at the iPad Pro 12.9" drawing buffer: lane A's block
// packs and lane C's assets read from disk (Node has no Metro asset route), and a camera that walks from the Apollo along
// 125th Street to the Manhattan Valley arch and back past the State Office Building, so every lane's materials are built
// somewhere on the way. Reports the shader modules and pipelines the whole run created, the largest vertex-buffer count
// and the GPU texture bytes. Run in its own process (the world flags are read at import): measureVdBudgetInChild.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const WIDTH = 2732;
export const HEIGHT = 2048;

export interface VdBudget {
  shaderModules: number;
  renderPipelines: number;
  maxVertexBuffers: number;
  textureBytes: number;
  draws: number;
  names: string[];
  /** Lane C's structures resident at the arch (vertices), to show they streamed. */
  structureVertices: number;
  /** Each live pipeline's users (object | material), for attributing the count. */
  pipelineOwners: string[];
}

export async function measureVdBudget(): Promise<VdBudget> {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('../../render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals();
  const THREE = await import('three/webgpu');
  const { parseCityDataset } = await import('../../city-dataset.ts');
  const { createCityScene } = await import('../../city-scene.ts');
  const { physicalRendererParams } = await import('../physical-look.ts');
  const { advanceNodeFrame } = await import('@acme/ui/three/internals');
  (await import('./blocks/load-from-disk.test-support.ts')).loadVdBlocksFromDisk();
  const furniture = await import('./furniture/index.ts');
  if (process.env.EXPO_PUBLIC_WORLD_VD_FURNITURE !== '0') furniture.setFurnitureAssets((await import('./furniture/disk-assets.test-support.ts')).diskAssets());
  const { valdradaToScene } = await import('./transform.ts');

  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const toScene = valdradaToScene(dataset.origin);
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(WIDTH, HEIGHT), device, antialias: true, ...physicalRendererParams() } as never);
  await renderer.init();
  renderer.setPixelRatio(2);
  renderer.setSize(WIDTH / 2, HEIGHT / 2, false);
  // Valdrada world points: the Apollo's frontage, the Manhattan Valley arch at Broadway (w125wData.js MVV.C), the State
  // Office Building's plaza (w125cbData.js, t 240 b -10 on the street frame)
  const stops = [[1775.45, -2978.2], [1088.46, -3623.33], [1775.45 + 0.8746 * 240 + 0.4848 * 10, -2978.2 + 0.4848 * 240 - 0.8746 * 10]].map(([x, z]) => toScene(x!, z!));
  const params = { camera: { x: stops[0]![0], z: stops[0]![1], yaw: 0, distance: 12 }, dataset };
  const built = createCityScene({ THREE, renderer, invalidate: () => {} } as never, params as never);
  const g = globalThis as { requestAnimationFrame: (cb: (t: number) => void) => unknown };
  const raf = g.requestAnimationFrame;
  g.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
  await renderer.compileAsync(built.scene as never, built.camera as never);
  g.requestAnimationFrame = raf;
  await furniture.lastFurniturePart()?.ready;
  const realNow = performance.now.bind(performance);
  let clock = realNow();
  performance.now = () => clock;
  let time = 0;
  let draws = 0;
  const frame = async () => {
    time += 1 / 30;
    clock += 1000 / 30;
    const before = record.draws;
    built.update!({ delta: 1 / 30, time, reducedMotion: false } as never, params as never);
    advanceNodeFrame(renderer as never);
    renderer.render(built.scene as never, built.camera as never);
    draws = Math.max(draws, record.draws - before);
    // the packages' fetches and decodes resolve between frames
    await new Promise((r) => setImmediate(r));
  };
  let structureVertices = 0;
  for (let leg = 0; leg + 1 < stops.length; leg++) {
    const [ax, az] = stops[leg]!, [bx, bz] = stops[leg + 1]!;
    const n = 240;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      params.camera = { x: ax + (bx - ax) * t, z: az + (bz - az) * t, yaw: Math.atan2(bx - ax, bz - az), distance: 12 };
      await frame();
    }
    // dwell at the stop while its cells stream in
    for (let i = 0; i < 90; i++) await frame();
    if (leg === 0) structureVertices = furniture.lastFurniturePart()?.structures()?.stats().vertices ?? 0;
  }
  // Which objects and materials own the pipelines: each render object's pipeline, by the object's and material's names.
  const byPipeline = new Map<unknown, Set<string>>();
  for (const r of ((renderer as unknown as { _objects: { _renderObjects: Set<{ pipeline: unknown; object: { name: string }; material: { name: string; type: string } }> } })._objects._renderObjects)) {
    if (!byPipeline.has(r.pipeline)) byPipeline.set(r.pipeline, new Set());
    byPipeline.get(r.pipeline)!.add(`${r.object.name.replace(/[#:]\d+$/, '')} | ${r.material.name || r.material.type}`);
  }
  const pipelineOwners = [...byPipeline.values()].map((s) => [...s].sort().slice(0, 4).join(' ; '));
  const names = new Set<string>();
  (built.scene as InstanceType<typeof THREE.Scene>).traverse((o) => { if (o.name) names.add(o.name); });
  return {
    shaderModules: record.shaders.length,
    renderPipelines: record.renderPipelines,
    maxVertexBuffers: Math.max(0, ...record.pipelineVertexBuffers.map((p) => p.buffers)),
    textureBytes: record.textureBytes,
    draws,
    names: [...names],
    structureVertices,
    pipelineOwners,
  };
}

export function measureVdBudgetInChild(env: Readonly<Record<string, string | undefined>>): VdBudget {
  const url = new URL('./budget.test-support.ts', import.meta.url).href;
  const code = `const m = await import(${JSON.stringify(url)});
const b = await m.measureVdBudget();
process.stdout.write('\\n@@vd-budget@@' + JSON.stringify(b) + '\\n');
process.exit(0);`;
  const merged = {} as NodeJS.ProcessEnv;
  for (const [k, v] of Object.entries({ ...process.env, ...env })) if (v !== undefined) merged[k] = v;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: merged, encoding: 'utf8', maxBuffer: 256 << 20 });
  const line = out.split('\n').find((l) => l.startsWith('@@vd-budget@@'));
  if (!line) throw new Error(`child vd budget run printed no result:\n${out.slice(-3000)}`);
  return JSON.parse(line.slice('@@vd-budget@@'.length)) as VdBudget;
}
