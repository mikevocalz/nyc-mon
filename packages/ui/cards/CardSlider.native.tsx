'use client';
import { useEffect } from 'react';
import { Pause, Play } from '../icons';
import { IconButton } from '../IconButton';
import { Section } from '../html';
import { View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import { useLayoutSize } from '../use-layout-size';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { NycCarousel, isNycCarouselAvailable } from '../modules/nyc-carousel/src';
import { stepIndex } from './card-slider-model';
import { autoplayStep, nativeSliderLayout, slideLabels } from './card-slider-native-model';
import type { CardSliderNativeProps } from './card-slider-native.types';
import { CardSliderListTrack } from './CardSliderListTrack';
import { SliderControls, sliderStatus, slidesOf, sliderTone } from './CardSlider.shared';
import { CardSliderEdgeFades } from './CardSliderEdgeFades';
import { CardSliderSideButtons } from './CardSliderSideButtons';
import { TONE_CLASSES, toneHex } from './tones';

export type { CardSliderNativeProps } from './card-slider-native.types';

/** Cut length of each card's corner, the kit CornerCutFrame default. */
const CARD_CUT = 16;

/**
 * Native: the track is a native carousel.
 * - iOS: a SwiftUI paging ScrollView (modules/nyc-carousel/ios).
 * - Android: Material 3's centred-hero, multi-browse and uncontained
 *   carousels (modules/nyc-carousel/android).
 * Each card is the React Native slide, hosted natively and masked to the
 * corner-cut shape with a keyline in the tone. Binaries without the module
 * (Expo Go, older builds, iOS below 17) get the React Native LegendList track
 * instead, with the same controls.
 *
 * The index lives in a zustand instance store. Buttons, autoplay and
 * assistive-tech increments set it and the carousel scrolls to match;
 * swipes report back through onIndexChange. The region is adjustable, so
 * VoiceOver and TalkBack swipe up and down between cards and read
 * "Card 2 of 6".
 */
export function CardSlider({
  children, label, visibleCount = 1, gap = 16, showButtons = true, showProgress = true,
  progressStyle = 'bar', loop = false, tone, district, className, itemClassName,
  variant = 'uncontained', snap = true, onIndexChange, autoPlay = false, autoPlayInterval = 3000,
  showEdgeFades = false, edgeFadeColor, buttonPosition = 'bottom',
}: CardSliderNativeProps) {
  const slides = slidesOf(children);
  const { size, onLayout } = useLayoutSize({ width: 0, height: 0 });
  // The list fallback only has the uncontained layout.
  const layout = nativeSliderLayout(isNycCarouselAvailable ? variant : 'uncontained', size.width, slides.length, visibleCount, gap);
  // userPlaying: null until the user presses pause/play; before that,
  // autoplay runs unless reduced motion is on.
  const store = useInstanceStore(() => ({ index: 0, userPlaying: null as boolean | null }));
  const index = Math.min(useStore(store, (s) => s.index), layout.maxIndex);
  const userPlaying = useStore(store, (s) => s.userPlaying);
  const reduced = useReducedMotion();
  const playing = autoPlay && (userPlaying ?? !reduced);
  const resolved = sliderTone(tone, district);
  const hex = toneHex(resolved);
  const canMove = layout.maxIndex > 0;

  const go = (next: number) => {
    if (next === store.getState().index) return;
    store.setState({ index: next });
    onIndexChange?.(next);
  };

  // One timer per stop: it re-arms whenever the index moves, so a swipe or a
  // button press restarts the wait instead of stepping straight after it.
  useEffect(() => {
    if (!playing || !canMove) return;
    const id = setTimeout(() => {
      const next = autoplayStep(store.getState().index, layout.maxIndex, loop);
      if (next !== null) go(next);
    }, Math.max(800, autoPlayInterval));
    return () => clearTimeout(id);
    // go reads the latest state through the store; its identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, canMove, index, layout.maxIndex, loop, autoPlayInterval]);

  const nativeSlides = slides.map((slide, i) => (
    <View key={i} className={itemClassName}>{slide}</View>
  ));

  return (
    <Section
      aria-label={label}
      accessibilityRole="adjustable"
      accessibilityValue={{ text: sliderStatus(index, slides.length, layout.visible) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e: { nativeEvent: { actionName: string } }) => {
        const delta = e.nativeEvent.actionName === 'increment' ? 1 : e.nativeEvent.actionName === 'decrement' ? -1 : 0;
        if (delta) go(stepIndex(index, delta, layout.maxIndex, loop));
      }}
      className={className}
    >
      <View onLayout={onLayout} className="relative w-full">
        {size.width > 0 ? (
          isNycCarouselAvailable ? (
            <NycCarousel
              slides={nativeSlides}
              variant={variant}
              index={index}
              onIndexChange={(i) => go(Math.min(i, layout.maxIndex))}
              animated={!reduced}
              visibleCount={layout.visible}
              itemWidth={layout.itemWidth}
              itemSpacing={gap}
              snap={snap}
              cut={CARD_CUT}
              keylineColor={hex.face}
              itemLabels={slideLabels(slides.length)}
            />
          ) : (
            <CardSliderListTrack
              slides={slides}
              layout={layout}
              gap={gap}
              index={index}
              animated={!reduced}
              tone={resolved}
              itemClassName={itemClassName}
              onSettle={go}
            />
          )
        ) : null}
        {showEdgeFades ? <CardSliderEdgeFades color={edgeFadeColor} /> : null}
        {showButtons && buttonPosition === 'sides' && canMove ? (
          <CardSliderSideButtons index={index} maxIndex={layout.maxIndex} loop={loop} tone={resolved} onGo={go} />
        ) : null}
      </View>
      <View className="flex-row items-end gap-3">
        {autoPlay && canMove ? (
          <IconButton
            variant="cornerCut"
            tone={resolved}
            size="sm"
            corner="top-right"
            className="mt-4"
            aria-label={playing ? 'Pause autoplay' : 'Start autoplay'}
            onPress={() => store.setState({ userPlaying: !playing })}
            icon={playing
              ? <Pause size={16} className={TONE_CLASSES[resolved].onFace} />
              : <Play size={16} className={TONE_CLASSES[resolved].onFace} />}
          />
        ) : null}
        <View className="flex-1">
          <SliderControls
            index={index}
            count={slides.length}
            visible={layout.visible}
            maxIndex={layout.maxIndex}
            loop={loop}
            tone={resolved}
            showButtons={showButtons && buttonPosition === 'bottom' && canMove}
            showProgress={showProgress && canMove}
            progressStyle={progressStyle}
            onGo={go}
          />
        </View>
      </View>
    </Section>
  );
}
