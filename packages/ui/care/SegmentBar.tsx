'use client';
import { Text, View } from '../tw';
import { PixelGlyph } from './PixelGlyph';
import { fourMarks } from './pixel-glyphs';

export interface SegmentBarProps {
  /** 0..4 lit segments. */
  filled: number;
  label: string;
  /** Spoken, e.g. "Discipline, 2 of 4". */
  accessibilityLabel: string;
  /** Lit colour. */
  color: string;
  /** Point size of one cell. @default 3 */
  cell?: number;
  hideLabel?: boolean;
  labelClassName?: string;
  testID?: string;
}

/**
 * A four-segment bar (Mon Space discipline): lit blocks then outlined ones,
 * one colour. Not a score and not a ProgressBar: it counts quarters.
 */
export function SegmentBar({ filled, label, accessibilityLabel, color, cell = 3, hideLabel = false, labelClassName = 'text-type-caption text-text', testID }: SegmentBarProps) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      role="img"
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
      className="flex-row items-center gap-3"
    >
      {hideLabel ? null : <Text className={`${labelClassName} min-w-16`} numberOfLines={1}>{label}</Text>}
      <View className="flex-row items-center" style={{ gap: cell }}>
        {fourMarks(filled).map((on, i) => (
          <PixelGlyph key={i} glyph={on ? 'segmentOn' : 'segmentOff'} cell={cell * 1.4} color={color} />
        ))}
      </View>
    </View>
  );
}
