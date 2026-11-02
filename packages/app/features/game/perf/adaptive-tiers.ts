// perf/adaptive-tiers.ts — Phase 6 (PR 6) slice 1, "measured quality
// tiers". Behind EXPO_PUBLIC_WORLD_ADAPTIVE (default OFF, the same truthy
// set as the L1–L6 flags) a policy reads the closed FrameSampleWindow
// reports the frame probe already produces (perf/frame-sampler.ts) and
// steps the world's quality rungs down and back: the streaming preset row,
// the sun shadow refresh interval, and the render/upscale scale. Flag off:
// no sampler, no sink, no policy — nothing below exists and the frame path
// is byte-identical to before.
//
// What it measures, honestly: cpuMs is JS render submission (update +
// nodeFrame + render + present) on whichever thread the canvas runs — the
// same channel render-scale and the GAME_PERF probe read — NOT the GPU's
// frame time, and NOT the Android UI thread. gpuMs, when the
// EXPO_PUBLIC_WORLD_PERF timestamp channel is armed and resolving, is the
// GPU half of the split (docs/implementation/profiling.md §1): it lags at
// least one draw and stays sparse under backpressure. A window whose gpu
// block is null or thin classifies on cpu alone — the encode-bound order,
// which is also the honest default: per-draw TSL/JSI submit encode is the
// measured wall (engine-audit §8.1). Every threshold below is a
// host-chosen default — the iPad A12X run that retunes them is still
// pending (engine-audit §7: iOS entirely unmeasured).
//
// The remedies, cheapest-first per bound class. A window reads 'encode'
// when cpuP50 dominates its budget (or gpu is absent — the Duo's wall is
// encode), 'render' when a populated gpu channel dominates:
//
//   encode: tier → shadowInterval → scale
//     tier            WORLD_PRESETS row swap (cell-stream setPreset):
//                     thresholds, budgets, hysteresis, per-frame stream
//                     budget. Residency drains through the normal
//                     evictAfterS path — a downgrade shrinks the want set
//                     over seconds, not instantly. Mount-time fields
//                     (vdPort external budgets, shadowTile, the pipeline's
//                     mount-time upscaleScale) do NOT follow the swap.
//     shadowInterval  1 → 2 → 4 → 8 drawn frames between cascade
//                     re-renders — the WORLD_SHADOW_INTERVAL mechanism,
//                     applied live (physical-rig setShadowInterval). The
//                     cascades are ~60 % of submit encode on the harness,
//                     so this is the encode remedy with the most headroom.
//     scale           ×0.85 per step to the floor: render-bound's usual
//                     knob, kept last for encode because dropping pixels
//                     does nothing for a per-draw encode wall.
//   render: scale → tier → shadowInterval
//     gpu dominating means fill/dispatch, so the input-resolution step
//     moves first — scenePass.setResolutionScale under the upscale slot
//     ('upscaleScale'), else the pixel-ratio channel ('renderScale').
//
// Upgrades restore: the applied-step history is a stack, and M sustained
// headroom windows pop the most recent step — the restore lands on the
// exact previous value (no drift from repeated factors), and a tier swap
// back never exceeds the mounted preset, which the canvas picked from the
// device class.
//
// Hysteresis and guardrails:
// - over needs K consecutive windows before one step; headroom needs M —
//   asymmetric, so a wobbling measurement cannot flap a rung every window.
// - after any applied step a cooldown of C windows counts nothing: the
//   change has to reach the metrics (a preset swap settles over
//   evictAfterS seconds) before the next verdict.
// - inconclusive windows (a mostly parked on-demand canvas — the probe's
//   parked-interval convention) count toward nothing.
// - floors: the preset ladder's last rung, shadow interval 8
//   (parseShadowInterval's cap), scaleFloor. A step never crosses them.
// - explicit beats adaptive: an env-pinned preset keeps its row, an
//   env-pinned shadow interval its refresh, and an armed render-scale
//   controller owns the scale channel outright — each suppressed kind is
//   simply not a candidate.
//
// Seam: the same ThreeFrameTiming channel recordCityFrame already reads
// (ThreeCanvas onFrameTiming → perf/on-city-frame.ts). The scene registers
// its controller on adaptiveFrameBridge — the living-city adaptive-bridge
// convention — so the sink stays null, and costs nothing, until a flagged
// scene mounts.
//
// Pure: no three import, no clock, no env reads past the flag — node
// tests drive it by feeding real pushes through FrameSampleWindow.

