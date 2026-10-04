'use client';
// PLATFORM FORK — web: the same bar, static. use-sticky-header's web fork
// never retracts, so this renders a plain View (no Reanimated in the Next
// bundle) with identical anatomy: absolute so it takes no layout space and
// the scroll view pads for it, exactly like the native fork.
// Mobbin: https://mobbin.com/screens/1764602c-b875-482f-a13f-059bf78c15b7 (Plain —
//   list pane title bar with trailing controls above the rows) ·
//   https://mobbin.com/screens/c8082986-1895-4bc5-9e2e-86401f4a415a (LangChain —
//   pane header with title, filter row beneath). Structure only.
// SOT: ./use-sticky-header.web.ts · ./README.md
// SOT-KEYWORDS: pane list header web static title bar fork
import { Text, View } from '../tw';
import type { PaneListHeaderProps } from './PaneListHeader.types';

export type { PaneListHeaderProps };

export function PaneListHeader({ title, subtitle, header, children }: PaneListHeaderProps) {
  return (
    <View
      onLayout={(event) => header.onHeaderLayout(event.nativeEvent.layout.height)}
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
    </View>
  );
}
