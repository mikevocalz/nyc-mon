'use client';
import Svg, { Polygon } from 'react-native-svg';
import { Text, View } from '../tw';
import { segmentDigits, segmentMask } from './lcd-model';

export interface SegmentNumberProps {
  value: number;
  /** Digit cells; blank cells show their unlit segments. @default 2 */
  width?: number;
  /** Digit height, pt. @default 28 */
  height?: number;
  color: string;
  /** Unlit segments (decorative). */
  unlit: string;
  /** Spoken, e.g. "Weight 7". */
  accessibilityLabel: string;
  /** Unit or word drawn after the digits ("d", "wt"); decorative, the label carries it. */
  suffix?: string;
  suffixClassName?: string;
  testID?: string;
}

/** Hexagonal segments in a 10 x 18 box, order a b c d e f g. */
const SEGMENTS: readonly string[] = [
  '2,0 8,0 9,1 8,2 2,2 1,1',
  '9,1.5 10,2.5 10,7.5 9,8.5 8,7.5 8,2.5',
  '9,9.5 10,10.5 10,15.5 9,16.5 8,15.5 8,10.5',
  '2,16 8,16 9,17 8,18 2,18 1,17',
  '1,9.5 2,10.5 2,15.5 1,16.5 0,15.5 0,10.5',
  '1,1.5 2,2.5 2,7.5 1,8.5 0,7.5 0,2.5',
  '2,8 8,8 9,9 8,10 2,10 1,9',
];

/**
 * Seven-segment numerals (weight and age on the Mon Space status page), the
 * unlit segments faintly visible as on a real panel. One text element to
 * assistive tech; the number is in its words.
 */
export function SegmentNumber({ value, width = 2, height = 28, color, unlit, accessibilityLabel, suffix, suffixClassName = 'text-type-caption', testID }: SegmentNumberProps) {
  const w = (height * 10) / 18;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      role="img"
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
      className="flex-row items-end"
      style={{ gap: w * 0.3 }}
    >
      {segmentDigits(value, width).map((d, i) => {
        const mask = segmentMask(d);
        return (
          <Svg key={i} width={w} height={height} viewBox="0 0 10 18">
            {SEGMENTS.map((pts, s) => (
              <Polygon key={s} points={pts} fill={mask[s] ? color : unlit} />
            ))}
          </Svg>
        );
      })}
      {suffix ? <Text className={suffixClassName} style={{ color }}>{suffix}</Text> : null}
    </View>
  );
}
