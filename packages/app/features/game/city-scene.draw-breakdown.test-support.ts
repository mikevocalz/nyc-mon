// The draw-call breakdown for Phase 4 (PR 4), slice 5
// (docs/implementation/draw-call-eval.md): the same physical + vd first-frame
// scene as city-scene.physical-first-frame.test-support.ts — bundled Harlem
// tile, recording GPUDevice, iPad Pro drawing buffer, camera at distance 200 —
// held at a flat draw count, then one frame's worth of backend.draw calls is
// captured so the audit's ~220 draws (docs/performance/engine-audit-2026-10-31.md
// §8) split by pass and by object category.
//
// renderer.backend.draw(renderObject, info) is called once per submitted draw
// (three.webgpu.js WebGPUBackend.draw): renderObject.object names the mesh and
// renderObject.context.shadowPass marks the sun's cascade passes, so the table
// is an exact attribution — no ablation drift. The recording device still
// counts the same draws in record.draws and per pass in record.passDraws.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export interface DrawCallRecord {
  /** Object name ('' for unnamed: post quads, background). */
  name: string;
  /** Render context id: which pass the draw landed in. */
  contextId: number;
  /** 'cascadeN' for the sun's shadow cascade cameras, 'scene' for the view pass, 'other' for post. */
  pass: string;
  /** Whether the draw went to a shadow cascade camera. */
  shadowPass: boolean;
  /** Whether the context renders into a render target (post chain, shadow maps). */
  toTarget: boolean;
  instanced: boolean;
}

export interface DrawContextRecord {
  contextId: number;
  pass: string;
  shadowPass: boolean;
  toTarget: boolean;
  draws: number;
  /** Camera used by the context (shadow cascades use OrthographicCamera). */
  camera: string;
}

export interface DrawCategoryRow {
  key: string;
  /** Distinct object names the matcher caught. */
  objects: number;
  sceneDraws: number;
  shadowDraws: number;
  totalDraws: number;
}

export interface DrawBreakdown {
  settleFrames: number;
  /** Draws of eight consecutive frames right after settle (alternation under a throttled shadow). */
  frameDraws: number[];
  settleTail: number[];
  streamStats: { cells: number; pending: number; fetching: number; loads: number; evictions: number; overBudget: number } | null;
  /** Draws of the measured frame (record.draws delta). */
  draws: number;
  /** Per-pass draws of the measured frame, in beginPass order. */
  passDraws: number[];
  /** Sum of shadow-cascade draws of the measured frame. */
  shadowDraws: number;
  /** Sum of scene-pass draws of the measured frame. */
  sceneDraws: number;
  /** Every draw call of the measured frame, attributed. */
  calls: DrawCallRecord[];
  /** Pass contexts that drew this frame, with their draw counts. */
  contexts: DrawContextRecord[];
  categories: DrawCategoryRow[];
  unmatchedNames: string[];
  /** A frame 60 frames later and the per-name draw delta between them: the slow drift the settle tail can hide. */
  late: { draws: number; passDraws: number[]; drift: Record<string, { scene: number; shadow: number }> } | null;
}

interface Categorizer {
  key: string;
  match(name: string): boolean;
}

