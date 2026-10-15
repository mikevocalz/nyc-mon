import type { ReactNode } from 'react';

/** One stop on the ring (M10): a value with its visible and spoken labels. */
export interface IncubationRingStop<V extends number> {
  value: V;
  /** Visible label, e.g. `m10.option.15`. */
  label: string;
  /** Spoken label, e.g. `m10.option.15.a11y`. */
  accessibilityLabel: string;
}

/**
 * M10: a ring with discrete stops and radio semantics, plus an optional
 * elapsed arc over the chosen stop. Skia draws; it owns no state (§3.4).
 * Each stop is an accessible RN `Pressable` laid over its label, so the
 * canvas never holds focus.
 */
export interface IncubationRingChoiceProps<V extends number = number> {
  stops: readonly IncubationRingStop<V>[];
  /** null = nothing chosen (no default, D-16b). Controlled. */
  value: V | null;
  /** Omitted = display only. */
  onChange?: (value: V) => void;
  /** 0–1 elapsed, drawn over the chosen stop's arc. */
  progress?: number;
  /** Group name, e.g. `m10.ring.a11y.label`. */
  accessibilityLabel: string;
  /** The egg, or the closed case. */
  centre?: ReactNode;
  sizePt: number;
  /** Arc colours follow the page: signage black by day, banner white at night. @default 'daylit' */
  scheme?: 'daylit' | 'night';
  reducedMotion: boolean;
  testID?: string;
  /** Test ID per stop, e.g. `(v) => \`m10-option-${v}\``. */
  stopTestID?: (value: V) => string;
}

/**
 * M11: the live countdown. Progress is `(now − startedAt) / (endsAt −
 * startedAt)` from props and a frame clock, never stored. Decorative to
 * assistive tech: the time text carries the meaning (M11 07-a11y.md).
 */
export interface IncubationRingCountdownProps {
  /** `egg.createdAt` */
  startedAt: number;
  /** `egg.incubationEndsAt` */
  endsAt: number;
  /** Full: continuous on the UI thread. Reduced: one step per minute. */
  reducedMotion: boolean;
  /** @default 64 */
  sizePt?: 48 | 64;
  /** Drawn inside the ring. */
  centre?: ReactNode;
  testID?: string;
}

/** Props for `IncubationRing`: the M10 choice ring or the M11 countdown ring, told apart by `stops`. */
export type IncubationRingProps<V extends number = number> = IncubationRingChoiceProps<V> | IncubationRingCountdownProps;

export function isChoiceRing<V extends number>(p: IncubationRingProps<V>): p is IncubationRingChoiceProps<V> {
  return 'stops' in p;
}

/** Stroke widths and gap, in points (M10 tokens table; M11 4 pt stroke). */
export const RING_STROKE = { choice: 12, countdown: 4, gap: 8 } as const;
