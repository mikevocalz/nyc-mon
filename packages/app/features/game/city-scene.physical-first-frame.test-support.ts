// The physical city's first frame on the bundled Harlem tile, run through a
// recording GPUDevice at the iPad Pro 12.9" drawing buffer (2732 x 2048).
// Shared by city-scene.physical-first-frame.test.ts (the default build:
// physical + vd), city-scene.physical-first-frame.vd-off.test.ts and
// city-scene.release-late-pass.test.ts. The recording device reports
// maxVertexBuffers = 8, the iPad's limit, and logs every pipeline's count. The
// world flags are read at import, so each test file sets its env first and
// then calls measureFirstFrame in its own process.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { getHeapStatistics } from 'node:v8';

export const WIDTH = 2732;
export const HEIGHT = 2048;

export interface FirstFrame {
  shaderModules: number;
  distinctShaderModules: number;
  wgslBytes: number;
  renderPipelines: number;
  computePipelines: number;
  materials: number;
  /** Bytes of every GPU texture the frame created (MSAA and shadow targets included). */
  textureBytes: number;
  bufferBytes: number;
  /** queue.writeBuffer and writeTexture bytes: geometry, instance and texture uploads. */
  writeBytes: number;
  draws: number;
  /** Bytes of typed arrays the scene graph still holds on the CPU after the first frame (geometry, instance and texture data). */
  retainedArrayBytes: number;
  /** The same after the settle frames, once world/release-uploaded.ts (flag on) has dropped what the first uploaded. */
  retainedAfterReleaseBytes: number;
  /** Draws of the frames after the first: they still render the released geometry. */
  secondFrameDraws: number;
  /** Upload bytes of the frames after the first: a released array must not be re-sent. */
  secondFrameWriteBytes: number;
  /** Upload bytes of the late shadow-pass frames (lazyShadows). */
  lateWriteBytes: number;
  /** Wall-clock milliseconds of the first frame (update, node frame, render): all of it synchronous JS on this thread. */
  frame0Ms: number;
  /** Process CPU milliseconds (user + system) over the same span. */
  frame0CpuMs: number;
  /** V8 heap bytes allocated during the first frame (v8 total_allocated_bytes), collected or not. */
  frame0AllocatedBytes: number;
  /** Large typed arrays joined into strings during the frame (the patched ClusteredLightsNode bug). */
  stringified: { calls: number; elements: number };
  clustered: boolean;
  /** Object names in the scene, for asserting which lanes mounted. */
  names: Set<string>;
  /** Every render pipeline the run created, with its vertex buffer count (late passes included). */
  pipelines: { label: string; buffers: number }[];
  /** Arrays the release pass emptied during the run. */
  releasedArrays: number;
  /** Reads of a released array's contents or size after its release, by property; empty when nothing read one. */
  releasedReads: Record<string, number>;
}

/** Large typed arrays turned into strings (join / toString / toLocaleString) while `run` executes. */
function countTypedArrayStringification(run: () => void): { calls: number; elements: number } {
  const proto = Object.getPrototypeOf(Int8Array.prototype) as Record<string, (...a: unknown[]) => unknown>;
  const names = ['join', 'toString', 'toLocaleString'] as const;
  const originals = names.map((n) => proto[n]!);
  const seen = { calls: 0, elements: 0 };
  names.forEach((n, i) => {
    proto[n] = function (this: ArrayLike<number>, ...args: unknown[]) {
      if (this.length > 4096) { seen.calls++; seen.elements += this.length; }
      return originals[i]!.apply(this, args);
    };
  });
  try {
    run();
  } finally {
    names.forEach((n, i) => { proto[n] = originals[i]!; });
  }
  return seen;
}

type Obj = { name: string; geometry?: { attributes: Record<string, { array?: ArrayBufferView }>; index?: { array?: ArrayBufferView } | null }; material?: unknown; instanceMatrix?: { array?: ArrayBufferView }; instanceColor?: { array?: ArrayBufferView } | null };

/** Distinct ArrayBuffers behind the scene's geometry, instance attributes and data textures. */
function retainedArrayBytes(objects: Obj[], materials: Set<unknown>): number {
  const buffers = new Set<ArrayBufferLike>();
  const add = (v: ArrayBufferView | undefined) => { if (v && ArrayBuffer.isView(v)) buffers.add(v.buffer); };
  for (const o of objects) {
    if (o.geometry) {
      for (const a of Object.values(o.geometry.attributes)) add(a.array);
      add(o.geometry.index?.array);
    }
    add(o.instanceMatrix?.array);
    add(o.instanceColor?.array ?? undefined);
  }
  // Data textures referenced from node materials keep their pixels in image.data.
  const seen = new Set<unknown>();
  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || seen.has(node) || depth > 40 || ArrayBuffer.isView(node)) return;
    seen.add(node);
    const t = node as { isTexture?: boolean; image?: { data?: ArrayBufferView } };
    if (t.isTexture) { add(t.image?.data); return; }
    for (const v of Object.values(node as Record<string, unknown>)) if (v && typeof v === 'object') visit(v, depth + 1);
  };
  for (const m of materials) visit(m, 0);
  let bytes = 0;
  for (const b of buffers) bytes += b.byteLength;
  return bytes;
}

