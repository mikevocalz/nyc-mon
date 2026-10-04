import type { CareState, MonInstance } from '../types/index.ts';

/** Everything the care sim advances for one individual. */
export interface SimState {
  readonly mon: MonInstance;
  readonly care: CareState;
}

export type CareEvent =
  | { readonly type: 'food-requested'; readonly at: number }
  | { readonly type: 'needs-attention'; readonly need: 'energy' | 'fullness' | 'social'; readonly at: number }
  | { readonly type: 'woke'; readonly cause: 'rested' | 'caller'; readonly at: number }
  | { readonly type: 'fell-asleep'; readonly at: number }
  | { readonly type: 'became-sluggish'; readonly until: number; readonly at: number }
  | { readonly type: 'sluggish-ended'; readonly at: number };

/** A span of constant activity inside an advanced window. */
export interface ActivitySpan {
  readonly from: number;
  readonly to: number;
  readonly activity: 'awake' | 'asleep';
}
