// Phase 0 probes for the shared device (docs/plans/slop-grade-city-prompt.md
// §8): `shared`, `skiatex` and `pipecache`, picked with
// EXPO_PUBLIC_WORLD_PROBE under EXPO_PUBLIC_WORLD_PHYSICAL. Each one returns
// a ProbeRecord, logged as one `probe {json}` line: through game-render's
// trace on the worklet render runtime, through runtime-report's console sink
// on the JS runtime. The records carry the inputs to a non-black yes/no and
// to a stale-frame verdict as read-back pixel bytes, so the iPad log decides
// them without a capture.
//
// Pure: device, Skia and three arrive as arguments. Worklet-safe.
import type * as ThreeWebGpu from 'three/webgpu';
import { CITY_COLORS } from '../world/palette.ts';
import { isDeviceLaneProbe, WORLD_PROBE, type DeviceLaneProbe } from '../world/physical-look.ts';
import {
  createSkiaTexture, drawLabel, rgba, SKIA_TEXTURE_FORMAT, SKIA_TEXTURE_USAGE, toThreeTexture,
  type LabelSpec, type Rgba, type SkiaInterop, type SkiaTexture,
} from './skia-texture-bridge.ts';

type Three = typeof ThreeWebGpu;

/** This lane's probe from EXPO_PUBLIC_WORLD_PROBE (parsed in world/physical-look.ts); null for the light-rig probes or none. */
export const WORLD_DEVICE_PROBE: DeviceLaneProbe | null = isDeviceLaneProbe(WORLD_PROBE) ? WORLD_PROBE : null;

export type ProbeRuntime = 'js' | 'worklet';

export interface ProbeRecord {
  probe: DeviceLaneProbe;
  runtime: ProbeRuntime;
  /** The probe's pass condition held. */
  ok: boolean;
  /** Read-back pixel had any lit RGB channel; null where the probe draws nothing. */
  nonBlack: boolean | null;
  /** Wall time of the probe body, ms. */
  ms: number;
  detail: Record<string, unknown>;
}

export function formatProbeRecord(record: ProbeRecord): string {
  return `probe ${JSON.stringify(record)}`;
}

const round = (ms: number) => Math.round(ms * 10) / 10;
const toBytes = (c: Rgba) => c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
const isLit = (px: readonly number[]) => (px[0] ?? 0) + (px[1] ?? 0) + (px[2] ?? 0) > 0;

/**
 * How long a read-back may take before the probe calls it hung. On iOS,
 * react-native-skia up to 3.7.2 can leave rnskia_getWGPUInstance out of the
 * link, and then work on the imported device never settles: `mapAsync`
 * stays pending (wcandillon/react-native-skia#4305, fixed in 3.7.3 by #4306).
 * A hung probe has to say so instead of stalling the world load.
 */
export const READBACK_TIMEOUT_MS = 3000;

