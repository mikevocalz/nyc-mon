'use client';
import { Pressable, Text, View } from '../tw';
import type { LcdColors } from './lcd-model';
import { PixelGlyph } from './PixelGlyph';
import type { PixelGlyphName } from './pixel-glyphs';

export interface LcdIconButtonProps {
  glyph: PixelGlyphName;
  /** Visible word under the icon and the button's name. */
  label: string;
  /** Spoken hint, e.g. "Feeds a meal". */
  hint?: string;
  /** The A-cursor is on this icon: drawn as a solid cell plus a pointer, never by colour alone. */
  focused: boolean;
  /** The icon cannot do anything now (still focusable and announced as dimmed). */
  disabled?: boolean;
  colors: LcdColors;
  onPress: () => void;
  /** Points per glyph cell. @default 3 */
  cell?: number;
  testID?: string;
}

/**
 * One icon of the Mon Space icon bar, on the LCD. Tapping it selects it
 * directly (A and B at once); the cursor shows as an inverted cell with a
 * pointer under it. At least 44 pt square with the word under the glyph.
 */
export function LcdIconButton({ glyph, label, hint, focused, disabled = false, colors, onPress, cell = 3, testID }: LcdIconButtonProps) {
  const fg = focused ? colors.ground : colors.ink;
  return (
    <View testID={testID} className="flex-1">
    <Pressable
      role="button"
      aria-label={label}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected: focused, disabled }}
      aria-disabled={disabled}
      onPress={onPress}
      className="min-h-target min-w-target items-center justify-center gap-1 py-1"
    >
      <View
        className="items-center justify-center p-1"
        style={{ backgroundColor: focused ? colors.ink : 'transparent', borderRadius: 3, opacity: disabled ? 0.45 : 1 }}
      >
        <PixelGlyph glyph={glyph} cell={cell} color={fg} />
      </View>
      <Text className="text-type-caption" numberOfLines={1} style={{ color: colors.ink, opacity: disabled ? 0.6 : 1 }}>{label}</Text>
      <View style={{ width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: focused ? colors.ink : 'transparent' }} />
    </Pressable>
    </View>
  );
}
