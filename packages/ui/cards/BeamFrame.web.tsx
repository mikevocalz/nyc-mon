'use client';

import Animated, { type CSSAnimationKeyframes } from 'react-native-reanimated';
import { View } from '../tw';
import { useLayoutSize } from '../use-layout-size';
import { cornerCutClipPath, insetCut } from '../neon/corner-cut';
import { beamWidth, rotorSize, type BeamFrameProps } from './BeamFrame.types';

// Reanimated 4 CSS keyframes. Module constants, so the animation is not
// restarted by a re-render.
const SPIN: CSSAnimationKeyframes = {
  from: { transform: [{ rotate: '0deg' }] },
  to: { transform: [{ rotate: '360deg' }] },
};
const SPIN_BACK: CSSAnimationKeyframes = {
  from: { transform: [{ rotate: '180deg' }] },
  to: { transform: [{ rotate: '-180deg' }] },
};
const SPIN_PULSE: CSSAnimationKeyframes = {
  '0%': { transform: [{ rotate: '0deg' }], opacity: 1 },
  '50%': { transform: [{ rotate: '180deg' }], opacity: 0.35 },
  '100%': { transform: [{ rotate: '360deg' }], opacity: 1 },
};

/** Where a frozen beam rests: across the top-right corner. */
const STILL_ANGLE = '35deg';

/**
 * Web: the border track is a clipped ring; behind the face a square rotor,
 * big enough to cover the frame at any angle, spins with a Reanimated CSS
 * animation. A solid bar runs from the rotor's centre to its edge, so where
 * it crosses the ring it lights a stretch of border that travels around the
 * card. The face sits on top, so only the ring shows the beam. Clip-path
 * keeps the beam inside the cut corner.
 *
 * Inline styles are geometry from the measured size (rotor and bar), colours
 * from props, clip polygons, and the animated rotor style.
 */
export function BeamFrame({
  children, className, corner = 'bottom-right', cut = 20, borderWidth = 3,
  fill, track, beam, tail, beamB, depthColor, depth = 6,
  variant = 'single', duration = 4, durationB = 6, still = false,
}: BeamFrameProps) {
  const { size, onLayout } = useLayoutSize();
  const s = rotorSize(size.width, size.height);
  const bar = beamWidth(size.width, size.height);
  const outer = corner === 'none' ? undefined : cornerCutClipPath(cut, corner);
  const inner = corner === 'none' ? undefined : cornerCutClipPath(insetCut(cut, borderWidth), corner);
  const rotorBox = { position: 'absolute', left: (size.width - s) / 2, top: (size.height - s) / 2, width: s, height: s } as const;

  const rotor = (color: string, tailColor: string, keyframes: CSSAnimationKeyframes, seconds: number, startAngle: string) => (
    <Animated.View
      aria-hidden
      pointerEvents="none"
      style={[
        rotorBox,
        still
          ? { transform: [{ rotate: startAngle }] }
          : {
              animationName: keyframes,
              animationDuration: `${seconds}s`,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
            },
      ]}
    >
      {/* Computed: the tail is a wider, darker bar under the beam; both sized from the measured frame. */}
      <View style={{ position: 'absolute', left: s / 2 - bar, top: 0, width: bar * 2, height: s / 2, backgroundColor: tailColor }} />
      <View style={{ position: 'absolute', left: s / 2 - bar / 2, top: 0, width: bar, height: s / 2, backgroundColor: color }} />
    </Animated.View>
  );

  return (
    <View className="relative">
      {depth > 0 ? (
        <View
          aria-hidden
          className="pointer-events-none absolute inset-0"
          // Computed: depth offset, colour and clip polygon from props.
          style={{ transform: [{ translateX: depth }, { translateY: depth }], backgroundColor: depthColor, clipPath: outer } as object}
        />
      ) : null}
      <View
        onLayout={onLayout}
        className="relative overflow-hidden"
        // Computed: track width, colour and clip polygon from props.
        style={{ padding: borderWidth, backgroundColor: track, clipPath: outer } as object}
      >
        {rotor(beam, tail, variant === 'pulse' ? SPIN_PULSE : SPIN, duration, STILL_ANGLE)}
        {variant === 'dual' && beamB ? rotor(beamB, 'transparent', SPIN_BACK, durationB, '215deg') : null}
        {/* Computed: face colour and inset clip polygon from props. */}
        <View className={`relative ${className ?? ''}`} style={{ backgroundColor: fill, clipPath: inner } as object}>
          {children}
        </View>
      </View>
    </View>
  );
}
