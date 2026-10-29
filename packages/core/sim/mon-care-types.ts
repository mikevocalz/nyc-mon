import type {
  AttentionCall,
  CallKind,
  CareAction,
  CareState,
  ClassicCareState,
  EvolutionEvent,
  IdleVignetteDef,
  LifecycleStage,
  MonInstance,
} from '../types/index.ts';
import type { CareOutcome } from './care.ts';
import type { ClassicTuning } from './classic-tuning.ts';
import type { CareEvent } from './state.ts';
import type { CareTuning } from './tuning.ts';
import type { ScheduledVignette } from './vignettes.ts';

/** Everything the classic care tick advances for one Mon. */
export interface MonCareState {
  readonly mon: MonInstance;
  /** Server-replicated care (Payload `care-states`, MCP, queue replay). */
  readonly care: CareState;
  /** Local-first classic layer (save v4 `classic`). */
  readonly classic: ClassicCareState;
}

/** Options for {@linkcode stepMonCare}, {@linkcode applyMonCareAction} and the selectors. */
export interface ClassicOptions {
  /** @default DEFAULT_CLASSIC_TUNING */
  readonly tuning?: ClassicTuning;
  /** @default DEFAULT_CARE_TUNING */
  readonly careTuning?: CareTuning;
  /** Local minute of day 0..1439 for an epoch ms. Injected so the sim stays clock- and timezone-free. */
  readonly localMinuteOfDay: (ms: number) => number;
  /** Seed for poop jitter, colds, dose counts and false calls. Keep it stable per Mon. */
  readonly seed: number;
}

/** A Caller action on the care screen. */
export type MonCareAction =
  /** feed (meal, or snack via `food.foodClassId === 'snack'`), rest, wake, play, pause, resume. */
  | CareAction
  /** Flushes every pile. */
  | { readonly kind: 'clean' }
  /** One dose of medicine. */
  | { readonly kind: 'medicine' }
  /** Answers a false call; outside one it does nothing. */
  | { readonly kind: 'discipline' }
  | { readonly kind: 'lights'; readonly on: boolean };

/** What the classic layer reports for a tick or an action, in time order. */
export type ClassicEvent =
  | { readonly type: 'call-opened'; readonly call: AttentionCall; readonly real: boolean; readonly at: number }
  | { readonly type: 'call-answered'; readonly callId: string; readonly at: number }
  | { readonly type: 'care-mistake'; readonly callId: string; readonly kind: CallKind; readonly at: number }
  | { readonly type: 'pooped'; readonly piles: number; readonly at: number }
  | { readonly type: 'cleaned'; readonly piles: number; readonly at: number }
  | { readonly type: 'caught-cold'; readonly at: number }
  | { readonly type: 'dose-given'; readonly remaining: number; readonly at: number }
  | { readonly type: 'cold-cured'; readonly at: number }
  | { readonly type: 'disciplined'; readonly level: number; readonly at: number }
  | { readonly type: 'bedtime'; readonly at: number }
  | { readonly type: 'lights-changed'; readonly on: boolean; readonly at: number }
  | { readonly type: 'paused'; readonly at: number }
  | { readonly type: 'resumed'; readonly at: number }
  | { readonly type: 'evolution-ready'; readonly event: EvolutionEvent; readonly at: number };

/** Result of {@linkcode stepMonCare}. */
export interface MonCareResult {
  readonly state: MonCareState;
  readonly careEvents: readonly CareEvent[];
  readonly classicEvents: readonly ClassicEvent[];
  /**
   * Server-replayable care writes the classic layer caused (the bedtime
   * auto-sleep `rest`, the morning `wake`). The store enqueues them.
   */
  readonly derivedCareWrites: readonly { readonly at: number; readonly action: CareAction }[];
  readonly vignettes: readonly ScheduledVignette[];
}

/** Outcome of {@linkcode applyMonCareAction}. */
export type MonCareOutcome =
  | Exclude<CareOutcome, { kind: 'declined' }>
  | { readonly kind: 'cleaned'; readonly piles: number }
  | { readonly kind: 'dosed'; readonly remaining: number }
  | { readonly kind: 'cured' }
  | { readonly kind: 'disciplined'; readonly level: number }
  | { readonly kind: 'nothing-to-discipline' }
  | { readonly kind: 'lights'; readonly on: boolean }
  | {
      readonly kind: 'declined';
      readonly reason: Extract<CareOutcome, { kind: 'declined' }>['reason'] | 'has-cold' | 'no-cold';
    };

/** The number of hearts in a 4-heart row. */
export type Hearts = 0 | 1 | 2 | 3 | 4;

/** Everything the care screen, the widget and notifications read. From {@linkcode selectMonCareView}. */
export interface MonCareView {
  readonly hearts: { readonly fullness: Hearts; readonly social: Hearts; readonly energy: Hearts };
  readonly poop: Hearts;
  readonly cold: { readonly dosesRemaining: number } | null;
  readonly discipline: Hearts;
  readonly weight: number;
  readonly asleep: boolean;
  readonly lights: 'on' | 'off';
  readonly paused: boolean;
  /** The call to show: the oldest open call, real calls before false calls. */
  readonly call: { readonly kind: CallKind; readonly openedAt: number; readonly msLeft: number } | null;
  /** 'call' when any real call is open (LED, widget, notifications); a false call lights the LED but never notifies. */
  readonly attention: 'none' | 'call' | 'false-call';
  /** Unpaused whole days in the current stage. */
  readonly ageDays: number;
  readonly stage: LifecycleStage;
}

/** Care history that picks an evolution branch (Decision 12). From {@linkcode careHistoryOf}. */
export interface CareHistory {
  readonly mistakes: number;
  readonly discipline: number;
  readonly weightBand: 'under' | 'normal' | 'over';
  readonly bond: number;
}

/** Options for {@linkcode stepMonCare}: {@linkcode ClassicOptions} plus the idle-vignette table. */
export interface StepMonCareOptions extends ClassicOptions {
  readonly vignettes?: readonly IdleVignetteDef[];
}
