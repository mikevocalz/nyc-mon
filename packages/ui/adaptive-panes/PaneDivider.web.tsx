'use client';
// PLATFORM FORK — web: keyboard-and-pointer-press resize only, NO drag.
// Arrow keys step the width, a press resets to the token width; a pointer drag
// on web is a later, measured addition.
// Mobbin: https://mobbin.com/screens/1764602c-b875-482f-a13f-059bf78c15b7 (Plain —
//   hairline divider between list column and detail region) ·
//   https://mobbin.com/screens/0b8a7848-7bbb-4b35-8999-d71b47f469c3 (Featurebase —
//   full-height column seams in a multi-pane inbox). Structure only.
// SOT: ./README.md
// SOT-KEYWORDS: pane divider web keyboard resize no gesture fork
import { View, Pressable } from '../tw';
import {
  PRIMARY_WIDTH_MAX,
  PRIMARY_WIDTH_MIN,
  RESIZE_KEYBOARD_STEP,
} from './resize';
import { useAdaptivePanesStore } from './context';
import type { PaneDividerProps } from './PaneDivider.types';

export type { PaneDividerProps };

export function PaneDivider({ width }: PaneDividerProps) {
  const setPrimaryWidth = useAdaptivePanesStore((state) => state.setPrimaryWidth);
  const resetPrimaryWidth = useAdaptivePanesStore((state) => state.resetPrimaryWidth);

  return (
    <View className="h-full w-1 bg-border">
      {/* A real <button>: focusable, role separator, arrow keys resize.
          Press restores the token width. */}
      <Pressable
        accessibilityLabel="Resize sidebar"
        role="separator"
        aria-valuenow={width}
        aria-valuemin={PRIMARY_WIDTH_MIN}
        aria-valuemax={PRIMARY_WIDTH_MAX}
        onPress={resetPrimaryWidth}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          const step = event.key === 'ArrowRight' ? RESIZE_KEYBOARD_STEP : -RESIZE_KEYBOARD_STEP;
          setPrimaryWidth(width + step);
        }}
        className="h-full w-4 -translate-x-1.5"
      />
    </View>
  );
}