import type { FrameTimingSample, FrameTimingSummary } from './frame-sampler.ts';
import { FrameSampleWindow } from './frame-sampler.ts';
import { RENDER_SCALE_FLOOR } from './render-scale.ts';
import type { WorldPresetName } from './tier-presets.ts';
import { parseSkyRigFlag } from '../world/sky-rig.ts';

/** Opt-in Phase 6 flag — default OFF. Same truthy set as the L1–L6 flags. */
export const EXPERIMENTAL_WORLD_ADAPTIVE = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_ADAPTIVE);

// ---- The policy table -------------------------------------------------------
//
// Honest defaults, device-tunable — the iPad run retunes every ms here.
// cpuMs = JS submission; gpuMs = GPU pass total (sparse). 'Over' fires a
// downgrade after K windows; 'restore' is the headroom mark for upgrades.

/** Per-tier-frame budgets. The phone row's over mark is the 60 Hz deadline itself. */
export interface AdaptiveTierBudget {
  /** cpuP50Ms above this → over-budget on the encode side. */
  cpuOverMs: number;
  /** cpuP50Ms at or under this → headroom on the encode side. */
  cpuRestoreMs: number;
  /** gpu.p50Ms above this → over-budget on the render side; read only when the channel is populated. */
  gpuOverMs: number;
  /** gpu.p50Ms at or under this → headroom on the render side. */
  gpuRestoreMs: number;
}

export const ADAPTIVE_TIER_BUDGETS: Record<WorldPresetName, AdaptiveTierBudget> = {
  // 'high' expects an M-class iPad or a desktop: sub-60 pacing should sit
  // well under the deadline, so it starts giving up rungs earlier.
  high: { cpuOverMs: 13, cpuRestoreMs: 10, gpuOverMs: 12, gpuRestoreMs: 9 },
  'ipad-a12x': { cpuOverMs: 15, cpuRestoreMs: 12, gpuOverMs: 14, gpuRestoreMs: 10 },
  // The deadline is 1000/60; restore asks real headroom, not marginal recovery.
  phone: { cpuOverMs: 1000 / 60, cpuRestoreMs: 1000 / 75, gpuOverMs: 15, gpuRestoreMs: 11 },
};

/** The controller's tuning constants. Defaults marked PROVISIONAL need the iPad run. */
export const ADAPTIVE_TIER = {
  /** Consecutive over-budget windows before one downgrade step. */
  downWindows: 2,
  /** Consecutive headroom windows before one restore — slower than down on purpose (render-scale's asymmetry). */
  upWindows: 4,
  /** Windows after an applied step that count nothing — the change needs evictAfterS seconds to reach the metrics. */
  cooldownWindows: 2,
  /** Scale multiplier per downgrade step. render-scale's measured convention is ×0.9 on 1.5 s windows; a 120-sample window is a slower cadence, so the step is a little deeper. PROVISIONAL. */
  scaleDownFactor: 0.85,
  /** Scale floor — render-scale's RENDER_SCALE_FLOOR, PROVISIONAL pending Mike's sign-off there too. */
  scaleFloor: RENDER_SCALE_FLOOR,
  /** Shadow refresh rungs, drawn frames between cascade re-renders; 8 is parseShadowInterval's cap. */
  shadowSteps: [2, 4, 8] as readonly number[],
  /** Resolved gpuMs samples a window needs before its gpu block may classify the bound — the channel stays sparse under backpressure. */
  minGpuSamples: 10,
  /** Actively-paced intervals a window needs to classify at all; a mostly parked canvas is inconclusive. */
  minActiveIntervals: 30,
  /** Bound on the applied-action history (the perf log's audit and the restore stack). */
  actionCap: 32,
} as const;

/** Preset rungs, best to cheapest — a step down moves one entry right. */
export const ADAPTIVE_PRESET_LADDER: readonly WorldPresetName[] = ['high', 'ipad-a12x', 'phone'];

// ---- Types ------------------------------------------------------------------

/** What a window's overage points at: 'encode' = cpu-dominated (or gpu absent), 'render' = gpu-dominated. */
export type AdaptiveBound = 'encode' | 'render';

/** Which scale channel the scene mounted: the upscale slot's input scale, or the pixel-ratio path. */
export type AdaptiveScaleChannel = 'upscaleScale' | 'renderScale';

