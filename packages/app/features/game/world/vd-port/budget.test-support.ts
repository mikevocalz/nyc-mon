// The vd port with every lane on, through the recording GPU device at the iPad Pro 12.9" drawing buffer: lane A's block
// packs and lane C's assets read from disk (Node has no Metro asset route), and a camera that walks from the Apollo along
// 125th Street to the Manhattan Valley arch and back past the State Office Building, so every lane's materials are built
// somewhere on the way. Reports the shader modules and pipelines the whole run created, the largest vertex-buffer count
// and the GPU texture bytes. Run in its own process (the world flags are read at import): measureVdBudgetInChild.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

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
  (await import('./storefronts/load-from-disk.test-support.ts')).loadVdStorefrontPlanFromDisk();
  // the far tier streams from the same disk copies (the bundled home chunks always, the full bake when .cache is here)
  (await import('./far-tier/load-from-disk.test-support.ts')).loadVdFarFromDisk();
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
  // VD_BUDGET_ATTR=<file>: every pipeline creation with its object, material and pass, and the shader modules it made.
  const attr: { object: string; material: string; type: string; pass: string; modules: number; layout: string }[] = [];
  if (process.env.VD_BUDGET_ATTR) {
    const backend = (renderer as unknown as { backend: { createRenderPipeline(ro: unknown, p: unknown): unknown } }).backend;
    const create = backend.createRenderPipeline.bind(backend);
    backend.createRenderPipeline = (ro, p) => {
      const before = record.shaders.length;
      const rck = String((backend as unknown as { getRenderCacheKey(r: unknown): string }).getRenderCacheKey(ro));
      const nbs = (ro as { getNodeBuilderState?(): { vertexShader: string; fragmentShader: string } }).getNodeBuilderState?.();
      const vs = nbs?.vertexShader ?? '', fs = nbs?.fragmentShader ?? '';
      if (process.env.VD_BUDGET_SRC && (ro as { object: { name: string } }).object.name === process.env.VD_BUDGET_SRC) appendFileSync(`${process.env.VD_BUDGET_ATTR}.src`, `===== frame ${frameNo}\n${vs}\n----- fragment\n${fs}\n`);
      const r = create(ro, p);
      const o = ro as { object: { name: string; isInstancedMesh?: boolean }; material: { name: string; type: string }; context?: { depth?: boolean }; geometry: { attributes: Record<string, unknown> }; clippingContextCacheKey?: string; passId?: string };
      const src = (o.object as unknown as { material: Record<string, unknown> }).material;
      const ov = o.material as unknown as Record<string, unknown>;
      const vb = record.pipelineVertexBuffers[record.pipelineVertexBuffers.length - 1];
      attr.push({ object: o.object.name.replace(/[:#]-?\d+_-?\d+.*$|[:#]\d+$/, ''), material: o.material.name, type: o.material.type, pass: o.passId ?? '',
        modules: record.shaders.length - before, layout: Object.keys(o.geometry.attributes).sort().join(',') + (o.object.isInstancedMesh ? '+inst' : ''),
        state: `side${String(ov.side)} vb${vb?.buffers ?? '?'} po${src && src.polygonOffset ? 1 : 0} mask${src && src.maskNode ? 1 : 0} pos${src && src.positionNode ? 1 : 0} ovcol${ov.colorNode ? 1 : 0} ovpos${ov.positionNode ? 1 : 0} at${src ? String(src.alphaTest) : ''} ctx${(o as unknown as { context?: { id?: number; sampleCount?: number; textures?: { format?: string }[] | null; depth?: boolean } }).context?.sampleCount}/${((o as unknown as { context?: { textures?: { format?: string }[] | null } }).context?.textures ?? []).map((t) => t?.format ?? '?').join('+')}/${(o as unknown as { camera?: { type?: string } }).camera?.type ?? ''} src:${src ? String(src.name || src.type) : ''}`, frame: frameNo, lights: String((o as unknown as { lightsNode?: { getCacheKey(): number } }).lightsNode?.getCacheKey?.() ?? ''), env: String((o as unknown as { scene?: { environment?: { uuid: string; version: number } } }).scene?.environment?.uuid?.slice(0, 6)) + ':' + String((o as unknown as { scene?: { environment?: { version: number } } }).scene?.environment?.version), mver: String((src as { version?: number } | undefined)?.version ?? ''), rck, lightList: ((o as unknown as { lightsNode?: { getLights(): { type: string; name: string; castShadow: boolean; shadow?: { map?: unknown } }[] } }).lightsNode?.getLights?.() ?? []).map((l) => `${(l as unknown as { id: number }).id}:${l.name.slice(5, 9)}:${l.castShadow ? 1 : 0}`).join(',') } as never);
      return r;
    };
  }
  let frameNo = -1;
  const params = { camera: { x: stops[0]![0], z: stops[0]![1], yaw: 0, distance: 12 }, dataset };
  const built = createCityScene({ THREE, renderer, invalidate: () => {} } as never, params as never);
  const g = globalThis as { requestAnimationFrame: (cb: (t: number) => void) => unknown };
  const raf = g.requestAnimationFrame;
  g.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
  if (process.env.VD_BUDGET_PREUPDATE === '1') built.update!({ delta: 0, time: 0, reducedMotion: false } as never, params as never);
  await (await import('../../compile-pass.ts')).compileForFrames(renderer as never, built.scene, built.camera);
  g.requestAnimationFrame = raf;
  await furniture.lastFurniturePart()?.ready;
  const realNow = performance.now.bind(performance);
  let clock = realNow();
  performance.now = () => clock;
  let time = 0;
  let draws = 0;
  const frame = async () => {
    frameNo++;
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
  if (process.env.VD_BUDGET_ATTR) (await import('node:fs')).writeFileSync(process.env.VD_BUDGET_ATTR, JSON.stringify(attr));
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
