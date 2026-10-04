'use client';
import { tv } from 'tailwind-variants';
import { View } from '../tw';
import { resolveControlTone, toneVariants, type ControlTone, type District } from '../district';
import { BAR_COUNT, barHeight, barProgress } from './waveform.ts';

const wave = tv({
  slots: {
    root: 'flex-row items-end gap-0.5',
    // Square-cut, bottom-anchored: the bars stand on a street line like a block of towers.
    bar: 'flex-1 overflow-hidden',
    rest: 'h-full w-full',
    played: 'absolute bottom-0 left-0 h-full',
    street: 'h-0.5 w-full',
  },
  variants: {
    // Played bars in the tone face, the rest in its deep step, the street in the plate step.
    tone: toneVariants((c) => ({ rest: c.deep, played: c.face, street: c.plate })),
  },
});

export interface WaveformProps {
  /** Levels, 0–1, oldest first. Short arrays are padded from the left. */
  levels: readonly number[];
  /** Playback position 0–1. Omit while recording: every bar is then "live". */
  progress?: number;
  /** Track height in dp. */
  height?: number;
  /** Colour family. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default midtown (orange). */
  district?: District;
  className?: string;
}

/**
 * The bars, drawn as a skyline.
 *
 * Solid, square-ended blocks standing on a street line, the played part in
 * the tone's face and the rest in its deep step, so the playhead reads at a
 * glance without a separate marker. No rounded gradient bars: the kit is
 * hard edges and flat colour, and a waveform is exactly the component that
 * slides back to a generic look if it is not held to that.
 *
 * Bars are laid out with a fixed count and `flex-1`, so the waveform occupies
 * the same width whether it holds two samples or fifty. A meter that grows as
 * it fills reads as a progress bar, which is a different promise.
 */
export function Waveform({ levels, progress, height = 48, tone, district, className }: WaveformProps) {
  const s = wave({ tone: resolveControlTone(tone, district) });
  // Pad from the left so a new recording grows from the right edge, the way a
  // tape moves past a head, rather than stretching from the middle.
  const padded =
    levels.length >= BAR_COUNT
      ? levels.slice(levels.length - BAR_COUNT)
      : [...Array.from({ length: BAR_COUNT - levels.length }, () => 0), ...levels];

  return (
    <View aria-hidden className={className}>
      {/* Computed: the track height comes from the height prop. */}
      <View className={s.root()} style={{ height }}>
        {padded.map((level, index) => {
          const filled = progress === undefined ? 1 : barProgress(index, BAR_COUNT, progress);
          return (
            // Computed: each bar's height is its level.
            <View key={index} className={s.bar()} style={{ height: barHeight(level) * height }}>
              <View className={s.rest()} />
              {filled > 0 ? (
                // Computed: the played share of this bar.
                <View className={s.played()} style={{ width: `${filled * 100}%` }} />
              ) : null}
            </View>
          );
        })}
      </View>
      <View className={s.street()} />
    </View>
  );
}
