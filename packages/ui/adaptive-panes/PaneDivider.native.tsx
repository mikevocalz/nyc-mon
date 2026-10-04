'use client';
// PLATFORM FORK — native: the drag plus the keyboard affordance. The web fork
// keeps only the keyboard path.
//
// PanResponder, not react-native-gesture-handler: @acme/ui does not declare
// Gesture Handler, and the resize is a low-frequency drag that writes to a
// Zustand store on the JS thread anyway. PanResponder is part of react-native,
// so the kit carries no extra native dependency for one divider.
// SOT: ./README.md
// SOT-KEYWORDS: pane divider drag resize panresponder native fork
import { useEffect, useMemo } from 'react';
import { PanResponder } from 'react-native';
import { View, Pressable } from '../tw';
import { useInstanceStore } from '../use-instance-store';
import {
  PRIMARY_WIDTH_MAX,
  PRIMARY_WIDTH_MIN,
  RESIZE_KEYBOARD_STEP,
  widthAfterDrag,
} from './resize';
import { useAdaptivePanesStore } from './context';
import type { PaneDividerProps } from './PaneDivider.types';

export type { PaneDividerProps };

/**
 * Drag-to-resize affordance between the leading pane and its neighbour.
 *
 * GESTURE ARBITRATION. Nothing competes for this pointer: the split view has
 * no other horizontal recognizer (collapse comes from the size class, column
 * stepping from Back), and the responder is confined to the divider's own hit
 * area, which is disjoint from the detail pane where a detail surface's
 * horizontal scroll lives. Keep it that way: if the divider ever grows its hit
 * slop into the detail pane, the two genuinely compete and the arbitration has
 * to be written down here.
 *
 * Resolved from the width the drag STARTED at plus the total translation.
 * Accumulating per-frame deltas drifts once the pointer crosses a clamp
 * boundary and returns (see `widthAfterDrag`).
 */
export function PaneDivider({ width }: PaneDividerProps) {
  const setPrimaryWidth = useAdaptivePanesStore((state) => state.setPrimaryWidth);
  const resetPrimaryWidth = useAdaptivePanesStore((state) => state.resetPrimaryWidth);

  // The responder lives as long as the store action it writes through (which
  // is stable), so a drag in progress is never handed to a new responder. The
  // live width and the drag origin sit in an instance store the handlers read
  // at event time; the width is copied in after each commit.
  const drag = useInstanceStore(() => ({ width, origin: width }));
  useEffect(() => {
    drag.setState({ width });
  }, [width, drag]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 2,
        onPanResponderGrant: () => {
          drag.setState({ origin: drag.getState().width });
        },
        onPanResponderMove: (_event, gesture) => {
          setPrimaryWidth(widthAfterDrag(drag.getState().origin, gesture.dx));
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [drag, setPrimaryWidth],
  );

  return (
    <View className="h-full w-1 bg-border" {...responder.panHandlers}>
      {/* Keyboard affordance. Press restores the token width. */}
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
