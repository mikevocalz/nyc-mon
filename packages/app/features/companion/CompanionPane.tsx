'use client';

import type { ReactNode } from 'react';
import { EmptyState, Heading, LoadingSkeleton } from '@acme/ui';
import { ScrollView, View } from '@acme/ui/tw';
import { companionCopy } from './copy';

export interface CompanionPaneProps {
  /** The pane's heading; also its region name for screen readers. */
  readonly title: string;
  readonly testID: string;
  /** The route's data is not ready yet (no Mon loaded, a store still hydrating). */
  readonly loading?: boolean;
  /** Shown instead of `children` when there is nothing to list yet. */
  readonly empty?: { readonly title: string; readonly description?: string } | null;
  readonly children?: ReactNode;
}

/**
 * The companion pane's chrome on tablet-class windows: a heading, then the
 * route's secondary content in its own scroll, or its loading or empty state.
 * It is real UI, not a duplicate of the glass, so screen readers reach it
 * directly; the glass keeps its hidden mirror for what it draws.
 */
export function CompanionPane({ title, testID, loading = false, empty = null, children }: CompanionPaneProps) {
  return (
    <ScrollView
      testID={testID}
      accessibilityLabel={title}
      className="flex-1"
      contentContainerClassName="gap-4 p-4 md:p-6"
      keyboardShouldPersistTaps="handled"
    >
      <Heading level={2} className="text-xr-title">{title}</Heading>
      {loading ? (
        <View testID={`${testID}-loading`} accessibilityLabel={companionCopy('pane.loading.a11y')} accessible>
          <LoadingSkeleton count={4} className="h-12 w-full" />
        </View>
      ) : empty !== null ? (
        <View testID={`${testID}-empty`}>
          <EmptyState title={empty.title} description={empty.description} />
        </View>
      ) : (
        children
      )}
    </ScrollView>
  );
}

/** Between routes (the next one has not published its pane yet): the loading state, untitled. */
export function CompanionPaneLoading() {
  return (
    <View testID="companion-pane-loading" className="flex-1 gap-4 p-4 md:p-6" accessible accessibilityLabel={companionCopy('pane.loading.a11y')}>
      <LoadingSkeleton count={5} className="h-12 w-full" />
    </View>
  );
}
