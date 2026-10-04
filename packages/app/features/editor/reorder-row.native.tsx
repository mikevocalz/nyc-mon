'use client';
import { useMemo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { View } from '@acme/ui/tw';
import { GripVertical } from '@acme/ui/icons';
import { haptics } from '@acme/ui/haptics';
import type { ReorderRowProps } from './reorder-row.types.ts';

/**
 * One draggable row.
 *
 * The DRAG HANDLE owns the gesture, not the row: the switch and the row itself
 * stay tappable, which they would not be if a pan covered the whole width.
 *
 * The reorder commits ONCE on release. Committing per frame would write to MMKV
 * on every pixel of travel and re-render the list under the finger.
 */
export function ReorderRow({
  children,
  label,
  index,
  count,
  rowHeight,
  onMove,
  scrollRef,
}: ReorderRowProps) {
  const offsetY = useSharedValue(0);
  const lifted = useSharedValue(false);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Long-press to activate, so a scroll over the handle still scrolls.
        .activateAfterLongPress(180)
        // Without this the ScrollView wins every vertical drag and the row
        // never moves: two handlers both want the gesture, and the scroll
        // ancestor is the one that claims it. Blocking hands the drag to this
        // handler for as long as it stays active.
        .blocksExternalGesture(scrollRef as never)
        .onStart(() => {
          lifted.set(true);
          scheduleOnRN(haptics.selection);
        })
        .onUpdate((event) => {
          offsetY.set(event.translationY);
        })
        .onEnd(() => {
          const steps = Math.round(offsetY.get() / rowHeight);
          const target = Math.min(Math.max(index + steps, 0), count - 1);

          lifted.set(false);
          // Snap home first; the list re-renders in the new order underneath.
          offsetY.set(withTiming(0, { duration: 140 }));
          if (target !== index) scheduleOnRN(onMove, index, target);
        }),
    [index, count, rowHeight, onMove, offsetY, lifted],
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offsetY.get() }],
    // Lifting the row above its neighbours is what makes the drag legible.
    zIndex: lifted.get() ? 10 : 0,
    opacity: lifted.get() ? 0.95 : 1,
  }));

  return (
    <Animated.View
      style={[style, { position: 'absolute', top: index * rowHeight, left: 0, right: 0 }]}
    >
      <View className="mb-2 h-12 flex-row items-center gap-3 rounded-none border-2 border-border bg-surface-raised px-3">
        <GestureDetector gesture={pan}>
          <View aria-label={`Reorder ${label}`} className="h-11 w-8 items-center justify-center">
            <GripVertical size={18} className="text-text-muted" />
          </View>
        </GestureDetector>

        {children}
      </View>
    </Animated.View>
  );
}
