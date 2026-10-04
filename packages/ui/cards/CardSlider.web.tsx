'use client';
import { useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Section } from '../html';
import { ScrollView, View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import { useLayoutSize } from '../use-layout-size';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { indexAtOffset, indexForKey, sliderMetrics } from './card-slider-model';
import { SliderControls, slidesOf, sliderTone, type CardSliderProps } from './CardSlider.shared';

// The one ScrollView method used here. Structural, because the ScrollView
// instance type is named differently across the react-native type versions
// in this repo.
type ScrollHandle = { scrollTo: (options: { x: number; animated?: boolean }) => void };

/**
 * Web: the kit ScrollView, horizontal, with CSS scroll snap (each slide
 * snaps its start edge). Swipe, trackpad and wheel scrolling come from the
 * browser; the buttons and arrow keys scroll to the next snap stop. The
 * region is focusable and announces itself as a carousel.
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
  const scrollRef = useRef<ScrollHandle>(null);
  const reduced = useReducedMotion();
  const resolved = sliderTone(tone, district);

  const go = (next: number) => {
    store.setState({ index: next });
    scrollRef.current?.scrollTo({ x: next * m.stride, animated: !reduced });
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = indexAtOffset(e.nativeEvent.contentOffset.x, m.stride, m.maxIndex);
    if (next !== store.getState().index) store.setState({ index: next });
  };
  const onKeyDown = (e: { key: string; preventDefault: () => void }) => {
    const next = indexForKey(e.key, index, m.maxIndex, loop);
    if (next === null) return;
    e.preventDefault();
    go(next);
  };

  // Web-only DOM props on the semantic region; RN's types don't list them.
  const regionProps = { tabIndex: 0, onKeyDown, 'aria-roledescription': 'carousel' } as object;

  return (
    <Section
      aria-label={label}
      className={`rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 ${className ?? ''}`}
      {...regionProps}
    >
      <View onLayout={onLayout} className="w-full">
        <ScrollView
          {...({ ref: scrollRef } as object)}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={50}
          // Computed: CSS scroll snap has no class in the RN style layer; web-only property.
          style={{ scrollSnapType: 'x mandatory' } as object}
        >
          {slides.map((slide, i) => (
            <View
              key={i}
              role="group"
              aria-label={`${i + 1} of ${slides.length}`}
              {...({ 'aria-roledescription': 'slide' } as object)}
              className={`pb-2 pr-2 ${itemClassName ?? ''}`}
              // Computed: card width comes from the measured track; snap alignment is web-only CSS.
              style={{ width: m.itemWidth, marginRight: i < slides.length - 1 ? gap : 0, scrollSnapAlign: 'start', flexShrink: 0 } as object}
            >
              {slide}
            </View>
          ))}
        </ScrollView>
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