export type AdaptiveAction =
  | { readonly kind: 'tier'; readonly from: WorldPresetName; readonly to: WorldPresetName; readonly reason: string }
  | { readonly kind: 'shadowInterval'; readonly from: number; readonly to: number; readonly reason: string }
  | { readonly kind: 'upscaleScale'; readonly from: number; readonly to: number; readonly reason: string }
  | { readonly kind: 'renderScale'; readonly from: number; readonly to: number; readonly reason: string };

export type AdaptiveActionKind = AdaptiveAction['kind'];

type AdaptiveRemedy = 'tier' | 'shadowInterval' | 'scale';

/** Downgrade candidate order per bound class — the spec's ladder for encode, scale-first for render. */
const DOWN_ORDER: Record<AdaptiveBound, readonly AdaptiveRemedy[]> = {
  encode: ['tier', 'shadowInterval', 'scale'],
  render: ['scale', 'tier', 'shadowInterval'],
};

export interface AdaptiveTierOptions {
  /** The WorldPreset the scene mounted with — the ladder's starting rung and its ceiling on restores. */
  startPreset: WorldPresetName;
  /** Which kind scale steps emit: 'upscaleScale' when the pipeline's upscale slot is mounted, else 'renderScale'. */
  scaleChannel: AdaptiveScaleChannel;
  /**
   * Which remedies may actuate — an explicit user/env pick or an absent feature suppresses its kind
   * (city-scene: preset env / streamer absent → tier off; shadow-interval env / no rig sun → shadow off;
   * an armed render-scale controller → scale off). Default: all on.
   */
  tier?: boolean;
  shadowInterval?: boolean;
  scale?: boolean;
  /** Starting scale on the channel (e.g. upscalePass.getResolutionScale()). Default 1. */
  startScale?: number;
  /** Ladder's lowest rung the tier may reach — the defined floor. Default the ladder's last entry. */
  floorPreset?: WorldPresetName;
  budgets?: Record<WorldPresetName, AdaptiveTierBudget>;
  downWindows?: number;
  upWindows?: number;
  cooldownWindows?: number;
  scaleDownFactor?: number;
  scaleFloor?: number;
  minGpuSamples?: number;
  minActiveIntervals?: number;
  actionCap?: number;
  /** Actuation callback — the scene's apply switch. Absent: the policy still evaluates and records. */
  apply?: (action: AdaptiveAction) => void;
  /** Per-action log sink; default one '[NYC-Mon/perf] adaptive' line. Guarded for runtimes without a console. */
  log?: (action: AdaptiveAction) => void;
}

export interface AdaptiveTierPolicy {
  /** One closed FrameSampleWindow report. Returns the action to apply, else null. */
  report(summary: FrameTimingSummary): AdaptiveAction | null;
  /** Current preset rung. */
  readonly preset: WorldPresetName;
  /** Current shadow refresh interval in drawn frames. */
  readonly shadowInterval: number;
  /** Current scale factor on the channel (startScale untouched = full). */
  readonly scale: number;
  /** The last classified window's bound, null before the first over window. */
  readonly bound: AdaptiveBound | null;
  /** Bounded applied-action history — the perf log's audit and the restore stack's record. */
  readonly actions: readonly AdaptiveAction[];
}

/**
 * The pure controller: closed window reports in, actions out. The state is
 * the rung indices plus the streak/cooldown counters — deterministic, so
 * tests feed synthetic windows and assert exact transitions. The consumer
 * owns actuation through `apply`.
 */
