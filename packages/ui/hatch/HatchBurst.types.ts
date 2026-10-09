import type { SharedValue } from 'react-native-reanimated';

export interface HatchBurstProps {
  /** 0–1, UI thread; the bloom curve is authored inside (`burstOpacity`), peak at 0.36 of the 500 ms. */
  progress: SharedValue<number>;
  /** Peak opacity cap: 0.6 phone, 0.4 Quest 2D window. */
  peakOpacity: 0.6 | 0.4;
  /** Renders nothing. */
  reducedMotion: boolean;
  /** Side of the square the burst fills. @default 320 */
  sizePt?: number;
  testID?: string;
}
