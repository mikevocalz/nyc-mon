'use client';
// PLATFORM FORK — native: the retracting bar rides use-sticky-header's
// Reanimated style. Web's fork is a static bar — see PaneListHeader.web.tsx.
// Mobbin: https://mobbin.com/screens/1764602c-b875-482f-a13f-059bf78c15b7 (Plain —
//   list pane title bar with trailing controls above the rows) ·
//   https://mobbin.com/screens/c8082986-1895-4bc5-9e2e-86401f4a415a (LangChain —
//   pane header with title, filter row beneath). Structure only.
// SOT: ./use-sticky-header.native.ts · ./README.md
// SOT-KEYWORDS: pane list header native reanimated retract title bar fork
import Animated from 'react-native-reanimated';
import { Text, View } from '../tw';
import { css } from '../html/css';
import type { PaneListHeaderProps } from './PaneListHeader.types';

export type { PaneListHeaderProps };

// The kit's one styling boundary: css() is what lets a raw Reanimated view
// carry className (the same wrap KeyboardAwareScroll uses) — packages/ui has
// no global uniwind type augmentation to lean on.
const AnimatedHeader = css(Animated.View, 'PaneListHeaderSurface');

/**
 * The list pane's auto-hiding title bar.
 *
 * Absolutely positioned so retracting it does not reflow the list underneath —
 * a header that takes layout space would make every row jump as it hides. The
 * scroll view compensates with top padding equal to this height.
 *
 * `Animated.View` here, not the kit's MotionView: the style comes from a
 * Reanimated shared value driven by the scroll handler on the UI thread.
 */
export function PaneListHeader({ title, subtitle, header, children }: PaneListHeaderProps) {
  return (
    <AnimatedHeader
      onLayout={(event) => header.onHeaderLayout(event.nativeEvent.layout.height)}
      style={header.headerStyle}
      className="absolute left-0 right-0 top-0 z-10 flex-row items-center gap-2 border-b-2 border-border bg-surface px-4 py-3"
    >
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base font-semibold text-text md:text-lg">
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} className="text-xs text-text-muted md:text-sm">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </AnimatedHeader>
  );
}