// Buckets by object name (the names are the layers' contracts: NEAR_NAME,
// SHELL_NAME, STRUCTURE_NAME, the living-city actors, city-mesh's merged
// layers). First match wins; order matters.
const CATEGORIZERS: Categorizer[] = [
  { key: 'vd blocks (shell+near cells)', match: (n) => n.startsWith('city:vd-blocks') || n.startsWith('vd:blocks') },
  { key: 'vd far shells', match: (n) => n.startsWith('city:vd-far') || n.startsWith('vd:far') },
  { key: 'streamed cells (detail/facelift/paint/contact)', match: (n) => n === 'city:street-detail' || n === 'city:facelift' || n === 'physical:road-paint' || n === 'city:contact-shadows' },
  { key: 'structures + storefronts', match: (n) => n.startsWith('vd-structure') || n.startsWith('vd:storefronts') || n.startsWith('vd:furniture') },
  { key: 'merged city walls/roofs/billboards', match: (n) => /^city:(walls|roofs|billboards|facade|windows|letters)/.test(n) },
  { key: 'trees (all tiers)', match: (n) => n.startsWith('city:trees') || n.startsWith('city:tree-') || n.startsWith('physical:trees') },
  { key: 'precipitation', match: (n) => n === 'city:precipitation' },
  { key: 'cars (vd-instanced fleets)', match: (n) => n.startsWith('city:cars') || n.startsWith('city:parked') },
  { key: 'fire escapes', match: (n) => n.startsWith('physical:fire-escape') },
  { key: 'street props/furniture pools', match: (n) => n.startsWith('city:props') || n.startsWith('furniture:') || n.startsWith('vd:pool') },
  { key: 'living-city actors', match: (n) => n.startsWith('living-city:') },
  { key: 'ground/decals (roads/sidewalks/areas/neon)', match: (n) => /^city:(ground|roads|sidewalks|areas|neon|kerb|curb|paint)/.test(n) || n.startsWith('physical:road') },
  { key: 'sky + atmosphere', match: (n) => n === 'city:sky' || n === 'city:physical-sky' || n.startsWith('city:weather') || n.startsWith('physical:sky') },
  { key: 'post chain (pipeline + bloom quads)', match: (n) => n === '' || n === 'Render Pipeline' || n.startsWith('Bloom [') || n.startsWith('SSR') || n.startsWith('post') },
];

interface BackendDraw {
  object: { name: string; isInstancedMesh?: boolean };
  context: { id: number; shadowPass: boolean; renderTarget: unknown; camera: { type?: string; name?: string } };
  camera: object;
  getDrawParameters(): unknown;
}

