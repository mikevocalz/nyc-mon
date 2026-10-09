import type { Vec3 } from '../types/index.ts';

/** Scene scale the radii are tuned for. Approach is not evaluated in `screen` or `preview`: there is no viewer pose. */
export type ApproachTier = 'tabletop' | 'room';

export const APPROACH_TIERS: readonly ApproachTier[] = ['tabletop', 'room'];

/** Enter and exit radius for one tier, metres, measured on the floor plane (x, z). */
export interface ApproachRadii {
  readonly enterM: number;
  readonly exitM: number;
}

/** Configuration for {@linkcode createApproachMachine}. */
export interface ApproachConfig {
  readonly radii: Readonly<Record<ApproachTier, ApproachRadii>>;
  /** Half-angle of the forward cone, degrees, in (0, 180]. The target must sit inside it to start dwelling. */
  readonly fovHalfAngleDeg: number;
  /** Time the target must stay inside enter radius and cone before the trigger starts. 0 starts on the first frame. */
  readonly dwellMs: number;
  /** Quiet time after a trigger ends before any target can start dwelling. */
  readonly cooldownMs: number;
  /** Triggers allowed per session. A new session is a new `initialState`. */
  readonly maxTriggersPerSession: number;
}

/**
 * Room-scale defaults. Every number here is a design choice, not canon: the
 * Bible and the brief give no approach distances, angles or timings.
 */
export const DEFAULT_APPROACH_CONFIG: ApproachConfig = {
  radii: {
    tabletop: { enterM: 0.6, exitM: 0.8 },
    room: { enterM: 1.5, exitM: 2 },
  },
  fovHalfAngleDeg: 30,
  dwellMs: 750,
  cooldownMs: 20_000,
  maxTriggersPerSession: 12,
};

/** The viewer's head this frame, LOCAL_FLOOR space. `forward` need not be normalised; a zero vector sees nothing. */
export interface ApproachViewer {
  readonly position: Vec3;
  readonly forward: Vec3;
}

/** Something that can be approached, usually the Mon. */
export interface ApproachTarget {
  readonly id: string;
  readonly position: Vec3;
}

/**
 * One frame of input. `nowMs` comes from the caller; the machine never reads
 * a clock. `advance` throws `RangeError` on a non-finite time or coordinate
 * instead of storing it, so a bad frame from the pose source cannot poison
 * the state.
 */
export interface ApproachFrame {
  readonly nowMs: number;
  readonly tier: ApproachTier;
  readonly viewer: ApproachViewer;
  readonly targets: readonly ApproachTarget[];
}

/**
 * A named rule that blocks approach this frame (the Mon is asleep, a menu is
 * open, the Caller is mid-action). Injected at construction; any match ends
 * an active trigger and resets dwell.
 */
export interface ApproachSuppression {
  readonly id: string;
  readonly isSuppressed: (frame: ApproachFrame) => boolean;
}

/** Machine state. Plain data; safe to keep in a store or serialise. */
export interface ApproachState {
  readonly lastNowMs: number | null;
  /** Targets currently dwelling, with the time each entered. */
  readonly dwelling: Readonly<Record<string, number>>;
  readonly active: { readonly targetId: string; readonly sinceMs: number } | null;
  readonly cooldownUntilMs: number | null;
  readonly triggeredCount: number;
}

export type ApproachEndReason = 'left-exit-radius' | 'target-gone' | 'suppressed';

export type ApproachEvent =
  | { readonly type: 'approach-started'; readonly targetId: string; readonly atMs: number }
  | {
      readonly type: 'approach-ended';
      readonly targetId: string;
      readonly atMs: number;
      readonly reason: ApproachEndReason;
      readonly suppressionId: string | null;
    };

export interface ApproachStep {
  readonly state: ApproachState;
  readonly events: readonly ApproachEvent[];
}

/** A validated approach machine. `advance` is pure. */
export interface ApproachMachine {
  readonly config: ApproachConfig;
  readonly initialState: ApproachState;
  advance(state: ApproachState, frame: ApproachFrame): ApproachStep;
}

const INITIAL_STATE: ApproachState = {
  lastNowMs: null,
  dwelling: {},
  active: null,
  cooldownUntilMs: null,
  triggeredCount: 0,
};

function validate(config: ApproachConfig): void {
  for (const tier of APPROACH_TIERS) {
    const { enterM, exitM } = config.radii[tier];
    if (!(Number.isFinite(enterM) && enterM > 0)) {
      throw new RangeError(`radii.${tier}.enterM must be a positive number, got ${enterM}`);
    }
    if (!(Number.isFinite(exitM) && exitM > enterM)) {
      throw new RangeError(`radii.${tier}.exitM must be greater than enterM (${enterM}) for hysteresis, got ${exitM}`);
    }
  }
  const fov = config.fovHalfAngleDeg;
  if (!(Number.isFinite(fov) && fov > 0 && fov <= 180)) {
    throw new RangeError(`fovHalfAngleDeg must be in (0, 180], got ${fov}`);
  }
  if (!(Number.isFinite(config.dwellMs) && config.dwellMs >= 0)) {
    throw new RangeError(`dwellMs must be a non-negative number, got ${config.dwellMs}`);
  }
  if (!(Number.isFinite(config.cooldownMs) && config.cooldownMs >= 0)) {
    throw new RangeError(`cooldownMs must be a non-negative number, got ${config.cooldownMs}`);
  }
  if (!(Number.isInteger(config.maxTriggersPerSession) && config.maxTriggersPerSession >= 0)) {
    throw new RangeError(`maxTriggersPerSession must be a non-negative integer, got ${config.maxTriggersPerSession}`);
  }
}

