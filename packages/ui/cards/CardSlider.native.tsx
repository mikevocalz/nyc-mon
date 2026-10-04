'use client';
import { useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { LegendList, type LegendListRef } from '@legendapp/list/react-native';
import { Section } from '../html';
import { View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import { useLayoutSize } from '../use-layout-size';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { indexAtOffset, sliderMetrics, stepIndex } from './card-slider-model';
import { SliderControls, sliderStatus, slidesOf, sliderTone, type CardSliderProps } from './CardSlider.shared';

/**
 * Native: a horizontal LegendList (the kit's list engine, as in
 * VirtualList.native) snapping every card width plus gap. The region is an
 * adjustable element, so VoiceOver and TalkBack swipe up and down to move
 * between cards and read "Card 2 of 6".
 */
export function CardSlider({
  children, label, visibleCount = 1, gap = 16, showButtons = true, showProgress = true,
  progressStyle = 'bar', loop = false, tone, district, className, itemClassName,
}: CardSliderProps) {
  const slides = slidesOf(children);
  const { size, onLayout } = useLayoutSize({ width: 0, height: 0 });
  const m = sliderMetrics(size.width, slides.length, visibleCount, gap);
  const store = useInstanceStore(() => ({ index: 0 }));
  const index = Math.min(useStore(store, (s) => s.index), m.maxIndex);
  const listRef = useRef<LegendListRef>(null);
  const reduced = useReducedMotion();
  const resolved = sliderTone(tone, district);
  const data = slides.map((slide, i) => ({ key: String(i), slide }));

  const go = (next: number) => {
    store.setState({ index: next });
    listRef.current?.scrollToOffset({ offset: next * m.stride, animated: !reduced });
  };
  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = indexAtOffset(e.nativeEvent.contentOffset.x, m.stride, m.maxIndex);
    if (next !== store.getState().index) store.setState({ index: next });
  };

  return (
    <Section
      aria-label={label}
      accessibilityRole="adjustable"
      accessibilityValue={{ text: sliderStatus(index, slides.length, m.visible) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e: { nativeEvent: { actionName: string } }) => {
        const delta = e.nativeEvent.actionName === 'increment' ? 1 : e.nativeEvent.actionName === 'decrement' ? -1 : 0;
        if (delta) go(stepIndex(index, delta, m.maxIndex, loop));
      }}
      className={className}
    >
      <View onLayout={onLayout} className="w-full">
        {size.width > 0 ? (
          <LegendList
            ref={listRef}
            horizontal
            data={data}
            keyExtractor={(item) => item.key}
            estimatedItemSize={m.stride}
            showsHorizontalScrollIndicator={false}
            snapToInterval={m.stride}
            decelerationRate="fast"
            disableIntervalMomentum
            onMomentumScrollEnd={onSettle}
            renderItem={({ item, index: i }: { item: { slide: React.ReactNode }; index: number }) => (
              <View
                className={`pb-2 pr-2 ${itemClassName ?? ''}`}
                // Computed: card width comes from the measured track.
                style={{ width: m.itemWidth, marginRight: i < data.length - 1 ? gap : 0 }}
              >
                {item.slide}
              </View>
            )}
          />
        ) : null}
      </View>
      <SliderControls
        index={index}
        count={slides.length}
        visible={m.visible}
        maxIndex={m.maxIndex}
        loop={loop}
        tone={resolved}
        showButtons={showButtons && m.maxIndex > 0}
        showProgress={showProgress && m.maxIndex > 0}
        progressStyle={progressStyle}
        onGo={go}
      />
    </Section>
  );
}