export class ProbeTimeout extends Error {
  constructor(what: string, ms: number) {
    super(`${what} did not settle in ${ms} ms`);
    this.name = 'ProbeTimeout';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ProbeTimeout(what, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** WebGPU spec buffer and map flags (https://www.w3.org/TR/webgpu/#buffer-usage). */
const BUFFER_COPY_DST = 0x0008;
const BUFFER_MAP_READ = 0x0001;
const MAP_READ = 0x0001;
/** copyTextureToBuffer row pitch must be a multiple of 256 bytes. */
const ROW_PITCH = 256;

/** One RGBA8 texel of a COPY_SRC texture, read on the device's own queue. */
export async function readTexturePixel(device: GPUDevice, texture: GPUTexture, x = 0, y = 0): Promise<number[]> {
  const buffer = device.createBuffer({ size: ROW_PITCH, usage: BUFFER_COPY_DST | BUFFER_MAP_READ });
  const encoder = device.createCommandEncoder();
  encoder.copyTextureToBuffer({ texture, origin: { x, y } }, { buffer, bytesPerRow: ROW_PITCH }, { width: 1, height: 1 });
  device.queue.submit([encoder.finish()]);
  await withTimeout(buffer.mapAsync(MAP_READ), READBACK_TIMEOUT_MS, 'mapAsync');
  const px = Array.from(new Uint8Array(buffer.getMappedRange(0, 4)));
  buffer.unmap();
  buffer.destroy();
  return px;
}

/** Markers for the stale-frame check: three grounds far apart in RGB. */
const FRAME_MARKERS: readonly Rgba[] = [rgba(CITY_COLORS.signGreen), rgba(CITY_COLORS.windowAmber), rgba(CITY_COLORS.neonRoyal)];

/** Nearest of: this frame's marker, the previous frame's, or black. Tolerates three's colour handling on the sampled path. */
export function classifyFrame(px: readonly number[], frame: number): 'fresh' | 'stale' | 'black' {
  const dist = (c: readonly number[]) => Math.hypot(...[0, 1, 2].map((i) => (px[i] ?? 0) - (c[i] ?? 0)));
  const fresh = dist(toBytes(FRAME_MARKERS[frame % FRAME_MARKERS.length]!));
  const stale = frame > 0 ? dist(toBytes(FRAME_MARKERS[(frame - 1) % FRAME_MARKERS.length]!)) : Infinity;
  const black = dist([0, 0, 0]);
  if (black <= fresh && black <= stale) return 'black';
  return fresh <= stale ? 'fresh' : 'stale';
}

export interface SharedProbeDeps {
  runtime: ProbeRuntime;
  device: GPUDevice | null;
  /** How the device was obtained (gpu-store source, or shared-device.ts resolveRendererDevice). */
  deviceSource: string;
  skia: SkiaInterop | null;
  now?: () => number;
}

/**
 * `shared`: a texture made on three's device is cleared by WebGPU, read
 * back, then handed to Skia's MakeImageFromGPUTexture, which accepts only
 * textures of its own device (react-native-skia 3.6.1 Image/ImageFactory.d.ts:
 * "must be created ... on the shared device"; throws if invalid). Pass:
 * the read-back is the marker and Skia takes the texture.
 */
export async function probeShared(deps: SharedProbeDeps): Promise<ProbeRecord> {
  const now = deps.now ?? (() => performance.now());
  const t0 = now();
  const detail: Record<string, unknown> = { deviceSource: deps.deviceSource, skiaOnRuntime: deps.skia !== null };
  if (!deps.device) {
    return { probe: 'shared', runtime: deps.runtime, ok: false, nonBlack: null, ms: round(now() - t0), detail: { ...detail, error: 'no device' } };
  }
  const device = deps.device;
  const texture = device.createTexture({ label: 'probe:shared', size: { width: 4, height: 4 }, format: SKIA_TEXTURE_FORMAT, usage: SKIA_TEXTURE_USAGE });
  try {
    const marker = FRAME_MARKERS[0]!;
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: texture.createView(),
        clearValue: { r: marker[0], g: marker[1], b: marker[2], a: marker[3] },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.end();
    device.queue.submit([encoder.finish()]);
    const px = await readTexturePixel(device, texture);
    detail.pixel = px;
    detail.expected = toBytes(marker);
    let skiaAccepts: boolean | null = null;
    if (deps.skia) {
      try {
        deps.skia.Image.MakeImageFromGPUTexture(texture).dispose();
        skiaAccepts = true;
      } catch (error) {
        skiaAccepts = false;
        detail.skiaError = error instanceof Error ? error.message : String(error);
      }
    }
    detail.skiaAccepts = skiaAccepts;
    const nonBlack = isLit(px);
    return { probe: 'shared', runtime: deps.runtime, ok: nonBlack && skiaAccepts === true, nonBlack, ms: round(now() - t0), detail };
  } catch (error) {
    detail.error = error instanceof Error ? error.message : String(error);
    detail.timedOut = error instanceof ProbeTimeout;
    return { probe: 'shared', runtime: deps.runtime, ok: false, nonBlack: null, ms: round(now() - t0), detail };
  } finally {
    texture.destroy();
  }
}

/** Reads what a consumer sees of a Skia-drawn texture: WebGPU copy on the JS runtime, a three render on the worklet runtime. */
export type TextureSampler = (source: SkiaTexture) => Promise<number[]>;

export interface SkiaTexProbeDeps {
  runtime: ProbeRuntime;
  device: GPUDevice | null;
  skia: SkiaInterop | null;
  sample: TextureSampler;
  /** Frames drawn per flush mode. Three markers cycle. */
  frames?: number;
  /** Per read-back; READBACK_TIMEOUT_MS by default. */
  timeoutMs?: number;
  now?: () => number;
}

const PROBE_LABEL: Omit<LabelSpec, 'ground'> = { text: 'W 125 ST', ink: rgba(CITY_COLORS.signText), scale: 4, pad: 2 };

/**
 * `skiatex`: Skia draws a sign blade through MakeFromGPUTexture, flushes,
 * and the consumer samples the corner texel (blade ground) at once. Each
 * frame uses a new ground colour, so a consumer that still sees the last
 * frame shows up as `stale`. Runs with flush() and then with flush(true).
 */
export async function probeSkiaTex(deps: SkiaTexProbeDeps): Promise<ProbeRecord> {
  const now = deps.now ?? (() => performance.now());
  const t0 = now();
  const frames = deps.frames ?? 6;
  if (!deps.device || !deps.skia) {
    const error = !deps.device ? 'no device' : 'Skia API not installed on this runtime';
    return { probe: 'skiatex', runtime: deps.runtime, ok: false, nonBlack: null, ms: round(now() - t0), detail: { error } };
  }
  const skia = deps.skia;
  const detail: Record<string, unknown> = {};
  let anyLit = false;
  let allFresh = true;
  let target: SkiaTexture | null = null;
  try {
    target = createSkiaTexture({ device: deps.device, skia, width: 64, height: 44, label: 'probe:skiatex' });
    for (const sync of [false, true]) {
      const verdicts: string[] = [];
      const timings: number[] = [];
      const pixels: number[][] = [];
      for (let frame = 0; frame < frames; frame++) {
        const spec: LabelSpec = { ...PROBE_LABEL, ground: FRAME_MARKERS[frame % FRAME_MARKERS.length]! };
        const f0 = now();
        target.draw((canvas) => drawLabel(skia, canvas, spec), { sync });
        const f1 = now();
        let px: number[];
        try {
          px = await withTimeout(deps.sample(target), deps.timeoutMs ?? READBACK_TIMEOUT_MS, 'sample');
        } catch (error) {
          if (!(error instanceof ProbeTimeout)) throw error;
          verdicts.push('timeout');
          allFresh = false;
          break;
        }
        const verdict = classifyFrame(px, frame);
        anyLit ||= isLit(px);
        if (verdict !== 'fresh') allFresh = false;
        verdicts.push(verdict);
        timings.push(round(f1 - f0));
        pixels.push(px);
      }
      detail[sync ? 'flushSync' : 'flush'] = { verdicts, drawFlushMs: timings, pixels };
    }
  } catch (error) {
    detail.error = error instanceof Error ? error.message : String(error);
    allFresh = false;
  } finally {
    target?.dispose();
  }
  return { probe: 'skiatex', runtime: deps.runtime, ok: anyLit && allFresh, nonBlack: anyLit, ms: round(now() - t0), detail };
}

/** JS runtime sampler: a WebGPU copy of the corner texel on the shared device's queue. */
export function webgpuSampler(device: GPUDevice): TextureSampler {
  return (source) => readTexturePixel(device, source.texture, 0, 0);
}

/**
 * Worklet runtime sampler: three draws a full-screen quad textured with the
 * ExternalTexture into a 4 x 4 RenderTarget and reads one pixel back
 * (three 0.186.1 Renderer.readRenderTargetPixelsAsync). The texture is
 * tagged NoColorSpace so the bytes pass through unconverted.
 */
export function threeSampler(THREE: Three, renderer: InstanceType<Three['WebGPURenderer']>): { sample: TextureSampler; dispose: () => void } {
  const target = new THREE.RenderTarget(4, 4);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  camera.position.z = 1;
  const material = new THREE.MeshBasicNodeMaterial();
  const geometry = new THREE.PlaneGeometry(2, 2);
  scene.add(new THREE.Mesh(geometry, material));
  let bound: ThreeWebGpu.Texture | null = null;
  return {
    sample: async (source) => {
      if (!bound || (bound as ThreeWebGpu.ExternalTexture).sourceTexture !== source.texture) {
        bound?.dispose();
        bound = toThreeTexture(THREE, source);
        bound.colorSpace = THREE.NoColorSpace;
        material.map = bound;
        material.needsUpdate = true;
      }
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(previous);
      const px = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 1, 1);
      return Array.from(px).slice(0, 4).map(Number);
    },
    dispose: () => {
      bound?.dispose();
      material.dispose();
      geometry.dispose();
      target.dispose();
    },
  };
}

/**
 * `pipecache`: time from the start of the render session to world-ready
 * (the first presented frame), with the stages between. Run it on a cold
 * launch and again on a second launch of the same build; the difference is
 * what Dawn's persisted pipelines buy three, if anything (the Graphite
 * article claims it for Skia's pipelines only). The launch number is not
 * known in-process; the run log labels it.
 */
export function createPipecacheTimer(runtime: ProbeRuntime, now: () => number = () => performance.now()) {
  const t0 = now();
  const marks: Record<string, number> = {};
  let done = false;
  return {
    mark(stage: string): void {
      if (!(stage in marks)) marks[stage] = round(now() - t0);
    },
    /** Returns the record once; later calls return null. */
    finish(): ProbeRecord | null {
      if (done) return null;
      done = true;
      const worldReadyMs = round(now() - t0);
      return { probe: 'pipecache', runtime, ok: true, nonBlack: null, ms: worldReadyMs, detail: { worldReadyMs, marks: { ...marks } } };
    },
  };
}
