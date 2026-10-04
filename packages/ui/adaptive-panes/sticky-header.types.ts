// Shared shape for the useStickyHeader platform forks.
// SOT: ./use-sticky-header.native.ts (Reanimated) · ./use-sticky-header.web.ts (static)
// SOT-KEYWORDS: sticky header types scroll handler style layout
import type { StyleProp, ViewStyle } from 'react-native';
// TYPE-ONLY, deliberately: erased at compile time, so Reanimated never enters
// the web bundle — only its type for the handler the native fork returns.
import type { useAnimatedScrollHandler } from 'react-native-reanimated';

/**
 * What a pane header consumes. On web both animated members are undefined and
 * the header simply stays put — `PaneListHeader` only reads `headerStyle` +
 * `onHeaderLayout`, so both forks satisfy it.
 */
export interface StickyHeader {
  /** Attach to the scroll view's `onScroll` (needs `scrollEventThrottle={16}`). Undefined on web. */
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler> | undefined;
  /** Attach to the header's animated view. Undefined on web (static header). */
  headerStyle: StyleProp<ViewStyle> | undefined;
  /** Call from the header's `onLayout` once its height is known. */
  onHeaderLayout: (height: number) => void;
}
