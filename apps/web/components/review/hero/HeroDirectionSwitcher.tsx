'use client';
/**
 * The review page's direction picker. The server renders each direction and
 * passes it in as an element; only the picked one is mounted, so the page's
 * DOM never holds more than one hero headline. `?direction=a|b|c` deep-links
 * a direction (read after mount, written back with replaceState), so a
 * reviewer can share a link to one frame.
 */
import { useEffect, type ReactNode } from 'react';
import { SegmentedControl, useInstanceStore, useStore } from '@acme/ui';
import { Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { DIRECTIONS, REVIEW_COPY, directionFromSearch, type DirectionId } from './copy';

const LABEL_ID = 'review-direction-label';
const OPTIONS = DIRECTIONS.map((d) => ({ value: d.id, label: d.label }));

export function HeroDirectionSwitcher({ directions }: { directions: Record<DirectionId, ReactNode> }) {
  const store = useInstanceStore(() => ({ direction: 'a' as DirectionId }));
  const direction = useStore(store, (s) => s.direction);

  useEffect(() => {
    store.setState({ direction: directionFromSearch(window.location.search) });
  }, [store]);

  const pick = (next: DirectionId) => {
    store.setState({ direction: next });
    const url = new URL(window.location.href);
    url.searchParams.set('direction', next);
    window.history.replaceState(null, '', url);
  };

  const meta = DIRECTIONS.find((d) => d.id === direction) ?? DIRECTIONS[0]!;

  return (
    <>
      <View className="mx-auto w-full max-w-screen-xl gap-2 px-4 pb-4 sm:px-6 lg:px-8">
        <Text {...({ id: LABEL_ID } as object)} className="text-sm font-semibold text-text">
          {REVIEW_COPY.pickerLabel}
        </Text>
        <SegmentedControl
          options={OPTIONS}
          value={direction}
          onChange={pick}
          tone="royal"
          className="w-full sm:w-auto"
          segmentClassName="basis-full sm:basis-auto"
          aria-labelledby={LABEL_ID}
        />
      </View>
      <Section aria-label={meta.frameLabel} data-testid="review-frame" data-direction={meta.id} className="w-full">
        <View className="mx-auto w-full max-w-screen-xl flex-row flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:px-6 lg:px-8">
          <Text className="font-display text-sm uppercase text-text">{meta.label}</Text>
          <Text
            className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
              meta.status === 'approved' ? 'bg-leaf-700 text-signage-white' : 'bg-signage-black text-signage-white'
            }`}
          >
            {REVIEW_COPY.statusLabel[meta.status]}
          </Text>
        </View>
        <View id="review-hero-frame" className="w-full border-t-2 border-ink-950">
          {directions[meta.id]}
        </View>
      </Section>
    </>
  );
}
