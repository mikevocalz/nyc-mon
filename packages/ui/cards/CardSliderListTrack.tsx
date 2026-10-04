'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { LegendList, type LegendListRef } from '@legendapp/list/react-native';
import { CornerCutFrame } from '../neon';
import { View } from '../tw';
import { indexAtOffset } from './card-slider-model';
import type { NativeSliderLayout } from './card-slider-native-model';
import { toneInput, type ControlTone } from './tones';

interface ListTrackProps {
  slides: ReactNode[];
  layout: NativeSliderLayout;
  gap: number;
  index: number;
  animated: boolean;
  tone: ControlTone;
  onSettle: (index: number) => void;
}

/**
 * Fallback track when the native carousel module isn't in the binary (Expo
 * Go, builds older than the module, iOS below 17): a horizontal LegendList
 * snapping every card width plus gap. Each card sits in an outline
 * CornerCutFrame in the slider tone, the same cut and keyline the native
 * carousels mask their cards with.
 */
export function CardSliderListTrack({ slides, layout, gap, index, animated, tone, onSettle }: ListTrackProps) {
  const listRef = useRef<LegendListRef>(null);
  const settled = useRef(index);
  const data = slides.map((slide, i) => ({ key: String(i), slide }));

  // Scroll when the index moves for any reason other than the user's own swipe.
  useEffect(() => {
    if (settled.current === index) return;
    settled.current = index;
    listRef.current?.scrollToOffset({ offset: index * layout.stride, animated });
  }, [index, layout.stride, animated]);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = indexAtOffset(e.nativeEvent.contentOffset.x, layout.stride, layout.maxIndex);
    settled.current = next;
    onSettle(next);
  };

  return (
    <LegendList
      ref={listRef}
      horizontal
      data={data}
      keyExtractor={(item) => item.key}
      estimatedItemSize={layout.stride}
      showsHorizontalScrollIndicator={false}
      snapToInterval={layout.stride}
      decelerationRate="fast"
      disableIntervalMomentum
      onMomentumScrollEnd={onMomentumScrollEnd}
      renderItem={({ item, index: i }: { item: { slide: ReactNode }; index: number }) => (
        <View
          className="pb-2"
          // Computed: card width comes from the measured track.
          style={{ width: layout.itemWidth, marginRight: i < data.length - 1 ? gap : 0 }}
        >
          <CornerCutFrame variant="outline" tone={toneInput(tone)} depth={0}>
            {item.slide}
          </CornerCutFrame>
        </View>
      )}
    />
  );
}
