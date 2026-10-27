'use client';

import type { ReactNode } from 'react';
import { Container } from '@acme/ui';
import { View } from '@acme/ui/tw';

/**
 * The auth and onboarding form layout, one tree for every window so a
 * rotation never remounts a field or drops a draft.
 *
 * - Phone (below md): exactly the old centred column, intro then form, capped
 *   at content-form.
 * - Tablet portrait (md+): the same reading order, top-aligned, the column
 *   widened to 560 so the form reads as a tablet form rather than a phone
 *   mockup. The form pane takes the remaining height (on phones too, where
 *   nothing inside uses it except M03's legal row), so a screen that puts its
 *   primary action in a `md:mt-auto` wrapper gets it on the bottom edge.
 * - Landscape (md+): two panes side by side like an open foldable, the intro
 *   (heading, copy, optional art) on the left, the form on the right.
 *
 * Each property carries at most a base value, a breakpoint value and ONE
 * orientation value, so no two compound variants compete for the same style.
 */
export function OnboardingPanes({
  intro,
  children,
  tightTop = false,
  testID,
}: {
  /** Heading, supporting copy and any landscape-only art. Read first. */
  intro: ReactNode;
  /** The form (the screen's `Form`). Give it `md:flex-1` to fill the pane. */
  children: ReactNode;
  /** M03 keeps its stack-header row close to the safe area (py-2, not py-6). */
  tightTop?: boolean;
  testID?: string;
}) {
  return (
    <Container
      width="full"
      testID={testID}
      className={`flex-1 px-4 md:px-8 md:py-10 md:landscape:flex-row md:landscape:gap-12 ${tightTop ? 'py-2' : 'py-6'}`}
    >
      <View className="mx-auto mb-6 w-full max-w-content-form md:max-w-[560px] md:landscape:mx-0 md:landscape:mb-0 md:landscape:w-auto md:landscape:flex-1">
        {intro}
      </View>
      <View className="mx-auto w-full max-w-content-form flex-1 md:max-w-[560px] md:landscape:mx-0 md:landscape:w-[44%] md:landscape:flex-none">
        {children}
      </View>
    </Container>
  );
}

/** Tablet heading: one rung above the kit's `title` step at md. */
export const PANE_HEADING_CLASS = 'md:text-display-md';
