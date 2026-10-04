'use client';
import { Children, type ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { ChevronLeft, ChevronRight } from '../icons';
import { IconButton } from '../IconButton';
import { Text } from '../Text';
import { View } from '../tw';
import { pad2, progressOf, stepIndex } from './card-slider-model';
import type { VisibleCount } from './card-slider-model';
import { TONE_CLASSES, resolveControlTone, toneVariants, type ControlTone, type District, type ToneClasses } from '../district';

export type CardSliderProgressStyle = 'bar' | 'dots' | 'counter';

export interface CardSliderProps {
  /** Slides: kit Cards or anything else. Each becomes one snap stop. */
  children: ReactNode;
  /** Names the carousel for screen readers, e.g. "Featured blocks". */
  label: string;
  /** Cards visible at once: a number, or per breakpoint `{ sm, md, lg, xl }`. Default 1. */
  visibleCount?: VisibleCount;
  /** Gap between cards, px. Default 16. */
  gap?: number;
  /** Previous and next buttons. Default true. */
  showButtons?: boolean;
  showProgress?: boolean;
  /** bar: a solid fill; dots: one tile per stop; counter: 02 / 06. Default bar. */
  progressStyle?: CardSliderProgressStyle;
  /** Stepping past the last card wraps to the first. Default false. */
  loop?: boolean;
  tone?: ControlTone;
  district?: District;
  className?: string;
  /** Classes for each slide wrapper. */
  itemClassName?: string;
}

const controls = tv({
  slots: {
    bar: 'mt-4 flex-row items-center gap-3',
    track: 'h-2 flex-1 overflow-hidden bg-ink-800',
    fill: 'h-full',
    dots: 'flex-1 flex-row flex-wrap items-center gap-1.5',
    dot: 'h-2.5 w-2.5',
    counter: 'flex-1 font-display text-sm tracking-wide',
  },
  variants: { tone: toneVariants(() => ({})) },
  compoundVariants: (Object.entries(toneVariants((c) => c)) as [ControlTone, ToneClasses][]).map(([tone, c]) => ({
    tone, class: { fill: c.face, counter: c.text },
  })),
});

/** Spoken position: "Card 2 of 8", or "Cards 2 to 3 of 8" when several show at once. */
export function sliderStatus(index: number, count: number, visible: number) {
  const first = index + 1;
  const last = Math.min(count, index + visible);
  return first === last ? `Card ${first} of ${count}` : `Cards ${first} to ${last} of ${count}`;
}

export function slidesOf(children: ReactNode) {
  return Children.toArray(children);
}

interface ControlsProps {
  index: number;
  /** Total cards and cards on screen, for the counter and the spoken status. */
  count: number;
  visible: number;
  maxIndex: number;
  loop: boolean;
  tone: ControlTone;
  showButtons: boolean;
  showProgress: boolean;
  progressStyle: CardSliderProgressStyle;
  onGo: (index: number) => void;
}

/**
 * The bar under the track: progress on the left, previous and next on the
 * right. Buttons are kit IconButtons in the corner-cut variant, cut toward
 * the direction they move. The counter doubles as the text equivalent of
 * the progress bar, so it is always readable by assistive tech.
 */
export function SliderControls({ index, count, visible, maxIndex, loop, tone, showButtons, showProgress, progressStyle, onGo }: ControlsProps) {
  const s = controls({ tone });
  const atStart = !loop && index <= 0;
  const atEnd = !loop && index >= maxIndex;
  const stops = maxIndex + 1;
  const first = index + 1;
  const last = Math.min(count, index + visible);
  const status = sliderStatus(index, count, visible);
  const counter = first === last ? `${pad2(first)} / ${pad2(count)}` : `${pad2(first)}–${pad2(last)} / ${pad2(count)}`;
  if (!showButtons && !showProgress) return null;
  return (
    <View className={s.bar()}>
      {showProgress ? (
        progressStyle === 'counter' ? (
          <Text className={s.counter()} aria-label={status}>{counter}</Text>
        ) : progressStyle === 'dots' ? (
          <View className={s.dots()} aria-label={status} role="img">
            {Array.from({ length: stops }, (_, i) => (
              <View key={i} className={`${s.dot()} ${i === index ? TONE_CLASSES[tone].face : 'bg-ink-700'}`} />
            ))}
          </View>
        ) : (
          <View
            className={s.track()}
            role="progressbar"
            aria-label={status}
            aria-valuemin={1}
            aria-valuemax={stops}
            aria-valuenow={index + 1}
            aria-valuetext={status}
          >
            {/* Computed: fill width is the scroll position, a runtime fraction. */}
            <View className={s.fill()} style={{ width: `${Math.max(8, progressOf(index, maxIndex) * 100)}%` }} />
          </View>
        )
      ) : (
        <View className="flex-1" />
      )}
      {showButtons ? (
        <View className="flex-row gap-3">
          <IconButton
            variant="cornerCut"
            tone={tone}
            corner="top-left"
            aria-label="Previous card"
            disabled={atStart}
            onPress={() => onGo(stepIndex(index, -1, maxIndex, loop))}
            icon={<ChevronLeft size={20} className={atStart ? 'text-ink-700' : TONE_CLASSES[tone].onFace} />}
          />
          <IconButton
            variant="cornerCut"
            tone={tone}
            corner="bottom-right"
            aria-label="Next card"
            disabled={atEnd}
            onPress={() => onGo(stepIndex(index, 1, maxIndex, loop))}
            icon={<ChevronRight size={20} className={atEnd ? 'text-ink-700' : TONE_CLASSES[tone].onFace} />}
          />
        </View>
      ) : null}
    </View>
  );
}

export function sliderTone(tone?: ControlTone, district?: District) {
  return resolveControlTone(tone, district);
}
