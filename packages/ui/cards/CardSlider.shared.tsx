'use client';
import { Children, useEffect, type ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { ChevronLeft, ChevronRight, Pause, Play } from '../icons';
import { IconButton } from '../IconButton';
import { Text } from '../Text';
import { View } from '../tw';
import { autoplayNext, pad2, progressOf, stepIndex } from './card-slider-model';
import type {
  CardSliderProgressStyle, CardSliderButtonPosition, CardSliderCornerAccentStyle, ButtonCorner,
} from './card-slider.types';
import { TONE_CLASSES, resolveTone, toneVariants, type ControlTone, type District, type ToneClasses } from './tones';

export type {
  CardSliderProps, CardSliderProgressStyle, CardSliderButtonPosition, CardSliderButtonVisibility,
  CardSliderCornerAccentStyle, ButtonCorner, CardSliderImageItemData, CardSliderImageSource,
  CardSliderImageFrame, CardSliderImageAspect,
} from './card-slider.types';
export { CardSliderImageItem, CITY_PHOTO_ITEMS, photoItem, type CardSliderImageItemProps } from './slider-items';

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
    // The counter sits under the track on the page, not on a night face.
    tone, class: { fill: c.face, counter: c.pageText },
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
  /** Buttons go either side of the progress (bottom) or are drawn elsewhere (sides). */
  buttonPosition?: CardSliderButtonPosition;
  prevCorner?: ButtonCorner;
  nextCorner?: ButtonCorner;
  /** Autoplay control; omitted when autoplay is off. */
  autoplay?: { playing: boolean; onToggle: () => void };
  /** Classes for the button wrappers (the hover fade). */
  buttonClassName?: string;
}

/**
 * The bar under the track: progress on the left, previous and next on the
 * right. Buttons are kit IconButtons in the corner-cut variant, cut toward
 * the direction they move. The counter doubles as the text equivalent of
 * the progress bar, so it is always readable by assistive tech.
 */
export function SliderControls({
  index, count, visible, maxIndex, loop, tone, showButtons, showProgress, progressStyle, onGo,
  // 'bottom' here keeps callers that draw no side buttons (the current native fork) showing them in the bar.
  buttonPosition = 'bottom', prevCorner = 'bottom-left', nextCorner = 'bottom-right', autoplay, buttonClassName,
}: ControlsProps) {
  const s = controls({ tone });
  const atStart = !loop && index <= 0;
  const atEnd = !loop && index >= maxIndex;
  const stops = maxIndex + 1;
  const first = index + 1;
  const last = Math.min(count, index + visible);
  const status = sliderStatus(index, count, visible);
  const counter = first === last ? `${pad2(first)} / ${pad2(count)}` : `${pad2(first)}–${pad2(last)} / ${pad2(count)}`;
  const bottomButtons = showButtons && buttonPosition === 'bottom';
  if (!bottomButtons && !showProgress && !autoplay) return null;
  return (
    <View className={s.bar()}>
      {autoplay ? (
        <IconButton
          variant="cornerCut"
          tone={tone}
          size="sm"
          corner="top-right"
          aria-label={autoplay.playing ? 'Pause autoplay' : 'Start autoplay'}
          onPress={autoplay.onToggle}
          icon={autoplay.playing
            ? <Pause size={16} className={TONE_CLASSES[tone].onFace} />
            : <Play size={16} className={TONE_CLASSES[tone].onFace} />}
        />
      ) : null}
      {bottomButtons ? (
        <View className={buttonClassName}>
          <NavButton dir="prev" tone={tone} corner={prevCorner} disabled={atStart} onPress={() => onGo(stepIndex(index, -1, maxIndex, loop))} />
        </View>
      ) : null}
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
      {bottomButtons ? (
        <View className={buttonClassName}>
          <NavButton dir="next" tone={tone} corner={nextCorner} disabled={atEnd} onPress={() => onGo(stepIndex(index, 1, maxIndex, loop))} />
        </View>
      ) : null}
    </View>
  );
}

/** One previous/next button: a kit IconButton in the corner-cut variant. */
export function NavButton({
  dir, tone, corner, disabled, onPress,
}: { dir: 'prev' | 'next'; tone: ControlTone; corner: ButtonCorner; disabled: boolean; onPress: () => void }) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <IconButton
      variant="cornerCut"
      tone={tone}
      corner={corner}
      aria-label={dir === 'prev' ? 'Previous card' : 'Next card'}
      disabled={disabled}
      onPress={onPress}
      icon={<Icon size={20} className={disabled ? 'text-ink-700' : TONE_CLASSES[tone].onFace} />}
    />
  );
}

/**
 * NeonBlade's side buttons: previous and next float over the track's left
 * and right edges, vertically centred. The track sets `relative`.
 */
