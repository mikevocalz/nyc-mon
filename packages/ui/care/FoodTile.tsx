'use client';
import type { ReactNode } from 'react';
import { haptics } from '../haptics';
import { hiddenA11y, testIdProps } from '../hlynk/a11y';
import { Pressable, Text, View } from '../tw';

export interface FoodTileProps {
  /** From content/food; never a literal in the screen. */
  name: string;
  /** The food's image. The kit holds no art, so the screen passes it. */
  image: ReactNode;
  /** Spoken extra, e.g. "Favourite". Only when content says so. */
  note?: string;
  focused: boolean;
  disabled?: boolean;
  /** Tap, trackpad activate, Enter. */
  onSelect: () => void;
  reducedMotion: boolean;
  testID?: string;
}

/**
 * One food in the M14 tray. It renders whatever the screen passes and holds
 * no food data: `content/food` does not exist yet and D-15e defers the tray.
 * Square tile, a 2 pt `structure` edge when focused (by the trackpad step or
 * keyboard), a press scale that reduced motion drops. Drag-to-feed is not
 * here: it needs `react-native-gesture-handler`, which the kit does not
 * depend on, and the tray it serves is deferred.
 */
export function FoodTile({ name, image, note, focused, disabled = false, onSelect, reducedMotion, testID }: FoodTileProps) {
  const spoken = note ? `${name}, ${note}` : name;
  return (
    <Pressable
      {...(testIdProps(testID) as object)}
      role="button"
      accessibilityLabel={spoken}
      aria-label={spoken}
      aria-disabled={disabled}
      accessibilityState={{ disabled, selected: focused }}
      onPress={disabled ? undefined : () => { haptics.tap(); onSelect(); }}
      className={`min-h-11 min-w-11 items-center gap-1 border-2 bg-surface-raised p-2 ${focused ? 'border-structure' : 'border-border'} ${disabled ? 'opacity-50' : ''} ${reducedMotion ? '' : 'transition-transform duration-fast active:scale-95'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus`}
    >
      <View {...(hiddenA11y(true) as object)} className="aspect-square w-16 items-center justify-center overflow-hidden">{image}</View>
      <Text {...(hiddenA11y(true) as object)} className="text-center text-type-caption text-text" numberOfLines={2}>{name}</Text>
    </Pressable>
  );
}