export function createAdaptiveTierPolicy(options: AdaptiveTierOptions): AdaptiveTierPolicy {
  const budgets = options.budgets ?? ADAPTIVE_TIER_BUDGETS;
  const ladder = ADAPTIVE_PRESET_LADDER;
  const startIdx = Math.max(0, ladder.indexOf(options.startPreset));
  const floorRequested = options.floorPreset !== undefined ? ladder.indexOf(options.floorPreset) : -1;
  const floorIdx = floorRequested < 0 ? ladder.length - 1 : Math.max(startIdx, floorRequested);
  const allowTier = options.tier !== false;
  const allowShadow = options.shadowInterval !== false;
  const allowScale = options.scale !== false;
  const downWindows = Math.max(1, options.downWindows ?? ADAPTIVE_TIER.downWindows);
  const upWindows = Math.max(1, options.upWindows ?? ADAPTIVE_TIER.upWindows);
  const cooldownWindows = Math.max(0, options.cooldownWindows ?? ADAPTIVE_TIER.cooldownWindows);
  const scaleDownFactor = options.scaleDownFactor ?? ADAPTIVE_TIER.scaleDownFactor;
  const scaleFloor = options.scaleFloor ?? ADAPTIVE_TIER.scaleFloor;
  const minGpuSamples = Math.max(1, options.minGpuSamples ?? ADAPTIVE_TIER.minGpuSamples);
  const minActiveIntervals = Math.max(0, options.minActiveIntervals ?? ADAPTIVE_TIER.minActiveIntervals);
  const cap = Math.max(1, options.actionCap ?? ADAPTIVE_TIER.actionCap);
  const shadowSteps = ADAPTIVE_TIER.shadowSteps;
  const shadowMax = shadowSteps[shadowSteps.length - 1]!;

  let presetIdx = startIdx;
  let shadow = 1;
  let scale = options.startScale ?? 1;
  let overStreak = 0;
  let underStreak = 0;
  let cooldown = 0;
  let lastBound: AdaptiveBound | null = null;
  const actions: AdaptiveAction[] = [];
  /** Applied down-steps, most recent last — a restore pops it. */
  const undo: AdaptiveAction[] = [];

  const emit = (action: AdaptiveAction, isDown: boolean): AdaptiveAction => {
    actions.push(action);
    if (actions.length > cap) actions.shift();
    if (isDown) {
      undo.push(action);
      if (undo.length > cap) undo.shift();
    }
    return action;
  };

  const budget = (): AdaptiveTierBudget => budgets[ladder[presetIdx]!] ?? budgets.phone;

  const downgrade = (bound: AdaptiveBound, reason: string): AdaptiveAction | null => {
    for (const remedy of DOWN_ORDER[bound]) {
      if (remedy === 'tier' && allowTier && presetIdx < floorIdx) {
        const action: AdaptiveAction = { kind: 'tier', from: ladder[presetIdx]!, to: ladder[presetIdx + 1]!, reason };
        presetIdx++;
        return emit(action, true);
      }
      if (remedy === 'shadowInterval' && allowShadow && shadow < shadowMax) {
        const next = shadowSteps.find((v) => v > shadow) ?? shadowMax;
        const action: AdaptiveAction = { kind: 'shadowInterval', from: shadow, to: next, reason };
        shadow = next;
        return emit(action, true);
      }
      if (remedy === 'scale' && allowScale && scale > scaleFloor) {
        const next = Math.max(scaleFloor, scale * scaleDownFactor);
        if (next === scale) continue;
        const action: AdaptiveAction = { kind: options.scaleChannel, from: scale, to: next, reason };
        scale = next;
        return emit(action, true);
      }
    }
    return null;
  };

  const upgrade = (reason: string): AdaptiveAction | null => {
    const last = undo.pop();
    if (!last) return null;
    if (last.kind === 'tier') {
      const back = ladder.indexOf(last.from);
      if (back < 0 || back >= presetIdx) return null; // the stack drifted — do not restore above the mount
      const action: AdaptiveAction = { kind: 'tier', from: ladder[presetIdx]!, to: last.from, reason };
      presetIdx = back;
      return emit(action, false);
    }
    if (last.kind === 'shadowInterval') {
      const action: AdaptiveAction = { kind: 'shadowInterval', from: shadow, to: last.from, reason };
      shadow = last.from;
      return emit(action, false);
    }
    const action: AdaptiveAction = { kind: last.kind, from: scale, to: last.from, reason };
    scale = last.from;
    return emit(action, false);
  };

  return {
    report(s: FrameTimingSummary): AdaptiveAction | null {
      // A step just landed: its effect is still working through the
      // streamer/atlas, so the window classifies nothing.
      if (cooldown > 0) {
        cooldown--;
        return null;
      }
      if (s.activeIntervals < minActiveIntervals) return null; // mostly parked — inconclusive
      const b = budget();
      const gpu = s.gpu !== null && s.gpu.samples >= minGpuSamples ? s.gpu.p50Ms : null;
      const overCpu = s.cpuP50Ms > b.cpuOverMs;
      const overGpu = gpu !== null && gpu > b.gpuOverMs;
      if (overCpu || overGpu) {
        underStreak = 0;
        overStreak++;
        // Which half of the split dominates: compare each channel against
        // its own budget so the marks stay honest when the budgets differ.
        lastBound = overGpu && (!overCpu || gpu / b.gpuOverMs > s.cpuP50Ms / b.cpuOverMs) ? 'render' : 'encode';
        if (overStreak < downWindows) return null;
        const action = downgrade(
          lastBound,
          `cpuP50 ${s.cpuP50Ms.toFixed(1)}/${b.cpuOverMs}ms gpuP50 ${gpu === null ? 'n/a' : gpu.toFixed(1)}/${b.gpuOverMs}ms, ${lastBound}-bound, over ${overStreak} windows`,
        );
        if (action) {
          overStreak = 0;
          cooldown = cooldownWindows;
        }
        return action;
      }
      overStreak = 0;
      const under = s.cpuP50Ms <= b.cpuRestoreMs && (gpu === null || gpu <= b.gpuRestoreMs);
      if (!under) {
        underStreak = 0; // flat band between over and restore — the hysteresis deadband
        return null;
      }
      underStreak++;
      if (underStreak < upWindows) return null;
      const action = upgrade(
        `cpuP50 ${s.cpuP50Ms.toFixed(1)} <= ${b.cpuRestoreMs}ms${gpu === null ? '' : ` gpuP50 ${gpu.toFixed(1)} <= ${b.gpuRestoreMs}ms`}, headroom ${underStreak} windows`,
      );
      if (action) {
        underStreak = 0;
        cooldown = cooldownWindows;
      }
      return action;
    },
    get preset() {
      return ladder[presetIdx]!;
    },
    get shadowInterval() {
      return shadow;
    },
    get scale() {
      return scale;
    },
    get bound() {
      return lastBound;
    },
    get actions() {
      return actions;
    },
  };
}