export function SideButtons({
  index, maxIndex, loop, tone, prevCorner = 'bottom-left', nextCorner = 'bottom-right', onGo, className,
}: {
  index: number; maxIndex: number; loop: boolean; tone: ControlTone;
  prevCorner?: ButtonCorner; nextCorner?: ButtonCorner; onGo: (i: number) => void; className?: string;
}) {
  const atStart = !loop && index <= 0;
  const atEnd = !loop && index >= maxIndex;
  return (
    <>
      <View className={`absolute bottom-0 left-0 top-0 z-20 justify-center ${className ?? ''}`} pointerEvents="box-none">
        <NavButton dir="prev" tone={tone} corner={prevCorner} disabled={atStart} onPress={() => onGo(stepIndex(index, -1, maxIndex, loop))} />
      </View>
      <View className={`absolute bottom-0 right-0 top-0 z-20 justify-center ${className ?? ''}`} pointerEvents="box-none">
        <NavButton dir="next" tone={tone} corner={nextCorner} disabled={atEnd} onPress={() => onGo(stepIndex(index, 1, maxIndex, loop))} />
      </View>
    </>
  );
}

// Stepped fade: solid bands of falling opacity, the shade-step look, the
// same on every platform (no gradient support needed).
const FADE_STEPS = [0.85, 0.6, 0.35, 0.15];

/** Edge fades over the track, left and right. */
export function EdgeFades({ color }: { color?: string }) {
  const band = (o: number, i: number) => (
    <View
      key={i}
      className={`h-full w-4 ${color ? '' : 'bg-ink-950'}`}
      // Runtime opacity per band, and an optional caller colour.
      style={color ? { backgroundColor: color, opacity: o } : { opacity: o }}
    />
  );
  return (
    <>
      <View aria-hidden pointerEvents="none" className="absolute bottom-0 left-0 top-0 z-10 flex-row">
        {FADE_STEPS.map(band)}
      </View>
      <View aria-hidden pointerEvents="none" className="absolute bottom-0 right-0 top-0 z-10 flex-row-reverse">
        {FADE_STEPS.map(band)}
      </View>
    </>
  );
}

const FRAME_CORNERS = [
  'left-0 top-0 border-l-[3px] border-t-[3px]',
  'right-0 top-0 border-r-[3px] border-t-[3px]',
  'bottom-0 left-0 border-b-[3px] border-l-[3px]',
  'bottom-0 right-0 border-b-[3px] border-r-[3px]',
] as const;
const PLUS_CORNERS = ['-left-2 -top-2', '-right-2 -top-2', '-bottom-2 -left-2', '-bottom-2 -right-2'] as const;

/** NeonBlade's per-card corner accents, in the slider's tone. */
export function CornerAccents({ tone, style }: { tone: ControlTone; style: CardSliderCornerAccentStyle }) {
  const t = TONE_CLASSES[tone];
  if (style === 'plus') {
    return (
      <>
        {PLUS_CORNERS.map((pos) => (
          <View key={pos} aria-hidden pointerEvents="none" className={`absolute z-20 h-4 w-4 items-center justify-center ${pos}`}>
            <View className={`absolute h-4 w-1 ${t.face}`} />
            <View className={`absolute h-1 w-4 ${t.face}`} />
          </View>
        ))}
      </>
    );
  }
  return (
    <>
      {FRAME_CORNERS.map((pos) => (
        <View key={pos} aria-hidden pointerEvents="none" className={`absolute z-20 h-4 w-4 ${t.border} ${pos}`} />
      ))}
    </>
  );
}

/** Blind lines across the track, every 4px. */
export function ScanLines({ height }: { height: number }) {
  const rows = Math.max(0, Math.floor(height / 4));
  return (
    <View aria-hidden pointerEvents="none" className="absolute inset-0 z-10 overflow-hidden">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="mb-[3px] h-px bg-ink-950/40" />
      ))}
    </View>
  );
}

export interface AutoplayState {
  /** The user has not paused it. */
  enabled: boolean;
  /** Hovered or focused: hold the timer without changing the button. */
  held: boolean;
}

/**
 * The autoplay timer. Ticks every `interval` while enabled and not held,
 * stops itself at the end when not looping. Calls `step(next)`.
 */
export function useAutoplay({
  autoPlay, interval, enabled, held, getIndex, maxIndex, loop, step,
}: {
  autoPlay: boolean; interval: number; enabled: boolean; held: boolean;
  getIndex: () => number; maxIndex: number; loop: boolean; step: (next: number) => void;
}) {
  useEffect(() => {
    if (!autoPlay || !enabled || held || maxIndex <= 0) return;
    const id = setInterval(() => {
      const next = autoplayNext(getIndex(), maxIndex, loop);
      if (next === null) clearInterval(id);
      else step(next);
    }, Math.max(800, interval));
    return () => clearInterval(id);
    // getIndex and step read the latest state through the store; their
    // identity changing every render must not restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, enabled, held, interval, maxIndex, loop]);
}

export function sliderTone(tone?: ControlTone, district?: District) {
  return resolveTone(tone, district);
}