/** One frame of the built scene with backend.draw instrumented: the attributed call list. */
export async function measureDrawBreakdown(): Promise<DrawBreakdown> {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('./render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals();
  const THREE = await import('three/webgpu');
  const { parseCityDataset } = await import('./city-dataset.ts');
  const { createCityScene, cityStreamStats } = await import('./city-scene.ts');
  (await import('./world/vd-port/blocks/load-from-disk.test-support.ts')).loadVdBlocksFromDisk();
  (await import('./world/vd-port/storefronts/load-from-disk.test-support.ts')).loadVdStorefrontPlanFromDisk();
  const { physicalRendererParams } = await import('./world/physical-look.ts');
  const { createVehicleActor } = await import('./living-city/vehicle-actor.ts');
  const { advanceNodeFrame } = await import('@acme/ui/three/internals');

  const WIDTH = 2732, HEIGHT = 2048;
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('./data/harlem-apollo.json', import.meta.url), 'utf8')));
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(WIDTH, HEIGHT), device, antialias: true, ...physicalRendererParams() } as never);
  await renderer.init();
  renderer.setPixelRatio(2);
  renderer.setSize(WIDTH / 2, HEIGHT / 2, false);
  const params = { camera: { x: 0, z: 0, yaw: 0, distance: 200 }, dataset };
  const built = createCityScene({ THREE, renderer, invalidate: () => {} } as never, {
    ...params,
    actors: [createVehicleActor({ read: () => null, focus: () => ({ x: 0, z: 0, fwdX: 0, fwdZ: 1 }) })],
  } as never);

  let time = 0;
  const frame = () => {
    time += 1 / 60;
    built.update!({ delta: 1 / 60, time, reducedMotion: false } as never, params as never);
    advanceNodeFrame(renderer as never);
    renderer.render(built.scene as never, built.camera as never);
  };
  const drawFrame = () => {
    const d0 = record.draws;
    const p0 = record.passDraws.length;
    frame();
    return { draws: record.draws - d0, passDraws: record.passDraws.slice(p0) };
  };

  // Settle: the streamer loads its want set a few cells a frame, so early
  // frames draw a different count. pending === fetching means every
  // wanted-but-unbuilt cell is blocked on bytes (no cell host in node), so
  // nothing buildable remains; draws then hold. Cells whose prefetches land
  // later (bundled vs host) keep the frame honest only if draws hold flat.
  const stats = cityStreamStats.get(built.scene as object);
  let settleFrames = 0;
  let last = -1, flat = 0;
  const tail: number[] = [];
  while ((flat < 15 || (stats ? stats.pending !== stats.fetching : false)) && settleFrames < 2000) {
    const { draws } = drawFrame();
    flat = draws === last ? flat + 1 : 0;
    last = draws;
    tail.push(draws);
    if (tail.length > 24) tail.shift();
    settleFrames++;
  }

  // The shadow passes: the sun's cascades render the scene once per cascade
  // camera (SunShadowNode.renderShadow). Capture those cameras plus the scene
  // camera now so every draw call classifies exactly — context.shadowPass is
  // not set on r187's renderObject.context.
  const sun = (built.scene as InstanceType<typeof THREE.Scene>).getObjectByName('city:physical-sun') as
    { shadow?: { getCamera?(i: number): object; getViewportCount?(): number; camera?: object } } | undefined;
  const shadow = sun?.shadow;
  const cascadeCount = shadow && typeof shadow.getViewportCount === 'function' ? shadow.getViewportCount() : shadow ? 1 : 0;
  const cascadeCameras = new Map<object, number>();
  for (let i = 0; i < cascadeCount; i++) {
    const cam = shadow && typeof shadow.getCamera === 'function' ? shadow.getCamera(i) : shadow?.camera;
    if (cam) cascadeCameras.set(cam, i);
  }
  const sceneCamera = built.camera as object;

  // Instrument backend.draw for one frame. draw() early-outs on
  // getDrawParameters() === null (three.webgpu.js:50843), so only non-null
  // calls become real draws — the count then matches record.draws.
  const backend = renderer.backend as unknown as { draw(call: BackendDraw, info: unknown): unknown };
  const original = backend.draw.bind(backend);
  const calls: DrawCallRecord[] = [];
  const contexts = new Map<number, DrawContextRecord>();
  const instrument = (sink: DrawCallRecord[], ctxMap: Map<number, DrawContextRecord>) => {
    backend.draw = (call: BackendDraw, info: unknown) => {
      if (call.getDrawParameters() === null) return original(call, info);
      const { object, context } = call;
      const cascade = cascadeCameras.get(call.camera);
      const pass = cascade !== undefined ? `cascade${cascade}` : call.camera === sceneCamera ? 'scene' : 'other';
      sink.push({
        name: object.name ?? '', contextId: context.id,
        pass,
        shadowPass: cascade !== undefined, toTarget: context.renderTarget != null,
        instanced: object.isInstancedMesh === true,
      });
      let c = ctxMap.get(context.id);
      if (!c) {
        c = { contextId: context.id, pass, shadowPass: cascade !== undefined, toTarget: context.renderTarget != null, draws: 0, camera: context.camera?.type ?? '' };
        ctxMap.set(context.id, c);
      }
      c.draws++;
      return original(call, info);
    };
  };
  // Eight consecutive frames right after settle: under a throttled shadow
  // (EXPO_PUBLIC_WORLD_SHADOW_INTERVAL) they alternate refresh / skip.
  const frameDraws = Array.from({ length: 8 }, () => drawFrame().draws);

  let measured = { draws: 0, passDraws: [] as number[] };
  let result_late: { draws: number; passDraws: number[]; drift: Record<string, { scene: number; shadow: number }> } | null = null;
  try {
    instrument(calls, contexts);
    measured = drawFrame();
    backend.draw = original;
    // Drift probe: draws climb slowly without new objects (visible in the
    // passDraws tail). A second instrumented frame N frames later names the
    // draws that arrived.
    for (let i = 0; i < 60; i++) frame();
    const lateCalls: DrawCallRecord[] = [];
    const lateContexts = new Map<number, DrawContextRecord>();
    instrument(lateCalls, lateContexts);
    const late = drawFrame();
    const countByName = (list: DrawCallRecord[]) => {
      const m = new Map<string, { scene: number; shadow: number }>();
      for (const c of list) {
        let e = m.get(c.name);
        if (!e) m.set(c.name, (e = { scene: 0, shadow: 0 }));
        if (c.shadowPass) e.shadow++; else e.scene++;
      }
      return m;
    };
    const early = countByName(calls);
    const lateByName = countByName(lateCalls);
    const drift: Record<string, { scene: number; shadow: number }> = {};
    for (const [name, e] of lateByName) {
      const was = early.get(name) ?? { scene: 0, shadow: 0 };
      const d = { scene: e.scene - was.scene, shadow: e.shadow - was.shadow };
      if (d.scene !== 0 || d.shadow !== 0) drift[name] = d;
    }
    result_late = { draws: late.draws, passDraws: late.passDraws, drift };
  } finally {
    backend.draw = original;
  }

  const categorize = (name: string) => CATEGORIZERS.find((c) => c.match(name))?.key ?? null;
  const rows = new Map<string, DrawCategoryRow>();
  const unmatched = new Set<string>();
  for (const call of calls) {
    const key = categorize(call.name);
    if (key === null) { unmatched.add(call.name || '<unnamed>'); continue; }
    let row = rows.get(key);
    if (!row) rows.set(key, (row = { key, objects: 0, sceneDraws: 0, shadowDraws: 0, totalDraws: 0 }));
    row.totalDraws++;
    if (call.shadowPass) row.shadowDraws++; else row.sceneDraws++;
  }
  const namesByKey = new Map<string, Set<string>>();
  for (const call of calls) {
    const key = categorize(call.name);
    if (key === null) continue;
    let s = namesByKey.get(key);
    if (!s) namesByKey.set(key, (s = new Set()));
    s.add(call.name);
  }
  const categories = [...rows.values()].map((r) => ({ ...r, objects: namesByKey.get(r.key)?.size ?? 0 }));

  const result: DrawBreakdown = {
    settleFrames,
    frameDraws,
    settleTail: tail,
    streamStats: stats ? { cells: stats.cells, pending: stats.pending, fetching: stats.fetching, loads: stats.loads, evictions: stats.evictions, overBudget: stats.overBudget } : null,
    draws: measured.draws,
    passDraws: measured.passDraws,
    shadowDraws: calls.filter((c) => c.shadowPass).length,
    sceneDraws: calls.filter((c) => !c.shadowPass && c.pass === 'scene').length,
    calls,
    contexts: [...contexts.values()],
    categories,
    unmatchedNames: [...unmatched].sort(),
    late: result_late,
  };
  built.dispose?.();
  return result;
}

