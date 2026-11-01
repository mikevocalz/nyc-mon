// GPU frame-time channel for the frame probe — three r187's own
// timestamp-query machinery, enabled per renderer under
// EXPO_PUBLIC_WORLD_PERF (default OFF). This module imports nothing at run
// time, so a worklet runtime can evaluate it (same contract as
// renderer-internals.ts, exported as `@acme/ui/three/gpu-timestamps`).
//
// The mechanism, all r187 source (`build/three.webgpu.js`):
// - `renderer.hasFeature('timestamp-query')` (typed,
//   @types/three src/renderers/common/Renderer.d.ts:1023). On the WebGPU
//   backend it reads `device.features` (WebGPUBackend.hasFeature,
//   three.webgpu.js:51596); on the WebGL2 backend it maps to the
//   `EXT_disjoint_timer_query_webgl2` extension (GLFeatureName, 34837).
// - `renderer.backend.trackTimestamp = true` arms the per-pass timestamp
//   pool — the same flip three's Inspector does post-init
//   (examples/jsm/inspector/Inspector.js:314). With the flag armed, every
//   render pass descriptor carries `timestampWrites` (WebGPUBackend
//   `initTimestampQuery`, 51209; WebGLBackend `initTimestampQuery`, 35894).
// - `renderer.resolveTimestampsAsync('render')` (typed, Renderer.d.ts:1015;
//   impl 25601 → Backend.resolveTimestampsAsync 30429 →
//   WebGPUTimestampQueryPool.resolveQueriesAsync 48173) submits a
//   resolveQuerySet + copy + mapAsync and resolves with the LAST frame's
//   total render-pass duration in ms (nanoseconds / 1e6, 48316). The pool
//   serialises concurrent resolves itself (`pendingResolve`, 48202); the
//   channel keeps its own flag so the draw path never stacks promises.
//
// Honest limits, also in docs/implementation/profiling.md:
// - The value arrives when the GPU finishes the resolve submission, so a
//   sample's gpuMs lags its own frame by at least one draw — it is the
//   last resolved frame's render-pass total, not this frame's.
// - `timestamp-query` must be in the DEVICE's features. The app's own
//   device requests every adapter feature (gpu/acquire-device.ts
//   ownDeviceDescriptor), so it is there wherever the adapter offers it;
//   the Skia-shared device (EXPO_PUBLIC_WORLD_PHYSICAL) carries only what
//   Skia's Graphite device was created with — if that omits the feature,
//   the channel stays null. Dawn's WebGPU compat mode does not expose it.
import type { WebGPURenderer } from 'three/webgpu';

/** Same truthy table as gpu/acquire-device.ts parseDeviceFlag; @acme/ui cannot import the app. */
const TRUTHY_FLAG = new Set(['1', 'true', 'on', 'yes']);

export function parseGpuPerfFlag(value: string | undefined | null): boolean {
  return value != null && TRUTHY_FLAG.has(value.trim().toLowerCase());
}

/** Opt-in, default off: the GPU timestamp-query channel (Phase 4, docs/implementation/profiling.md). */
export const WORLD_PERF_GPU_TIMESTAMPS = parseGpuPerfFlag(process.env.EXPO_PUBLIC_WORLD_PERF);

export interface GpuTimestampChannel {
  /** Unconsumed resolved render-frame GPU duration in ms; null while awaiting a fresh result. */
  gpuMs: number | null;
  /** One resolve in flight at a time — the pool dedupes too, but this keeps the draw path promise-free. */
  pending: boolean;
}

/** Each resolved duration is evidence for one sample only, never every frame while the next resolve waits. */
export function consumeGpuTimestamp(channel: GpuTimestampChannel): number | null {
  const ms = channel.gpuMs;
  channel.gpuMs = null;
  return ms;
}

/**
 * Backend internals three's d.ts does not publish (`Backend.d.ts` declares
 * only the shell). `trackTimestamp` is the same member the Inspector sets
 * directly; if a three upgrade renames it, arming logs and the channel
 * stays null rather than throwing into the render path.
 */
type TimestampBackend = { trackTimestamp?: boolean };

let warnedArm = false;

/**
 * After `renderer.init()` — `hasFeature` throws before it: flip the
 * backend's timestamp pool on where the device (or the WebGL extension)
 * supports it. Returns the channel the draw loop feeds, or null when the
 * feature is absent — callers then never pay for a resolve.
 */
export function armGpuTimestamps(renderer: WebGPURenderer): GpuTimestampChannel | null {
  try {
    if (!renderer.hasFeature('timestamp-query')) return null;
    const backend = renderer.backend as unknown as TimestampBackend;
    backend.trackTimestamp = true;
    if (backend.trackTimestamp !== true) {
      if (!warnedArm) {
        warnedArm = true;
        console.warn('[ThreeCanvas] three renamed Backend.trackTimestamp; GPU frame time is off.');
      }
      return null;
    }
    return { gpuMs: null, pending: false };
  } catch (error) {
    if (!warnedArm) {
      warnedArm = true;
      console.warn('[ThreeCanvas] GPU timestamp queries unavailable.', error);
    }
    return null;
  }
}

/**
 * Kick the async resolve for everything the pool has pending — called once
 * per drawn frame, after present, and only while a timing consumer is
 * attached (the resolve costs an extra submit + mapAsync). The landed ms
 * is read by the NEXT sample, so it is attributed to the last resolved
 * frame. Never throws: a diagnostics hook must not take down the renderer.
 * The returned promise exists for tests; callers discard it.
 */
export function kickGpuTimestampResolve(renderer: Pick<WebGPURenderer, 'resolveTimestampsAsync'>, channel: GpuTimestampChannel): Promise<void> {
  if (channel.pending) return Promise.resolve();
  channel.pending = true;
  return renderer
    .resolveTimestampsAsync('render')
    .then((ms) => {
      if (typeof ms === 'number' && Number.isFinite(ms) && ms >= 0) channel.gpuMs = ms;
    })
    .catch((error) => console.warn('[ThreeCanvas] GPU timestamp resolve failed.', error))
    .finally(() => {
      channel.pending = false;
    });
}
