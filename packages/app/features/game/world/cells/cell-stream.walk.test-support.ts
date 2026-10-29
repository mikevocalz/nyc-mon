// A scripted walk along 125th Street through the recording GPU at the iPad
// Pro 12.9" drawing buffer (2732 x 2048), for cell-stream.walk.test.ts. The
// default physical + vd scene is built, frame 0 is drawn, then the chase
// camera runs 125th from its west end and back at WALK_SPEED, 30 s a leg, for
// 120 s of scene time, one frame per FRAME_DT: at 60 and 120 s it stands
// where it started, at 30 and 90 s at the far end, so a sample can be held
// against the one taken at the same spot a minute earlier. At 1, 30, 60, 90
// and 120 s it samples what is
// resident: live GPU buffer bytes (created minus destroyed), shader modules
// and pipelines (cumulative), three's live render objects and geometries,
// draws per frame and the streamer's own counts. The world flags are read at
// import, so a run sets its env first; measureWalkInChild runs one in a
// fresh process.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { getHeapStatistics } from 'node:v8';

export const WIDTH = 2732;
export const HEIGHT = 2048;
/** Metres per second along the street: a drive's pace, so a 30 s leg covers 600 m, past the resident radius. */
export const WALK_SPEED = 20;
/** Seconds per leg of the out-and-back. */
export const LEG_S = 30;
export const FRAME_DT = 0.1;
export const SAMPLE_AT = [1, 30, 60, 90, 120] as const;

export interface WalkSample {
  t: number;
  /** GPU buffers alive now (created minus destroyed), bytes. */
  liveBufferBytes: number;
  shaderModules: number;
  renderPipelines: number;
  renderObjects: number;
  /** Render objects whose object is no longer under the scene (an evicted cell three still holds). */
  detachedRenderObjects: number;
  geometries: number;
  /** Draws of the last frame (every pass). */
  draws: number;
  cells: number;
  cellBytes: number;
  cellTriangles: number;
  loads: number;
  evictions: number;
  maxBuildMs: number;
  /** Loads the budget refused so far. */
  overBudget: number;
  /** The layers held to their own budget (the vd port's blocks), inside the totals above. */
  own: { cells: number; bytes: number; triangles: number; overBudget: number };
  /** V8 heap in use after a collection, bytes (NaN without --expose-gc). */
  heapUsed: number;
  arrayBuffers: number;
}

export interface Walk {
  stream: boolean;
  preset: string | null;
  /** Scene build (createCityScene), ms. */
  buildMs: number;
  /** The START compileAsync, ms (the recording device's pipelines resolve at once). */
  compileMs: number;
  /** Shader modules and render pipelines once frame 0 has drawn. */
  frame0ShaderModules: number;
  frame0Pipelines: number;
  frame0Ms: number;
  frame0AllocatedBytes: number;
  frame0Draws: number;
  /** Cell package store (CPU arrays the streamer keeps to rebuild from), bytes; 0 unstreamed. */
  packageBytes: number;
  samples: WalkSample[];
  /** Pipelines and shader modules created after frame 0. */
  newPipelinesAfterFrame0: number;
  newShaderModulesAfterFrame0: number;
  /** Labels of the render pipelines created after frame 0. */
  newPipelineLabels: string[];
}

/** 125th Street's centre line, west to east, from the tile's road records. */
function streetLine(dataset: { roads: readonly { name?: string; points: readonly number[] }[] }): [number, number][] {
  const pts: [number, number][] = [];
  for (const r of dataset.roads) {
    if (!/\b125\b/.test(r.name ?? '')) continue;
    for (let i = 0; i < r.points.length; i += 2) pts.push([r.points[i]!, r.points[i + 1]!]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  // One point per 20 m of x, so the parallel carriageways average into one line.
  const out: [number, number][] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (prev && p[0] - prev[0] < 20) continue;
    out.push(p);
  }
  return out;
}

function along(line: [number, number][], s: number): { x: number; z: number; yaw: number } {
  let rest = s;
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, az] = line[i]!; const [bx, bz] = line[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    if (rest <= len || i + 2 === line.length) {
      const f = Math.min(1, rest / Math.max(len, 1e-6));
      // The camera sits behind the Caller: yaw points from the target back along the street.
      return { x: ax + (bx - ax) * f, z: az + (bz - az) * f, yaw: Math.atan2(ax - bx, az - bz) };
    }
    rest -= len;
  }
  const [x, z] = line[line.length - 1]!;
  return { x, z, yaw: 0 };
}

