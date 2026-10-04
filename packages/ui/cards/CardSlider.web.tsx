'use client';
import { useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Section } from '../html';
import { ScrollView, View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import { useLayoutSize } from '../use-layout-size';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { dragTarget, indexAtOffset, indexForKey, sliderMetrics } from './card-slider-model';
import {
  CornerAccents, EdgeFades, ScanLines, SideButtons, SliderControls, slidesOf, sliderTone, useAutoplay,
  type CardSliderProps,
} from './CardSlider.shared';

// The ScrollView methods used here. Structural, because the ScrollView
// instance type is named differently across the react-native type versions
// in this repo. getScrollableNode is react-native-web's DOM accessor.
type ScrollHandle = {
  scrollTo: (options: { x: number; animated?: boolean }) => void;
  getScrollableNode?: () => HTMLElement | null;
};

interface SliderState {
  index: number;
  /** Autoplay not paused by the user. */
  playing: boolean;
  hovered: boolean;
  /** Keyboard focus is inside the slider. */
  focused: boolean;
  /** Mouse drag in progress: start x, start scroll offset, start index. */
  drag: { x: number; scroll: number; index: number } | null;
}

/**
 * Web: the kit ScrollView, horizontal, with CSS scroll snap (each slide
 * snaps its start edge). Swipe, trackpad and wheel come from the browser;
 * a mouse drag pages it like NeonBlade's (enableSwipe); the buttons and
 * arrow keys scroll to the next stop. Autoplay holds while the slider is
 * hovered or focused and has its own pause control.
 */
export function CardSlider({
  children, label, visibleCount = 1, gap = 16, showButtons = true, showProgress = true,
  progressStyle = 'bar', loop = false, tone, district, className, itemClassName,
  buttonPosition = 'sides', buttonVisibility = 'always', prevButtonCorner = 'bottom-left', nextButtonCorner = 'bottom-right',
  enableSwipe = true, swipeThreshold = 50, autoPlay = false, autoPlayInterval = 3000,
  showEdgeFades = false, edgeFadeColor, showCornerAccents = false, cornerAccentStyle = 'frame', scanLines = false,
  viewportClassName,
}: CardSliderProps) {
  const slides = slidesOf(children);
  const { size, onLayout } = useLayoutSize({ width: 0, height: 0 });
  const m = sliderMetrics(size.width, slides.length, visibleCount, gap);
  const reduced = useReducedMotion();
  const store = useInstanceStore<SliderState>(() => ({
    index: 0, playing: !reduced, hovered: false, focused: false, drag: null,
  }));
  const state = useStore(store);
  const index = Math.min(state.index, m.maxIndex);
  const scrollRef = useRef<ScrollHandle>(null);
  const resolved = sliderTone(tone, district);

  const go = (next: number) => {
    store.setState({ index: next });
    scrollRef.current?.scrollTo({ x: next * m.stride, animated: !reduced });
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (store.getState().drag) return;
    const next = indexAtOffset(e.nativeEvent.contentOffset.x, m.stride, m.maxIndex);
    if (next !== store.getState().index) store.setState({ index: next });
  };
  const onKeyDown = (e: { key: string; preventDefault: () => void }) => {
    const next = indexForKey(e.key, index, m.maxIndex, loop);
    if (next === null) return;
    e.preventDefault();
    go(next);
  };

  useAutoplay({
    autoPlay,
    interval: autoPlayInterval,
    enabled: state.playing,
    held: state.hovered || state.focused || state.drag !== null,
    getIndex: () => store.getState().index,
    maxIndex: m.maxIndex,
    loop,
    step: go,
  });

  // Mouse drag paging. Touch and pen keep the browser's own scrolling.
  const node = () => scrollRef.current?.getScrollableNode?.() ?? null;
  const dragProps = enableSwipe
    ? {
        // Photos in slides are <img>s; the browser's own image drag would steal the mouse drag.
        onDragStart: (e: { preventDefault: () => void }) => e.preventDefault(),
        onPointerDown: (e: { pointerType: string; clientX: number; button: number }) => {
          if (e.pointerType !== 'mouse' || e.button !== 0) return;
          const el = node();
          store.setState({ drag: { x: e.clientX, scroll: el?.scrollLeft ?? 0, index } });
        },
        onPointerMove: (e: { clientX: number }) => {
          const d = store.getState().drag;
          const el = node();
          if (!d || !el) return;
          el.scrollLeft = d.scroll - (e.clientX - d.x);
        },
        onPointerUp: (e: { clientX: number }) => {
          const d = store.getState().drag;
          if (!d) return;
          store.setState({ drag: null });
          go(dragTarget(d.index, e.clientX - d.x, m.stride, swipeThreshold, m.maxIndex));
        },
        onPointerLeave: (e: { clientX: number }) => {
          const d = store.getState().drag;
          if (!d) return;
          store.setState({ drag: null });
          go(dragTarget(d.index, e.clientX - d.x, m.stride, swipeThreshold, m.maxIndex));
        },
      }
    : {};

  // Web-only DOM props on the semantic region; RN's types don't list them.
  const regionProps = {
    tabIndex: 0,
    onKeyDown,
    'aria-roledescription': 'carousel',
    onPointerEnter: () => store.setState({ hovered: true }),
    onPointerLeave: () => store.setState({ hovered: false }),
    onFocus: () => store.setState({ focused: true }),
    onBlur: (e: { currentTarget: HTMLElement; relatedTarget: Element | null }) => {
      if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) store.setState({ focused: false });
    },
  } as object;

  const paged = m.maxIndex > 0;
  const buttonsShown = buttonVisibility === 'always' || state.hovered || state.focused;
  // Hover mode fades the buttons; focus inside the slider shows them too.
  const fade = `transition-opacity duration-300 motion-reduce:transition-none ${buttonsShown ? 'opacity-100' : 'pointer-events-none opacity-0'}`;
  const dragging = state.drag !== null;
  // Side buttons sit in gutters beside the track, so they never cover card text.
  const sides = showButtons && paged && buttonPosition === 'sides';

  return (
    <Section
      aria-label={label}
      className={`select-none rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 ${className ?? ''}`}
      {...regionProps}
    >
      <View className={`relative w-full ${sides ? 'px-14' : ''}`}>
      <View onLayout={onLayout} className={`relative w-full ${viewportClassName ?? ''}`}>
        <ScrollView
          {...({ ref: scrollRef } as object)}
          {...(dragProps as object)}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={50}
          className={enableSwipe ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : undefined}
          // Computed: CSS scroll snap has no class in the RN style layer; web-only
          // property, off while a mouse drag moves the track.
          style={{ scrollSnapType: dragging ? 'none' : 'x mandatory' } as object}
        >
          {slides.map((slide, i) => (
            <View
              key={i}
              role="group"
              aria-label={`${i + 1} of ${slides.length}`}
              {...({ 'aria-roledescription': 'slide' } as object)}
              className={`relative pb-2 pr-2 ${showCornerAccents && cornerAccentStyle === 'plus' ? 'p-2' : ''} ${itemClassName ?? ''}`}
              // Computed: card width comes from the measured track; snap alignment is web-only CSS.
              style={{ width: m.itemWidth, marginRight: i < slides.length - 1 ? gap : 0, scrollSnapAlign: 'start', flexShrink: 0 } as object}
            >
              {slide}
              {showCornerAccents ? <CornerAccents tone={resolved} style={cornerAccentStyle} /> : null}
            </View>
          ))}
        </ScrollView>
        {scanLines ? <ScanLines height={size.height} /> : null}
        {showEdgeFades ? <EdgeFades color={edgeFadeColor} /> : null}
      </View>
        {sides ? (
          <SideButtons
            index={index}
            maxIndex={m.maxIndex}
            loop={loop}
            tone={resolved}
            prevCorner={prevButtonCorner}
            nextCorner={nextButtonCorner}
            onGo={go}
            className={fade}
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
        showButtons={showButtons && paged}
        showProgress={showProgress && paged}
        progressStyle={progressStyle}
        onGo={go}
        buttonPosition={buttonPosition}
        prevCorner={prevButtonCorner}
        nextCorner={nextButtonCorner}
        buttonClassName={fade}
        autoplay={autoPlay && paged ? { playing: state.playing, onToggle: () => store.setState({ playing: !store.getState().playing }) } : undefined}
      />
    </Section>
  );
}