/** The fields a flag-comparison run needs. */
export type BreakdownSummary = Pick<DrawBreakdown, 'draws' | 'sceneDraws' | 'shadowDraws' | 'frameDraws' | 'passDraws'>;

/**
 * measureDrawBreakdown in a fresh node process with `env` over this one's:
 * the world flags (EXPO_PUBLIC_WORLD_SHADOW_INTERVAL among them) are read at
 * import, so a second config needs its own process — the same pattern as
 * measureFirstFrameInChild.
 */
export function measureDrawBreakdownInChild(env: Readonly<Record<string, string | undefined>>): BreakdownSummary {
  const url = new URL('./city-scene.draw-breakdown.test-support.ts', import.meta.url).href;
  const code = `const m = await import(${JSON.stringify(url)});
const b = await m.measureDrawBreakdown();
const pick = ({ draws, sceneDraws, shadowDraws, frameDraws, passDraws }) => ({ draws, sceneDraws, shadowDraws, frameDraws, passDraws });
process.stdout.write('\\n@@breakdown@@' + JSON.stringify(pick(b)) + '\\n');`;
  const merged = {} as NodeJS.ProcessEnv;
  for (const [k, v] of Object.entries({ ...process.env, ...env })) if (v !== undefined) merged[k] = v;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: merged, encoding: 'utf8', maxBuffer: 64 << 20 });
  const line = out.split('\n').find((l) => l.startsWith('@@breakdown@@'));
  if (!line) throw new Error(`child breakdown run printed no result:\n${out.slice(-2000)}`);
  return JSON.parse(line.slice('@@breakdown@@'.length)) as BreakdownSummary;
}