export async function measureWalk(): Promise<Walk> {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('../../render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals();
  const THREE = await import('three/webgpu');
  const { parseCityDataset } = await import('../../city-dataset.ts');
  const { createCityScene, cityStreamStats } = await import('../../city-scene.ts');
  (await import('../vd-port/blocks/load-from-disk.test-support.ts')).loadVdBlocksFromDisk();
  const { physicalRendererParams } = await import('../physical-look.ts');
  const { advanceNodeFrame } = await import('@acme/ui/three/internals');

  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const { device, record } = recordingGpuDevice();
  // Live buffer bytes: the recording device only counts creations, so track destroy here.
  let liveBufferBytes = 0;
  const d = device as { createBuffer: (desc: { size: number }) => { size: number; destroy(): void } };
  const create = d.createBuffer.bind(device);
  d.createBuffer = (desc) => {
    // three reuses and resets the descriptor after the call: read it now.
    const size = desc.size;
    const b = create(desc);
    liveBufferBytes += size;
    let alive = true;
    b.destroy = () => { if (alive) { alive = false; liveBufferBytes -= size; } };
    return b;
  };
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(WIDTH, HEIGHT), device, antialias: true, ...physicalRendererParams() } as never);
  await renderer.init();
  renderer.setPixelRatio(2);
  renderer.setSize(WIDTH / 2, HEIGHT / 2, false);
  const line = streetLine(dataset as never);
  const start = along(line, 0);
  const params = { camera: { x: start.x, z: start.z, yaw: start.yaw, distance: 12 }, dataset };
  const b0 = performance.now();
  const built = createCityScene({ THREE, renderer, invalidate: () => {} } as never, params as never);
  const buildMs = performance.now() - b0;
  const world = (built as unknown as { scene: InstanceType<typeof THREE.Scene> }).scene;
  let time = 0;
  const frame = () => {
    time += FRAME_DT;
    built.update!({ delta: FRAME_DT, time, reducedMotion: false } as never, params as never);
    advanceNodeFrame(renderer as never);
    renderer.render(built.scene as never, built.camera as never);
  };
  // The app's order (load-game-scene.ts): the START compile, then the first frame.
  // compileAsync yields between objects through requestAnimationFrame, which installGpuGlobals stubs to never fire;
  // a macrotask stands in for the frame while it runs.
  const g = globalThis as { requestAnimationFrame: (cb: (t: number) => void) => unknown };
  const raf = g.requestAnimationFrame;
  g.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
  const c0 = performance.now();
  await renderer.compileAsync(built.scene as never, built.camera as never);
  const compileMs = performance.now() - c0;
  g.requestAnimationFrame = raf;
  // The scene reads performance.now() for its streaming clock: drive it with scene time.
  const realNow = performance.now.bind(performance);
  let clock = realNow();
  performance.now = () => clock;

  const a0 = getHeapStatistics().total_allocated_bytes;
  const draws0 = record.draws;
  const w0 = realNow();
  frame();
  const frame0Ms = realNow() - w0;
  const frame0AllocatedBytes = getHeapStatistics().total_allocated_bytes - a0;
  const frame0Draws = record.draws - draws0;
  const shaders0 = record.shaders.length;
  const pipelines0 = record.renderPipelines;

  const internals = renderer as unknown as {
    _objects?: { _renderObjects?: Set<unknown> };
    info: { memory: { geometries: number } };
  };
  const streamStats = () => cityStreamStats.get(world) ?? null;
  const gc = (globalThis as { gc?: () => void }).gc;
  const samples: WalkSample[] = [];
  let next = 0;
  const steps = Math.round(SAMPLE_AT[SAMPLE_AT.length - 1]! / FRAME_DT);
  for (let i = 1; i <= steps; i++) {
    clock += FRAME_DT * 1000;
    const tw = i * FRAME_DT;
    const leg = Math.floor(tw / LEG_S);
    const into = tw - leg * LEG_S;
    const p = along(line, (leg % 2 === 0 ? into : LEG_S - into) * WALK_SPEED);
    params.camera = { x: p.x, z: p.z, yaw: p.yaw, distance: 12 };
    const before = record.draws;
    frame();
    const t = Math.round(i * FRAME_DT * 1000) / 1000;
    if (next < SAMPLE_AT.length && t >= SAMPLE_AT[next]!) {
      next++;
      gc?.();
      const s = streamStats();
      samples.push({
        t,
        liveBufferBytes,
        shaderModules: record.shaders.length,
        renderPipelines: record.renderPipelines,
        renderObjects: internals._objects?._renderObjects?.size ?? NaN,
        detachedRenderObjects: [...(internals._objects?._renderObjects ?? [])].filter((r) => {
          let o = (r as { object: { parent: unknown } }).object as { parent: unknown } | null;
          while (o && o.parent) o = o.parent as { parent: unknown };
          return o !== world && (r as { object: unknown }).object !== world;
        }).length,
        geometries: internals.info.memory.geometries,
        draws: record.draws - before,
        cells: s?.cells ?? 0,
        cellBytes: s?.bytes ?? 0,
        cellTriangles: s?.triangles ?? 0,
        loads: s?.loads ?? 0,
        evictions: s?.evictions ?? 0,
        maxBuildMs: s?.maxBuildMs ?? 0,
        overBudget: s?.overBudget ?? 0,
        own: s?.own ? { ...s.own } : { cells: 0, bytes: 0, triangles: 0, overBudget: 0 },
        heapUsed: gc ? process.memoryUsage().heapUsed : NaN,
        arrayBuffers: process.memoryUsage().arrayBuffers,
      });
    }
  }
  performance.now = realNow;
  const result: Walk = {
    stream: cityStreamStats.has(world),
    preset: process.env.EXPO_PUBLIC_WORLD_PRESET ?? null,
    buildMs,
    compileMs,
    frame0ShaderModules: shaders0,
    frame0Pipelines: pipelines0,
    frame0Ms,
    frame0AllocatedBytes,
    frame0Draws,
    packageBytes: streamStats()?.packageBytes ?? 0,
    samples,
    newPipelinesAfterFrame0: record.renderPipelines - pipelines0,
    newShaderModulesAfterFrame0: record.shaders.length - shaders0,
    newPipelineLabels: record.pipelineVertexBuffers.slice(pipelines0).map((p) => p.label),
  };
  built.dispose?.();
  return result;
}

/** measureWalk in a fresh node process (with --expose-gc) under `env`. */
export function measureWalkInChild(env: Readonly<Record<string, string | undefined>>): Walk {
  const url = new URL('./cell-stream.walk.test-support.ts', import.meta.url).href;
  const code = `const m = await import(${JSON.stringify(url)});
const w = await m.measureWalk();
process.stdout.write('\\n@@walk@@' + JSON.stringify(w) + '\\n');`;
  const merged = {} as NodeJS.ProcessEnv;
  for (const [k, v] of Object.entries({ ...process.env, ...env })) if (v !== undefined) merged[k] = v;
  const out = execFileSync(process.execPath, ['--expose-gc', '--input-type=module', '-e', code], { env: merged, encoding: 'utf8', maxBuffer: 64 << 20 });
  const line = out.split('\n').find((l) => l.startsWith('@@walk@@'));
  if (!line) throw new Error(`child walk printed no result:\n${out.slice(-2000)}`);
  return JSON.parse(line.slice('@@walk@@'.length)) as Walk;
}

