'use client';

import type { ReactNode } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Container, KeyboardAwareScroll, SafeArea, useInstanceStore, useStore } from '@acme/ui';
import { useFoldLayouts } from '@acme/ui/adaptive-panes/parts';
import { View } from '@acme/ui/tw';
import { screenPanesFoldSplit, type ScreenPanesFoldSplit } from './screen-panes-fold';

/** The one host-view method the split needs (the row's layout event target). */
interface MeasurableRow {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
}

/** Tailwind's md (48rem): from here the page can go two-pane in landscape. */
const MD_PT = 768;
/** The row's md:px-8, both sides. */
const ROW_PAD_MD = 32;

/**
 * Hinge-safe landscape split (foldable skill §4). The page row is measured in
 * window coordinates, because native fold rectangles are window-relative and
 * the row sits beside a rail and under a header. Until the origin is known,
 * and on any window without a separating vertical fold, `plan` is null and
 * the class layout stands. Geometry lives in a per-instance store, never in
 * a key, so folding never remounts a pane.
 */
function useFoldSplit(): {
  onLayout: (event: LayoutChangeEvent) => void;
  plan: ScreenPanesFoldSplit | null;
} {
  const geo = useInstanceStore(() => ({ rowWidth: null as number | null, windowX: null as number | null }));
  const { rowWidth, windowX } = useStore(geo);
  const folds = useFoldLayouts(windowX);
  const { width, height } = useWindowDimensions();
  const twoPane = width >= MD_PT && width > height;
  const onLayout = (event: LayoutChangeEvent) => {
    const laid = event.nativeEvent.layout.width;
    // A fresh width with no origin yet: snapping stays off until measureInWindow answers.
    geo.setState({ rowWidth: laid, windowX: null });
    // The event's target is the row's host view (the kit Container takes no native ref).
    const row = event.currentTarget as unknown as MeasurableRow | null;
    row?.measureInWindow?.((x: number) => geo.setState({ windowX: x }));
  };
  const plan = twoPane ? screenPanesFoldSplit({ folds, rowWidth, padStart: ROW_PAD_MD, padEnd: ROW_PAD_MD }) : null;
  return { onLayout, plan };
}

/**
 * The native page layout for Alerts, Caller (Profile), Settings and Game
 * controls: OnboardingPanes' rules applied to a scrolling page. One tree for
 * every window, so a rotation never remounts a card, drops a draft (the
 * Caller name field) or builds a second controller preview.
 *
 * - Phone (below md): exactly the old column, `primary` then `secondary`,
 *   capped at content-detail.
 * - Tablet portrait (md+): the same reading order, top-aligned, the column
 *   widened to 560 like the onboarding forms, with more air between sections.
 * - Landscape (md+): two panes side by side, `primary` on the left and
 *   `secondary` on the right, capped at content-wide. The panes split the
 *   screen's content box, which on rail hardware is the space left of the
 *   rail and under the header, so the rail and header are never counted.
 *   `balance="narrow"` gives the primary pane two fifths; `"even"` halves it.
 *
 * Both panes scroll together in one keyboard-aware scroll view, as the
 * onboarding screens do: the scroll view owns keyboard avoidance for the one
 * text field these pages have.
 *
 * - A separating vertical hinge in landscape (open foldable, book posture):
 *   the panes meet at the hinge, with a 16pt gutter each side, so nothing
 *   straddles it (`screen-panes-fold.ts`). A flat crease changes nothing.
 *
 * Each property carries at most a base value, a breakpoint value and ONE
 * orientation value, so no two compound variants compete for the same style.
 */
export function ScreenPanes({
  primary,
  secondary,
  balance = 'narrow',
  leading,
  testID,
}: {
  /** Read first: the title block, a summary, an identity or a preview. */
  primary: ReactNode;
  /** The list, details or cards. Below `primary` in a column, beside it in landscape. */
  secondary: ReactNode;
  balance?: 'narrow' | 'even';
  /** Above the scroll view, outside both panes (the Settings glass's Back row). */
  leading?: ReactNode;
  testID?: string;
}) {
  const primaryWidth = balance === 'even' ? 'md:landscape:flex-1' : 'md:landscape:w-2/5';
  const split = useFoldSplit();
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface" {...(testID === undefined ? {} : { testID })}>
      {leading}
      <KeyboardAwareScroll className="flex-1" contentContainerClassName="grow" showsVerticalScrollIndicator={false}>
        <Container
          onLayout={split.onLayout}
          width="detail"
          className="gap-6 py-4 pb-48 md:max-w-[560px] md:gap-10 md:px-8 md:py-10 md:pb-16 md:landscape:max-w-content-wide md:landscape:flex-row md:landscape:items-start md:landscape:gap-12 lg:gap-12"
          style={split.plan === null ? undefined : { columnGap: split.plan.gap }}
        >
          <View
            className={`w-full gap-6 md:gap-10 lg:gap-12 ${primaryWidth}`}
            style={split.plan === null ? undefined : { width: split.plan.primaryWidth, flexGrow: 0, flexShrink: 0 }}
          >
            {primary}
          </View>
          <View className="w-full gap-6 md:gap-10 lg:gap-12 md:landscape:flex-1">{secondary}</View>
        </Container>
      </KeyboardAwareScroll>
    </SafeArea>
  );
}
