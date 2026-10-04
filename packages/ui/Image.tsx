'use client';
import type { ComponentProps } from 'react';
import { tv } from 'tailwind-variants';
import { SolitoImage } from 'solito/image';
import { View } from './tw';
import { TONE_CLASSES, resolveControlTone, type ControlTone, type District } from './district';

type SolitoImageProps = ComponentProps<typeof SolitoImage>;

/**
 * The NYC-MON frame: a heavy keyline around the picture over a solid depth
 * plate stepped down and right, like a poster pasted on a wall. A night
 * keyline on a steel plate by default; a `district` or `tone` turns the
 * keyline to the tone face and the plate to its darker step. Plate and
 * frame both fit inside the box the caller sizes, so the image never spills
 * into the layout around it.
 */
const frame = tv({
  slots: {
    root: 'relative',
    plate: 'absolute bottom-0 left-1.5 right-0 top-1.5',
    face: 'absolute bottom-1.5 left-0 right-1.5 top-0 overflow-hidden border-2 bg-ink-900',
  },
});

export interface ImageProps extends Omit<SolitoImageProps, 'fill'> {
  /** Tailwind classes for the wrapper (size the image here when using fill). */
  className?: string;
  /** Fill the wrapper (wrapper must have dimensions via className). Default true when no width/height given. */
  fill?: boolean;
  /** Keyline and depth plate around the picture. Default true; false renders the bare image. */
  framed?: boolean;
  /** Opt-in rounded corners (rounded-soft). Default false: square. */
  rounded?: boolean;
  /** Frame colour by neighbourhood. Default: night keyline and plate. */
  district?: District;
  /** Frame colour; overrides the district. */
  tone?: ControlTone;
}

// The plate offset is 6px (left-1.5/top-1.5), so a sized image grows by that much.
const DEPTH = 6;

// Universal content image — SolitoImage renders next/image on web and
// expo-image on native, so one component covers both.
export function Image({ className, fill, width, height, framed = true, district, tone, rounded = false, ...props }: ImageProps) {
  const round = rounded ? 'rounded-soft overflow-hidden' : '';
  const useFill = fill ?? (width == null && height == null);
  const sized = !useFill && width != null && height != null;
  // A frame needs a box: one of width/height alone has no box to draw, so it stays bare.
  if (!framed || (!useFill && !sized)) {
    if (!useFill) return <SolitoImage width={width} height={height} {...props} />;
    return (
      <View className={`relative overflow-hidden ${round} ${className ?? ''}`}>
        <SolitoImage fill contentFit="cover" {...props} />
      </View>
    );
  }

  const coloured = tone ?? district;
  const t = coloured ? TONE_CLASSES[resolveControlTone(tone, district)] : undefined;
  const s = frame();

  return (
    <View
      className={s.root({ className: `${round} ${className ?? ''}` })}
      // Computed geometry: a fixed-size image keeps its width/height and adds the plate offset.
      style={sized ? { width: Number(width) + DEPTH, height: Number(height) + DEPTH } : undefined}
    >
      <View aria-hidden className={s.plate({ className: t ? t.plate : 'bg-ink-800' })} />
      <View className={s.face({ className: t ? t.border : 'border-ink-950' })}><SolitoImage fill contentFit="cover" {...props} /></View>
    </View>
  );
}