const finiteVec = (v: Vec3): boolean => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

/** Throws on a frame whose time or coordinates are not finite, before it can reach the state. */
function validateFrame(frame: ApproachFrame): void {
  if (!Number.isFinite(frame.nowMs)) throw new RangeError(`frame.nowMs must be finite, got ${frame.nowMs}`);
  if (!finiteVec(frame.viewer.position) || !finiteVec(frame.viewer.forward)) {
    throw new RangeError('frame.viewer position and forward must be finite');
  }
  for (const target of frame.targets) {
    if (!finiteVec(target.position)) throw new RangeError(`target ${target.id} position must be finite`);
  }
}

function floorDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/** True when `target` is inside the viewer's forward cone. A target at the eye counts as seen. */
function inCone(viewer: ApproachViewer, target: Vec3, cosHalfAngle: number): boolean {
  const dx = target.x - viewer.position.x;
  const dy = target.y - viewer.position.y;
  const dz = target.z - viewer.position.z;
  const toLength = Math.hypot(dx, dy, dz);
  if (toLength === 0) return true;
  const { x, y, z } = viewer.forward;
  const forwardLength = Math.hypot(x, y, z);
  if (forwardLength === 0) return false;
  return (dx * x + dy * y + dz * z) / (toLength * forwardLength) >= cosHalfAngle;
}

/**
 * Builds the approach-trigger machine (ADR 0012). Throws `RangeError` on a
 * config that breaks an invariant, including `exitM <= enterM` for any tier.
 *
 * Per frame, in order: time is clamped so it never runs backwards; an active
 * trigger ends if suppressed, if its target is gone, or once the target is
 * farther than the exit radius (the cone is not rechecked while active); with
 * no active trigger, cooldown and the session cap gate dwell; a target dwells
 * while inside the enter radius and the cone, and starts the trigger once it
 * has dwelt `dwellMs`. Ties go to the longest dwell, then the nearest, then the
 * lowest id. Only one trigger is active at a time.
 */
export function createApproachMachine(
  config: ApproachConfig,
  suppressions: readonly ApproachSuppression[] = [],
): ApproachMachine {
  validate(config);
  const cosHalfAngle = Math.cos((config.fovHalfAngleDeg * Math.PI) / 180);

  function advance(state: ApproachState, frame: ApproachFrame): ApproachStep {
    validateFrame(frame);
    const now = state.lastNowMs === null ? frame.nowMs : Math.max(state.lastNowMs, frame.nowMs);
    const radii = config.radii[frame.tier];
    const events: ApproachEvent[] = [];
    const suppression = suppressions.find((rule) => rule.isSuppressed(frame)) ?? null;
    let { active, cooldownUntilMs, triggeredCount } = state;

    if (active !== null) {
      const activeId = active.targetId;
      const target = frame.targets.find((t) => t.id === activeId);
      let reason: ApproachEndReason | null = null;
      if (suppression !== null) reason = 'suppressed';
      else if (target === undefined) reason = 'target-gone';
      else if (floorDistance(frame.viewer.position, target.position) > radii.exitM) reason = 'left-exit-radius';
      if (reason === null) {
        return { state: { ...state, lastNowMs: now, dwelling: {} }, events };
      }
      events.push({
        type: 'approach-ended',
        targetId: activeId,
        atMs: now,
        reason,
        suppressionId: suppression?.id ?? null,
      });
      active = null;
      cooldownUntilMs = now + config.cooldownMs;
    }

    const blocked =
      suppression !== null ||
      triggeredCount >= config.maxTriggersPerSession ||
      (cooldownUntilMs !== null && now < cooldownUntilMs);
    if (blocked) {
      return { state: { lastNowMs: now, dwelling: {}, active, cooldownUntilMs, triggeredCount }, events };
    }

    const dwelling: Record<string, number> = {};
    let best: { id: string; since: number; distance: number } | null = null;
    for (const target of frame.targets) {
      const distance = floorDistance(frame.viewer.position, target.position);
      if (distance > radii.enterM || !inCone(frame.viewer, target.position, cosHalfAngle)) continue;
      const since = state.dwelling[target.id] ?? now;
      dwelling[target.id] = since;
      if (now - since < config.dwellMs) continue;
      const better =
        best === null ||
        since < best.since ||
        (since === best.since && (distance < best.distance || (distance === best.distance && target.id < best.id)));
      if (better) best = { id: target.id, since, distance };
    }

    if (best === null) {
      return { state: { lastNowMs: now, dwelling, active, cooldownUntilMs, triggeredCount }, events };
    }
    events.push({ type: 'approach-started', targetId: best.id, atMs: now });
    return {
      state: {
        lastNowMs: now,
        dwelling: {},
        active: { targetId: best.id, sinceMs: now },
        cooldownUntilMs,
        triggeredCount: triggeredCount + 1,
      },
      events,
    };
  }

  return { config, initialState: INITIAL_STATE, advance };
}