export interface MeasureOptions {
  /**
   * Draw the first frames with the shadow map off and turn it on only after
   * the release pass has run: the shadow cascades then build their pipelines
   * over released geometry, the late second pass a device frame can meet.
   */
  lazyShadows?: boolean;
  /**
   * After the release, move the camera to an 8 m close-up on the Apollo block
   * with cars of every kind around it (near vd trees and the vd fleet bodies),
   * and draw two more frames.
   */
  closeUp?: boolean;
}

/** One sedan, taxi, van and bus per few metres around (x, z), in the vehicle sim's snapshot layout. */
async function vehicleSnapshot(x: number, z: number): Promise<number[]> {
  const { DEFAULT_ENV_STATE, packEnvSection } = await import('./living-city/clock.ts');
  const { emptyPedSection } = await import('./living-city/ped-sim.ts');
  const { emptySignalSection } = await import('./living-city/signal-viz.ts');
  const { VSNAP_STRIDE } = await import('./living-city/vehicle-sim.ts');
  const records: number[][] = [];
  for (let i = 0; i < 16; i++) {
    const kind = i % 4;
    const vx = x + ((i % 2) * 2 - 1) * 3;
    const vz = z - 20 + i * 3;
    records.push([100 + i, kind, vx, vz, 0, vx, vz, 0, 5, 0, 9, 0]);
  }
  return [
    1, 1, 1 / 24, records.length, VSNAP_STRIDE, 3, 0, 0, ...records.flat(), ...emptyPedSection(), ...emptySignalSection(),
    ...packEnvSection({ ...DEFAULT_ENV_STATE, lampLevel: 1, headlights: 1 }, 3),
  ];
}

/**
 * Builds the scene with a vehicle actor and draws its frames: the first, then
 * RELEASE_SETTLE_FRAMES + 1 more so world/release-uploaded.ts (when its flag
 * is on) has dropped what the first uploaded. Optional late passes follow.
 */
