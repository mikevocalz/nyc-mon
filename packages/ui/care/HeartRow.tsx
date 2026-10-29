'use client';
import { Text, View } from '../tw';
import { CARE_COLORS } from './care-colors';
import { PixelGlyph } from './PixelGlyph';
import { fourMarks } from './pixel-glyphs';

export interface HeartRowProps {
  /** 0..4 full hearts (`heartsFor` in `@acme/core/sim` maps a 0..1 meter). */
  filled: number;
  /** The meter's word ("Hunger", "Happy", "Energy"). Shown unless `hideLabel`. */
  label: string;
  /** Spoken, e.g. "Hunger, 3 of 4 hearts". The hearts themselves are decorative. */
  accessibilityLabel: string;
  /** Page scheme (CARE_COLORS) for the default tint; ignored when `color` is set. */
  scheme?: 'daylit' | 'night';
  /** Overrides the tint, e.g. the LCD ink. One colour for every row: no red, no per-meter tint. */
  color?: string;
  /** Unlit-heart colour when `color` is set (LCD unlit cells). */
  emptyColor?: string;
  /** Points per heart cell. @default 3 */
  cell?: number;
  /** The label sits outside the row (the LCD prints its own). */
  hideLabel?: boolean;
  /** Label text class; @default text-type-caption text-text */
  labelClassName?: string;
  testID?: string;
}

/**
 * Four hearts for one care meter (Mon Space, Home, the glass): full hearts
 * then empty outlines, one tint, no number and no red. Replaces the percent
 * ring wherever a care meter shows. One text element to assistive tech; the
 * count is in its words, never only in the picture.
 */
export function HeartRow({
  filled, label, accessibilityLabel, scheme = 'daylit', color, emptyColor, cell = 3, hideLabel = false,
  labelClassName = 'text-type-caption text-text', testID,
}: HeartRowProps) {
  const full = color ?? CARE_COLORS.fill[scheme];
  const empty = color === undefined ? CARE_COLORS.fill[scheme] : (emptyColor ?? color);
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
      <View className="flex-row items-center" style={{ gap: cell * 2 }}>
        {fourMarks(filled).map((on, i) => (
          <PixelGlyph key={i} glyph={on ? 'heart' : 'heartEmpty'} cell={cell} color={on ? full : empty} />
        ))}
      </View>
    </View>
  );
}
