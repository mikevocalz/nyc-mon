import type {
  AnimationIntent,
  BloodlineId,
  CareState,
  LifecycleStage,
  MonInstance,
  MonModelSlot,
  MonMood,
  MonSceneInput,
} from '../types/index.ts';
import { listUnmetNeeds } from './care.ts';
import type { ResolvedSceneMode } from './scene-mode.ts';
import { type CareTuning, DEFAULT_CARE_TUNING } from './tuning.ts';

/** Stage order for model slots; a test pins it to `LIFECYCLE_STAGES` in schemas (sim never imports zod). */
export const MODEL_SLOT_STAGES: readonly LifecycleStage[] = ['Egg', 'Baby', 'Small', 'Mid', 'Max'];

/**
 * Mood from stored care, first match wins: asleep, sluggish, a pending food
 * request or low Fullness, low Energy, low Social, else content. "Low" is
 * `listUnmetNeeds`, so the threshold is `CareTuning.needsAttentionBelow`.
 */
export function deriveMonMood(care: CareState, tuning: CareTuning = DEFAULT_CARE_TUNING): MonMood {
  if (care.activity.kind === 'asleep') return 'asleep';
  if (care.sluggishUntil !== null && care.sluggishUntil > care.updatedAt) return 'sluggish';
  const unmet = listUnmetNeeds(care, tuning);
  if (care.pendingRequest !== null || unmet.includes('fullness')) return 'needs-fullness';
  if (unmet.includes('energy')) return 'needs-energy';
  if (unmet.includes('social')) return 'needs-social';
  return 'content';
}

/**
 * A one-shot performance the renderer is playing: eat after a feed, play
 * after a play, evolve after an evolution, hatch during M12's emerge,
 * attention when the Caller taps the Mon or at the first look, refuse after
 * a declined action. `untilMs` comes from the clip, so core holds no
 * animation lengths.
 */
export interface ActionCue {
  readonly intent: Extract<AnimationIntent, 'eat' | 'play' | 'evolve' | 'hatch' | 'attention' | 'refuse'>;
  readonly untilMs: number;
}

/** Transient presence facts the save does not hold. */
export interface ScenePresence {
  readonly nowMs: number;
  /** True while the approach trigger has an active target on this Mon. */
  readonly approachActive: boolean;
  readonly cue: ActionCue | null;
}

/** No cue, no approach: what a renderer sees when only the save is known. */
export const IDLE_PRESENCE: ScenePresence = { nowMs: 0, approachActive: false, cue: null };

/**
 * Intent, first match wins: a running cue (`nowMs < untilMs`), sleep while
 * asleep, approach while the trigger is active, else idle. A sleeping Mon
 * never plays approach or attention: a tap on a sleeping Mon does not wake
 * it, so an `attention` cue yields `sleep` while asleep.
 */
export function deriveAnimationIntent(care: CareState, presence: ScenePresence): AnimationIntent {
  const asleep = care.activity.kind === 'asleep';
  const cue = presence.cue;
  if (cue !== null && presence.nowMs < cue.untilMs && !(asleep && cue.intent === 'attention')) return cue.intent;
  if (asleep) return 'sleep';
  if (presence.approachActive) return 'approach';
  return 'idle';
}

/** Input to {@linkcode buildMonSceneInput}. */
export interface MonSceneSource {
  readonly mon: MonInstance;
  readonly care: CareState;
  /** Resolved by the caller from `@acme/content`; core never imports content. */
  readonly bloodlineId: BloodlineId;
  /**
   * The resolver's answer. Mode, placement, H-Lynk and anchors all come from
   * it, so the scene carries only anchors the resolver accepted and its mode
   * is a Phase-1 mode by type.
   */
  readonly scene: ResolvedSceneMode;
  readonly presence: ScenePresence;
  readonly tuning?: CareTuning;
}

/** Builds the renderer contract (ADR 0010). Pure; throws if `care` belongs to another Mon. */
export function buildMonSceneInput(source: MonSceneSource): MonSceneInput {
  const { mon, care } = source;
  if (care.monInstanceId !== mon.monInstanceId) {
    throw new Error(`care ${care.monInstanceId} does not belong to mon ${mon.monInstanceId}`);
  }
  const input: MonSceneInput = {
    mon: {
      monInstanceId: mon.monInstanceId,
      speciesId: mon.speciesId,
      bloodlineId: source.bloodlineId,
      stage: mon.stage,
      care: { energy: care.energy, fullness: care.fullness, social: care.social },
      mood: deriveMonMood(care, source.tuning),
      intent: deriveAnimationIntent(care, source.presence),
    },
    mode: source.scene.mode,
    placement: source.scene.placement,
    hLynk: source.scene.hLynk,
    legend: null,
  };
  return source.scene.anchors === undefined ? input : { ...input, anchors: source.scene.anchors };
}

/**
 * One empty slot per bloodline × lifecycle stage, in input order then stage
 * order. Every `glbUri` and clip is null until Mike delivers the models.
 */
export function emptyModelSlots(bloodlineIds: readonly BloodlineId[]): readonly MonModelSlot[] {
  return bloodlineIds.flatMap((bloodlineId) =>
    MODEL_SLOT_STAGES.map(
      (stage): MonModelSlot => ({
        bloodlineId,
        stage,
        glbUri: null,
        clips: {
          idle: null,
          approach: null,
          eat: null,
          sleep: null,
          play: null,
          evolve: null,
          hatch: null,
          attention: null,
          refuse: null,
        },
      }),
    ),
  );
}