// ---- The sampler → policy → actuation seam ----------------------------------

export interface AdaptiveTierController {
  /**
   * One drawn-frame timing sample — the ThreeCanvas onFrameTiming probe's
   * ThreeFrameTiming is structurally a FrameTimingSample. Feeds the
   * window; on a closed report the policy decides and `apply` runs.
   */
  push(sample: FrameTimingSample): void;
  readonly preset: WorldPresetName;
  readonly shadowInterval: number;
  readonly scale: number;
  readonly bound: AdaptiveBound | null;
  /** Bounded applied-action history — the perf log's audit. */
  readonly actions: readonly AdaptiveAction[];
  /** The last closed window's report, for the perf log. */
  readonly lastSummary: FrameTimingSummary | null;
}

const defaultAdaptiveLog = (a: AdaptiveAction): void => {
  globalThis.console?.info?.('[NYC-Mon/perf] adaptive', { kind: a.kind, from: a.from, to: a.to, reason: a.reason });
};

/**
 * Sampler + policy + actuation: the flag-on object the scene owns. Every
 * push lands in a FrameSampleWindow (the probe's own bounded window), a
 * closed report goes to the policy, and an emitted action runs through the
 * consumer's `apply` and the perf log. A diagnostics path must never take
 * down the renderer — apply failures warn and continue, matching
 * ThreeCanvas's own onFrameTiming guard.
 */
export function createAdaptiveTierController(options: AdaptiveTierOptions): AdaptiveTierController {
  const sampler = new FrameSampleWindow();
  const policy = createAdaptiveTierPolicy(options);
  const apply = options.apply;
  const log = options.log ?? defaultAdaptiveLog;
  let lastSummary: FrameTimingSummary | null = null;
  return {
    push(sample: FrameTimingSample): void {
      const report = sampler.push(sample);
      if (!report) return;
      lastSummary = report;
      const action = policy.report(report);
      if (action) {
        try {
          apply?.(action);
        } catch (error) {
          globalThis.console?.warn?.('[NYC-Mon/perf] adaptive apply failed', error);
        }
        log(action);
      }
    },
    get preset() {
      return policy.preset;
    },
    get shadowInterval() {
      return policy.shadowInterval;
    },
    get scale() {
      return policy.scale;
    },
    get bound() {
      return policy.bound;
    },
    get actions() {
      return policy.actions;
    },
    get lastSummary() {
      return lastSummary;
    },
  };
}

/**
 * The per-scene frame sink, the living-city adaptive-bridge convention:
 * city-scene assigns its controller's push while mounted and clears it on
 * dispose, so perf/on-city-frame.ts can forward samples without importing
 * the scene. Flag off ⇒ push stays null ⇒ zero cost.
 */
export const adaptiveFrameBridge: { push: ((sample: FrameTimingSample) => void) | null } = { push: null };