export async function measureFirstFrame(options: MeasureOptions = {}): Promise<FirstFrame> {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('./render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals();
  const THREE = await import('three/webgpu');
  const { parseCityDataset } = await import('./city-dataset.ts');
  const { createCityScene } = await import('./city-scene.ts');
  (await import('./world/vd-port/blocks/load-from-disk.test-support.ts')).loadVdBlocksFromDisk();
  const { physicalRendererParams } = await import('./world/physical-look.ts');
  const { createVehicleActor } = await import('./living-city/vehicle-actor.ts');
  const { RELEASE_SETTLE_FRAMES } = await import('./world/release-uploaded.ts');
  const { trapReleasedReads } = await import('./world/release-uploaded.test-support.ts');
  const { advanceNodeFrame } = await import('@acme/ui/three/internals');

  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('./data/harlem-apollo.json', import.meta.url), 'utf8')));
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(WIDTH, HEIGHT), device, antialias: true, ...physicalRendererParams() } as never);
  await renderer.init();
  renderer.setPixelRatio(2);
  renderer.setSize(WIDTH / 2, HEIGHT / 2, false);
  const params = { camera: { x: 0, z: 0, yaw: 0, distance: 200 }, dataset };
  const cars = options.closeUp ? await vehicleSnapshot(0, 0) : null;
  const built = createCityScene({ THREE, renderer, invalidate: () => {} } as never, {
    ...params,
    actors: [createVehicleActor({ read: () => cars, focus: () => ({ x: params.camera.x, z: params.camera.z, fwdX: 0, fwdZ: 1 }) })],
  } as never);
  const trap = trapReleasedReads();
  let time = 0;
  // The app's per-frame order (render-runtime/game-render.ts draw, ThreeCanvas.tsx):
  // update, advance the node frame, render. Without the advance, three's
  // per-frame nodes (the post pipeline's scene pass among them) run once, and
  // every frame after the first draws only the output quad.
  const frame = () => {
    time += 1 / 60;
    built.update!({ delta: 1 / 60, time, reducedMotion: false } as never, params as never);
    advanceNodeFrame(renderer as never);
    renderer.render(built.scene as never, built.camera as never);
  };
  const shadows = renderer.shadowMap.enabled;
  if (options.lazyShadows) renderer.shadowMap.enabled = false;

  const allocated0 = getHeapStatistics().total_allocated_bytes;
  const cpu0 = process.cpuUsage();
  const wall0 = performance.now();
  const stringified = countTypedArrayStringification(frame);
  const frame0Ms = performance.now() - wall0;
  const cpu = process.cpuUsage(cpu0);
  const frame0CpuMs = (cpu.user + cpu.system) / 1000;
  const frame0AllocatedBytes = getHeapStatistics().total_allocated_bytes - allocated0;

  const materials = new Set<unknown>();
  const names = new Set<string>();
  const objects: Obj[] = [];
  (built.scene as InstanceType<typeof THREE.Scene>).traverse((o) => {
    if (o.name) names.add(o.name);
    objects.push(o as unknown as Obj);
    const m = (o as { material?: unknown }).material;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) materials.add(x);
  });
  trap.pause();
  const retainedFirst = retainedArrayBytes(objects, materials);
  trap.resume();
  const before = { draws: record.draws, writeBytes: record.writeBytes };
  for (let i = 0; i <= RELEASE_SETTLE_FRAMES; i++) frame();
  trap.pause();
  const retainedAfterRelease = retainedArrayBytes(objects, materials);
  trap.resume();
  const settled = {
    shaderModules: record.shaders.length,
    distinctShaderModules: new Set(record.shaders).size,
    wgslBytes: record.shaders.reduce((n, code) => n + code.length, 0),
    renderPipelines: record.renderPipelines,
    computePipelines: record.computePipelines,
    textureBytes: record.textureBytes,
    bufferBytes: record.bufferBytes,
    draws: record.draws - before.draws,
    writeBytes: record.writeBytes - before.writeBytes,
  };
  let lateWriteBytes = 0;
  if (options.lazyShadows) {
    renderer.shadowMap.enabled = shadows;
    const w = record.writeBytes;
    frame();
    frame();
    lateWriteBytes += record.writeBytes - w;
  }
  if (options.closeUp) {
    params.camera = { x: 0, z: 0, yaw: 0.6, distance: 8 };
    frame();
    frame();
  }
  trap.uninstall();
  const result: FirstFrame = {
    shaderModules: settled.shaderModules,
    distinctShaderModules: settled.distinctShaderModules,
    wgslBytes: settled.wgslBytes,
    renderPipelines: settled.renderPipelines,
    computePipelines: settled.computePipelines,
    materials: materials.size,
    textureBytes: settled.textureBytes,
    bufferBytes: settled.bufferBytes,
    writeBytes: before.writeBytes,
    draws: before.draws,
    retainedArrayBytes: retainedFirst,
    retainedAfterReleaseBytes: retainedAfterRelease,
    secondFrameDraws: settled.draws,
    secondFrameWriteBytes: settled.writeBytes,
    lateWriteBytes,
    frame0Ms,
    frame0CpuMs,
    frame0AllocatedBytes,
    stringified,
    clustered: renderer.lighting.constructor.name.includes('Clustered'),
    names,
    pipelines: [...record.pipelineVertexBuffers],
    releasedArrays: trap.released,
    releasedReads: Object.fromEntries(trap.reads),
  };
  built.dispose?.();
  return result;
}

/** One log line per measured config, so a run's numbers can be compared by eye. */
export function logFirstFrame(label: string, frame: FirstFrame): void {
  const { names: _names, stringified: _s, pipelines, releasedReads, ...numbers } = frame;
  const maxVertexBuffers = Math.max(0, ...pipelines.map((p) => p.buffers));
  console.info(`[first-frame] ${label}`, JSON.stringify({ ...numbers, maxVertexBuffers, releasedReads }));
}

/** The first frame's cost, as measureFirstFrame reports it. */
export type FrameCost = Pick<FirstFrame, 'frame0Ms' | 'frame0CpuMs' | 'frame0AllocatedBytes' | 'shaderModules' | 'renderPipelines'>;

/**
 * measureFirstFrame in a fresh node process with `env` over this one's: the world flags are read at import, so a
 * second config needs its own process. For holding one config's first-frame cost against another's on the same
 * machine in the same run.
 */
export function measureFirstFrameInChild(env: Readonly<Record<string, string | undefined>>): FrameCost {
  const url = new URL('./city-scene.physical-first-frame.test-support.ts', import.meta.url).href;
  const code = `const m = await import(${JSON.stringify(url)});
const f = await m.measureFirstFrame();
const pick = ({ frame0Ms, frame0CpuMs, frame0AllocatedBytes, shaderModules, renderPipelines }) => ({ frame0Ms, frame0CpuMs, frame0AllocatedBytes, shaderModules, renderPipelines });
process.stdout.write('\\n@@first-frame@@' + JSON.stringify(pick(f)) + '\\n');`;
  const merged = {} as NodeJS.ProcessEnv;
  for (const [k, v] of Object.entries({ ...process.env, ...env })) if (v !== undefined) merged[k] = v;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: merged, encoding: 'utf8', maxBuffer: 64 << 20 });
  const line = out.split('\n').find((l) => l.startsWith('@@first-frame@@'));
  if (!line) throw new Error(`child first-frame run printed no result:\n${out.slice(-2000)}`);
  return JSON.parse(line.slice('@@first-frame@@'.length)) as FrameCost;
}
