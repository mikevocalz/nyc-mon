import { nextRadioIndex } from '../radio-group.ts';

/**
 * Authored curves for the hatch primitives (M10 EggCase, M11 CaptureCase,
 * M12 HatchEgg / HatchBurst / CreatureStage, M09 MonStillReaction, M08
 * ChoiceTriptych). Every function is pure and a worklet: the components read
 * them on the UI thread from shared values, and node:test checks the shapes.
 */

/** Crack stages along `hatchProgress` (M12 04-components.md `HatchEgg`). */
export const CRACK_AT = [0.25, 0.55, 0.85] as const;

/** How many cracks show at a progress: 0 before 0.25, then 1, 2, 3. */
export function crackStage(progress: number): 0 | 1 | 2 | 3 {
  'worklet';
  if (progress >= CRACK_AT[2]) return 3;
  if (progress >= CRACK_AT[1]) return 2;
  if (progress >= CRACK_AT[0]) return 1;
  return 0;
}

/** Peak of the burst bloom inside its 500 ms, as a share of progress. */
export const BURST_PEAK_AT = 0.36;

/**
 * Burst opacity at `progress` 0–1: ease-out up to `peakOpacity` at 0.36,
 * ease-in back to 0 at 1. Never above the cap (0.6 phone, 0.4 Quest 2D
 * window, the light budget in M12 08-handoff.md).
 */
export function burstOpacity(progress: number, peakOpacity: number): number {
  'worklet';
  const p = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
  if (p <= BURST_PEAK_AT) {
    const t = p / BURST_PEAK_AT;
    return peakOpacity * (1 - (1 - t) * (1 - t));
  }
  const t = (p - BURST_PEAK_AT) / (1 - BURST_PEAK_AT);
  return peakOpacity * (1 - t * t);
}

/** Burst radius as a share of its maximum: grows fast, keeps growing while it fades. */
export function burstScale(progress: number): number {
  'worklet';
  const p = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
  return 0.2 + 0.8 * (1 - (1 - p) * (1 - p) * (1 - p));
}

/** Lid angle in degrees as it swings back on the hinge. 0 shut, `LID_OPEN_DEG` open. */
export const LID_OPEN_DEG = 100;

/**
 * Lid angle for a state and a 0–1 progress (`opening` uses progress; the
 * others are fixed). M12 adds a 12° overshoot that settles: at progress 0.8
 * the lid is past open, and it settles back by 1.
 */
export function lidAngle(lid: 'closed' | 'opening' | 'open', progress: number): number {
  'worklet';
  if (lid === 'closed') return 0;
  if (lid === 'open') return LID_OPEN_DEG;
  const p = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
  if (p <= 0.8) {
    const t = p / 0.8;
    return (LID_OPEN_DEG + 12) * (1 - (1 - t) * (1 - t));
  }
  const t = (p - 0.8) / 0.2;
  return LID_OPEN_DEG + 12 * (1 - t);
}

/** Framing presets for the creature layer; the move between them is the continuity (M12 "Continuity"). */
export type CreatureFraming = 'hatch-closeup' | 'home' | 'naming';

/** Scale and vertical offset (share of the stage height, positive = down) per framing. */
export const FRAMING: Record<CreatureFraming, { scale: number; translateY: number }> = {
  'hatch-closeup': { scale: 1.35, translateY: 0.12 },
  home: { scale: 1, translateY: 0 },
  naming: { scale: 0.8, translateY: -0.12 },
};

/** The Baby rising out of the shell during `hatch-emerge`: opacity and lift (share of height). */
export function emergePose(progress: number): { opacity: number; translateY: number } {
  'worklet';
  const p = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
  const e = 1 - (1 - p) * (1 - p);
  return { opacity: e, translateY: 0.15 * (1 - e) };
}

/**
 * First-look pose. Lean-in tips toward the Caller; hesitate tucks partly
 * aside but never turns away (D-15g: a hesitation never reads as refusal).
 * `resolved` hesitations end in the lean-in pose.
 */
export function firstLookPose(choice: 'lean-in' | 'hesitate', resolved: boolean): { scale: number; translateX: number; rotateDeg: number } {
  'worklet';
  if (choice === 'lean-in' || resolved) return { scale: 1.06, translateX: 0, rotateDeg: 0 };
  return { scale: 0.96, translateX: -0.08, rotateDeg: -4 };
}

/** One authored reaction on a 2D still (M09 `MonStillReaction`). */
export type StillReaction = 'tilt' | 'lift';

/** Total length of a still reaction, ms. */
export const REACTION_MS = 600;

/**
 * Pose of a still reaction at `t` 0–1: a tilt goes to 8° and back with a
 * small rebound; a lift rises 6 pt and settles. Ends where it started, so a
 * restart from any pose never stacks.
 */
export function reactionPose(reaction: StillReaction, t: number): { rotateDeg: number; translateYPt: number } {
  'worklet';
  const p = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const bell = Math.sin(p * Math.PI);
  if (reaction === 'tilt') {
    const rebound = p > 0.7 ? -2 * Math.sin(((p - 0.7) / 0.3) * Math.PI) : 0;
    return { rotateDeg: 8 * bell + rebound, translateYPt: 0 };
  }
  return { rotateDeg: 0, translateYPt: -6 * bell };
}

/**
 * What a key does in the triptych's radio group: an index to focus, `null`
 * to clear focus (Escape), or `undefined` when the key is not ours. Arrows
 * wrap, Home and End jump (WAI-ARIA APG radio group; `radio-group.ts`).
 */
export function triptychKey(key: string, focused: number | null, count: number): number | null | undefined {
  if (key === 'Escape') return focused === null ? undefined : null;
  return nextRadioIndex(focused ?? -1, key, count) ?? undefined;
}
