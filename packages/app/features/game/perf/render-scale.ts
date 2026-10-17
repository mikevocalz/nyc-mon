// perf/render-scale.ts — lane L6, "holding frame rate". Behind
// EXPO_PUBLIC_WORLD_RENDER_SCALE (default OFF, the L1–L5 truthy set) a
// controller samples drawn-frame pacing and, every 1.5 s of wall time,
// steps the render scale: ×0.9 while the measured draw rate sits below
// the tier's target band, ×1.05 while above it, clamped to [floor, 1.0].
// The constants reimplement the Flying Roadster's measured values
// (scale drops 0.1 below target, rises 0.05 above it, every 1.5 s,
// floored at 0.5 on phones). RENDER_SCALE_FLOOR is PROVISIONAL — it is
// the spec item pending Mike's sign-off; treat 0.5 as a placeholder
// until he does.
//
// What it measures, honestly: the interval between scene update() calls —
// the draw cadence on whichever thread the canvas runs (the JS thread
// today; the worklet render runtime calls the same update). That is
// frame-PRODUCTION pacing. It catches a slow draw path and a starved rAF
// alike, but it is NOT the GPU's frame time and NOT the Android UI
// thread. The Duo's UI-thread ceiling — the Rive-view/compositor cost the
// lane-c investigation pins near 25 fps (docs/performance/
// ui-thread-investigation-2026-10-16.md) — is outside what this can fix:
// a UI-bound frame reads here as a long interval and pushes the scale
// down without the cause being GPU load. Report GPU-side gains from
// device traces separately; do not tune the bands against that ceiling.
//
// The read path mirrors the Duo frame probe on the sibling stack
// perf/nycmon-duo-frame-probe-20261016 (features/game/perf/
// frame-sampler.ts): the same performance.now() clock the actors' tick
// already uses in city-scene.ts, and the same 250 ms parked-gap cutoff,
// so idle on-demand gaps never count as slow frames. No second clock is
// invented.
//
// How scale applies: WebGPURenderer exposes no dedicated resolution
// option — the dynamic knob is the pixel ratio (three r186
// renderers/common/CanvasTarget.js: setPixelRatio → setSize →
// domElement.width/height = logical × ratio). We hold the logical size
// and shrink the drawing buffer via
// renderer.setPixelRatio(deviceRatio × scale); the view upscales on
// present, and post-pass targets follow through the renderer's resize
// event. Chosen over setDrawingBufferSize (identical effect, more
// bookkeeping) and over a renderer `resolution` option (does not exist
// on this renderer — checked against three@0.186.1's Renderer).
// DEVICE-PENDING: react-native-webgpu honouring canvas.width/height
// changes after configure — the mechanism is the standard one, but only
// a device frame proves the swapchain shrinks instead of re-reading a
// stale size. Buffer resize is also a sync point: a scale change lands a
// frame or two later, which the 1.5 s cadence tolerates.
//
// Hysteresis: the tier's target band is the deadband — inside it, hold.
// A reversal of the last applied direction must persist
// `reversalWindows` (default 2) evaluations before it applies, so a rate
// wobbling across a band edge cannot flip the scale back and forth
// every 1.5 s. Same-direction steps apply every window — stepwise
// convergence is the design, and the ×0.9/×1.05 asymmetry biases a
// settled sequence downward on purpose.
//
// Timestamps are injected (frame(now, pixelRatio) — ms, any monotonic
// clock), so tests drive synthetic frame times with no rAF. Logging
// follows the '[NYC-Mon/perf] …' console.info convention of the frame
// probe: one line per evaluation window, opt-in with the flag.

import { parseSkyRigFlag } from '../world/sky-rig.ts';

/** Opt-in L6 flag — default OFF. Same truthy set as the L1–L5 flags. */
export const EXPERIMENTAL_WORLD_RENDER_SCALE = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_RENDER_SCALE);

/**
 * PROVISIONAL — the spec's floor item pending Mike's sign-off. 0.5 is the
 * Flying Roadster's measured phone floor, kept here as the default until
 * the sign-off lands; the mount takes `floor` as an option so the final
 * value is a one-line change.
 */
