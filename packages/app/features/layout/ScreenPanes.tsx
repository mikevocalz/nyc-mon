'use client';

import type { ReactNode } from 'react';
import { Container, KeyboardAwareScroll, SafeArea } from '@acme/ui';
import { View } from '@acme/ui/tw';

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
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface" {...(testID === undefined ? {} : { testID })}>
      {leading}
      <KeyboardAwareScroll className="flex-1" contentContainerClassName="grow" showsVerticalScrollIndicator={false}>
        <Container
          width="detail"
          className="gap-6 py-4 pb-48 md:max-w-[560px] md:gap-10 md:px-8 md:py-10 md:pb-16 md:landscape:max-w-content-wide md:landscape:flex-row md:landscape:items-start md:landscape:gap-12 lg:gap-12"
        >
          <View className={`w-full gap-6 md:gap-10 lg:gap-12 ${primaryWidth}`}>{primary}</View>
          <View className="w-full gap-6 md:gap-10 lg:gap-12 md:landscape:flex-1">{secondary}</View>
        </Container>
      </KeyboardAwareScroll>
    </SafeArea>
  );
}
