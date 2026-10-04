'use client';
import { Section } from '../html';
import { View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import { useLayoutSize } from '../use-layout-size';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { NycCarousel, isNycCarouselAvailable } from '../modules/nyc-carousel/src';
import { stepIndex } from './card-slider-model';
import { nativeSliderLayout, slideLabels } from './card-slider-native-model';
import type { CardSliderNativeProps } from './card-slider-native.types';
import { CardSliderListTrack } from './CardSliderListTrack';
import {
  CornerAccents, EdgeFades, ScanLines, SideButtons, SliderControls, sliderStatus, slidesOf, sliderTone, useAutoplay,
} from './CardSlider.shared';
import { toneHex } from './tones';

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
 * Everything around the track is the web fork's: SliderControls with the
 * autoplay slot, SideButtons in gutters, EdgeFades, CornerAccents, ScanLines
 * and useAutoplay. Touch has no hover, so `buttonVisibility` is always on
 * and autoplay holds only when paused.
 *
 * The index lives in a zustand instance store. Buttons, autoplay and
 * assistive-tech increments set it and the carousel scrolls to match;
 * swipes report back through the carousel's onIndexChange. The region is
 * adjustable, so VoiceOver and TalkBack swipe up and down between cards and
 * read "Card 2 of 6".
 */
export function CardSlider({
  children, label, visibleCount = 1, gap = 16, showButtons = true, showProgress = true,
  progressStyle = 'bar', loop = false, tone, district, className, itemClassName,
  buttonPosition = 'sides', prevButtonCorner = 'bottom-left', nextButtonCorner = 'bottom-right',
  autoPlay = false, autoPlayInterval = 3000, showEdgeFades = false, edgeFadeColor,
  showCornerAccents = false, cornerAccentStyle = 'frame', scanLines = false, viewportClassName,
  variant = 'uncontained', snap = true, parallax = false, onIndexChange,
}: CardSliderNativeProps) {
  const slides = slidesOf(children);
  const { size, onLayout } = useLayoutSize({ width: 0, height: 0 });
  // The list fallback only has the uncontained layout.
  const layout = nativeSliderLayout(isNycCarouselAvailable ? variant : 'uncontained', size.width, slides.length, visibleCount, gap);
  const reduced = useReducedMotion();
  // playing: autoplay not paused by the user. Starts paused under reduced motion.
  const store = useInstanceStore(() => ({ index: 0, playing: !reduced }));
  const index = Math.min(useStore(store, (s) => s.index), layout.maxIndex);
  const playing = useStore(store, (s) => s.playing);
  const resolved = sliderTone(tone, district);
  const paged = layout.maxIndex > 0;
  const sides = showButtons && paged && buttonPosition === 'sides';

  const go = (next: number) => {
    if (next === store.getState().index) return;
    store.setState({ index: next });
    onIndexChange?.(next);
  };

  useAutoplay({
    autoPlay,
    interval: autoPlayInterval,
    enabled: playing,
    held: false,
    getIndex: () => store.getState().index,
    maxIndex: layout.maxIndex,
    loop,
    step: go,
  });

  // Plus accents overhang the card by 8px; pad so the native mask keeps them.
  const slideClass = `relative ${showCornerAccents && cornerAccentStyle === 'plus' ? 'p-2' : ''} ${itemClassName ?? ''}`;
  const nativeSlides = slides.map((slide, i) => (
    <View key={i} className={slideClass}>
      {slide}
      {showCornerAccents ? <CornerAccents tone={resolved} style={cornerAccentStyle} /> : null}
    </View>
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
      {/* Side buttons sit in gutters beside the track, as on web. */}
      <View className={`relative w-full ${sides ? 'px-14' : ''}`}>
        <View onLayout={onLayout} className={`relative w-full ${viewportClassName ?? ''}`}>
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
                parallax={parallax}
                cut={CARD_CUT}
                keylineColor={toneHex(resolved).face}
                itemLabels={slideLabels(slides.length)}
              />
            ) : (
              <CardSliderListTrack
                slides={nativeSlides}
                layout={layout}
                gap={gap}
                index={index}
                animated={!reduced}
                tone={resolved}
                onSettle={go}
              />
            )
          ) : null}
          {scanLines ? <ScanLines height={size.height} /> : null}
          {showEdgeFades ? <EdgeFades color={edgeFadeColor} /> : null}
        </View>
        {sides ? (
          <SideButtons
            index={index}
            maxIndex={layout.maxIndex}
            loop={loop}
            tone={resolved}
            prevCorner={prevButtonCorner}
            nextCorner={nextButtonCorner}
            onGo={go}
          />
        ) : null}
      </View>
      <SliderControls
        index={index}
        count={slides.length}
        visible={layout.visible}
        maxIndex={layout.maxIndex}
        loop={loop}
        tone={resolved}
        showButtons={showButtons && paged}
        showProgress={showProgress && paged}
        progressStyle={progressStyle}
        onGo={go}
        buttonPosition={buttonPosition}
        prevCorner={prevButtonCorner}
        nextCorner={nextButtonCorner}
        autoplay={autoPlay && paged ? { playing, onToggle: () => store.setState({ playing: !store.getState().playing }) } : undefined}
      />
    </Section>
  );
}