export const RENDER_SCALE_FLOOR = 0.5;

/** The controller's tuning constants — Flying Roadster measured unless marked. */
export const RENDER_SCALE = {
  /** Decision cadence, ms of wall time between evaluations. */
  intervalMs: 1500,
  /** Scale multiplier per evaluation below the band ("drops 0.1" → ×0.9). */
  downFactor: 0.9,
  /** Scale multiplier per evaluation above the band ("rises 0.05" → ×1.05). */
  upFactor: 1.05,
  /** The scale never exceeds 1 — this only ever lowers fill cost. */
  ceiling: 1,
  /**
   * Gaps past this between drawn frames are parked (the on-demand canvas
   * stopped drawing), not slow frames — the frame probe's convention.
   */
  activeIntervalMaxMs: 250,
  /** Fewer active intervals than this in a window → hold, not enough signal. */
  minWindowFrames: 3,
  /** Windows an opposite-direction verdict must persist before it applies. */
  reversalWindows: 2,
  /** Bound on the in-memory decision log (~3 min of decisions at cadence). */
  decisionCap: 120,
} as const;

/** The tier's target draw-rate band in frames per second, [low, high]. */
export interface RenderScaleBand {
  /** Below this → the scale steps down. */
  low: number;
  /** Above this → the scale steps up. */
  high: number;
}

export type RenderScaleVerdict = 'down' | 'up' | 'hold';

/** One evaluation window's record — the scale log the device gate asks for. */
export interface RenderScaleDecision {
  /** Window-end timestamp, same clock as the fed frames. */
  at: number;
  /**
   * Estimated draw rate: active intervals only — mean inter-update gap
   * inverted. JS-submission/UI-thread pacing, NOT GPU frame time; null
   * when the window had no active interval.
   */
  fps: number | null;
  /** Active (non-parked) intervals counted in the window. */
  frames: number;
  verdict: RenderScaleVerdict;
  /** Scale before and after the decision — equal on holds and clamps. */
  from: number;
  to: number;
  reason: string;
}

export interface RenderScaleControllerOptions {
  /** The tier's target fps band — the deadband. Required. */
  band: RenderScaleBand;
  /** Scale floor — PROVISIONAL, pending Mike sign-off. Default RENDER_SCALE_FLOOR. */
  floor?: number;
  /** Scale ceiling. Default 1. */
  ceiling?: number;
  /** Evaluation cadence, ms. Default 1500. */
  intervalMs?: number;
  /** Per-window multipliers. Defaults ×0.9 / ×1.05. */
  downFactor?: number;
  upFactor?: number;
  /** Parked-gap cutoff, ms. Default 250 (the frame probe's). */
  activeIntervalMaxMs?: number;
  /** Minimum active intervals for a window to be decided. Default 3. */
  minWindowFrames?: number;
  /** Windows a reversal must persist. Default 2; 1 disables damping. */
  reversalWindows?: number;
  /** Starting scale. Default the ceiling (full resolution). */
  startScale?: number;
  /** Bound on the decisions log. Default 120. */
  decisionCap?: number;
}

