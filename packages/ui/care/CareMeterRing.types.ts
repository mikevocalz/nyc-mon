/** One care meter as a ring with a word under it. No number is drawn (M13 P1). */
export interface CareMeterRingProps {
  need: 'energy' | 'fullness' | 'social';
  /** 0..1, from care advanced to now. */
  value: number;
  /** Visible caption, from copy (`m13.ring.*`). */
  label: string;
  /** True below the needs-you line: draws a notch at 12 o'clock and the word in `lowLabel`. */
  low: boolean;
  lowLabel: string;
  /** @default 'md' */
  size?: 'sm' | 'md';
  /** Ring colours over a daylit or a night scene. @default 'daylit' */
  scheme?: 'daylit' | 'night';
  reducedMotion: boolean;
  testID?: string;
}

/** Ring diameter and stroke per size, in points. */
export const CARE_RING_SIZE = { sm: { d: 40, stroke: 5 }, md: { d: 56, stroke: 6 } } as const;
