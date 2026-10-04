'use client';
import { View } from '../tw';

// Stepped fade: solid bands of falling opacity (the shade-step look), so it
// needs no gradient support and reads the same on every platform.
const FADE_STEPS = [0.85, 0.6, 0.35, 0.15];

/** Fades over the left and right edges of the native slider track. */
export function CardSliderEdgeFades({ color }: { color?: string }) {
  const band = (opacity: number, i: number) => (
    <View
      key={i}
      className={`h-full w-4 ${color ? '' : 'bg-ink-950'}`}
      // Runtime opacity per band, and an optional caller colour.
      style={color ? { backgroundColor: color, opacity } : { opacity }}
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