export interface RenderScaleController {
  /**
   * One drawn frame at timestamp `now` (ms, monotonic, any clock).
   * Returns the decision when this frame closed an evaluation window,
   * else null.
   */
  frame(now: number): RenderScaleDecision | null;
  /** Current scale, in [floor, ceiling]. */
  readonly scale: number;
  /** Bounded log of every evaluated window — the audit for the device gate. */
  readonly decisions: readonly RenderScaleDecision[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The pure controller: frame timestamps in, scale decisions out.
 * Deterministic — no clock, no rAF, no renderer — so tests feed synthetic
 * pacing and assert exact boundaries. mountRenderScale attaches it to a
 * renderer.
 */
export function createRenderScaleController(
  options: RenderScaleControllerOptions,
): RenderScaleController {
  const { band } = options;
  const floor = options.floor ?? RENDER_SCALE_FLOOR;
  const ceiling = options.ceiling ?? RENDER_SCALE.ceiling;
  const intervalMs = options.intervalMs ?? RENDER_SCALE.intervalMs;
  const downFactor = options.downFactor ?? RENDER_SCALE.downFactor;
  const upFactor = options.upFactor ?? RENDER_SCALE.upFactor;
  const activeMax = options.activeIntervalMaxMs ?? RENDER_SCALE.activeIntervalMaxMs;
  const minFrames = options.minWindowFrames ?? RENDER_SCALE.minWindowFrames;
  const reversalWindows = Math.max(1, options.reversalWindows ?? RENDER_SCALE.reversalWindows);
  const cap = Math.max(1, options.decisionCap ?? RENDER_SCALE.decisionCap);

  if (!Number.isFinite(band.low) || !Number.isFinite(band.high) || band.low <= 0 || band.high < band.low) {
    throw new Error('render-scale: band needs 0 < low <= high fps');
  }
  if (!(floor > 0 && floor <= ceiling && ceiling <= 1)) {
    throw new Error('render-scale: need 0 < floor <= ceiling <= 1');
  }

  let scale = clamp(options.startScale ?? ceiling, floor, ceiling);
  let lastAt: number | null = null;
  let windowStart: number | null = null;
  let intervalSum = 0;
  let intervalCount = 0;
  /** Direction of the last decision that actually moved the scale. */
  let lastMoved: 'down' | 'up' | null = null;
  let pendingDir: 'down' | 'up' | null = null;
  let pendingCount = 0;
  const decisions: RenderScaleDecision[] = [];

  const record = (d: RenderScaleDecision): RenderScaleDecision => {
    decisions.push(d);
    if (decisions.length > cap) decisions.shift();
    return d;
  };

  const apply = (dir: 'down' | 'up'): number => {
    const next = clamp(dir === 'down' ? scale * downFactor : scale * upFactor, floor, ceiling);
    if (next !== scale) lastMoved = dir;
    scale = next;
    return scale;
  };

  const evaluate = (now: number): RenderScaleDecision => {
    const frames = intervalCount;
    // Mean active inter-frame gap inverted; parked gaps are already excluded.
    const fps = frames > 0 ? (frames * 1000) / intervalSum : null;
    const from = scale;

    let verdict: RenderScaleVerdict;
    let reason: string;
    if (fps === null || frames < minFrames) {
      verdict = 'hold';
      reason = 'insufficient frames (parked or sparse)';
    } else if (fps < band.low) {
      verdict = 'down';
      reason = `${fps.toFixed(1)} fps below ${band.low}`;
    } else if (fps > band.high) {
      verdict = 'up';
      reason = `${fps.toFixed(1)} fps above ${band.high}`;
    } else {
      verdict = 'hold';
      reason = `${fps.toFixed(1)} fps inside [${band.low}, ${band.high}]`;
    }

    if (verdict === 'hold') {
      pendingDir = null;
      pendingCount = 0;
      return record({ at: now, fps, frames, verdict, from, to: scale, reason });
    }

    const dir = verdict;
    if (dir === lastMoved && pendingDir !== null) {
      // A verdict back in the applied direction while a reversal was
      // pending: the wobble cancelled it. Hold, don't resume — under
      // strict alternation applying here would creep the scale every
      // other window.
      const cancelled = pendingDir;
      pendingDir = null;
      pendingCount = 0;
      return record({
        at: now, fps, frames,
        verdict: 'hold', from, to: scale,
        reason: `${reason}; cancelled ${cancelled} reversal`,
      });
    }
    if (lastMoved === null || dir === lastMoved) {
      apply(dir);
      if (scale === from) {
        verdict = 'hold';
        reason = `${reason}; clamped at ${dir === 'down' ? 'floor' : 'ceiling'} ${scale}`;
      }
      return record({ at: now, fps, frames, verdict, from, to: scale, reason });
    }

    // Reversal damping: an opposite-direction verdict must persist.
    pendingCount = pendingDir === dir ? pendingCount + 1 : 1;
    pendingDir = dir;
    if (pendingCount < reversalWindows) {
      return record({
        at: now, fps, frames,
        verdict: 'hold', from, to: scale,
        reason: `${reason}; reversal ${pendingCount}/${reversalWindows} after ${lastMoved}`,
      });
    }
    apply(dir);
    pendingDir = null;
    pendingCount = 0;
    return record({ at: now, fps, frames, verdict, from, to: scale, reason });
  };

  return {
    frame(now: number): RenderScaleDecision | null {
      if (!Number.isFinite(now)) return null;
      if (lastAt !== null) {
        const dt = now - lastAt;
        // Only live pacing counts: zero/negative and parked gaps are skipped.
        if (dt > 0 && dt <= activeMax) {
          intervalSum += dt;
          intervalCount++;
        }
      }
      lastAt = now;
      windowStart ??= now;
      if (now - windowStart < intervalMs) return null;
      const decision = evaluate(now);
      windowStart = now;
      intervalSum = 0;
      intervalCount = 0;
      return decision;
    },
    get scale() {
      return scale;
    },
    decisions,
  };
}

/** What the mount needs from a renderer — WebGPURenderer satisfies it; tests fake it. */
export interface RenderScaleRenderer {
  setPixelRatio(value: number): void;
  getPixelRatio(): number;
}

export interface MountRenderScaleOptions extends RenderScaleControllerOptions {
  /**
   * Per-window log sink — default one console.info line, the frame
   * probe's '[NYC-Mon/perf] …' convention. Guarded for runtimes without a
   * console (a worklet runtime may not have one).
   */
  log?: (decision: RenderScaleDecision) => void;
}

export interface RenderScaleMount {
  /**
   * From the scene's update: the drawn-frame timestamp (the same clock
   * the actors' tick uses) and the frame's device pixel ratio — the
   * scale multiplies it, it is never the scaled value itself.
   */
  frame(now: number, basePixelRatio: number): void;
  /** After a canvas resize re-asserted the raw device ratio — re-applies the scale. */
  resized(): void;
  readonly scale: number;
  readonly band: RenderScaleBand;
  readonly decisions: readonly RenderScaleDecision[];
  /** Restores the device pixel ratio (scale 1). Idempotent. */
  dispose(): void;
}

const defaultScaleLog = (d: RenderScaleDecision): void => {
  globalThis.console?.info?.('[NYC-Mon/perf] render scale', {
    verdict: d.verdict,
    fps: d.fps === null ? null : Number(d.fps.toFixed(1)),
    scale: Number(d.to.toFixed(3)),
    frames: d.frames,
    reason: d.reason,
  });
};

/**
 * Attaches the controller to the renderer. The device ratio comes from
 * the frames (the canvas's min(PixelRatio.get(), maxPixelRatio), or the
 * worklet snapshot's packed ratio); the effective ratio the renderer
 * keeps is base × scale. setPixelRatio early-returns inside three when
 * unchanged, so re-asserting every frame is free — and self-heals after
 * the canvas's own applySize re-stamps the raw device ratio.
 */
export function mountRenderScale(
  renderer: RenderScaleRenderer,
  options: MountRenderScaleOptions,
): RenderScaleMount {
  const controller = createRenderScaleController(options);
  const log = options.log ?? defaultScaleLog;
  let baseRatio = renderer.getPixelRatio();
  if (!Number.isFinite(baseRatio) || baseRatio <= 0) baseRatio = 1;
  let disposed = false;

  const assertRatio = () => {
    if (!disposed) renderer.setPixelRatio(baseRatio * controller.scale);
  };

  return {
    frame(now: number, basePixelRatio: number): void {
      if (disposed) return;
      if (Number.isFinite(basePixelRatio) && basePixelRatio > 0) baseRatio = basePixelRatio;
      const decision = controller.frame(now);
      if (decision) log(decision);
      assertRatio();
    },
    resized(): void {
      assertRatio();
    },
    get scale() {
      return controller.scale;
    },
    get band() {
      return options.band;
    },
    get decisions() {
      return controller.decisions;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      // Back to the device ratio — scale 1 — before the canvas tears down.
      renderer.setPixelRatio(baseRatio);
    },
  };
}
