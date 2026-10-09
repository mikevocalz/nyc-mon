'use client';
import '../rn-globals-shim';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { palette } from '@acme/theme';
import { hiddenA11y } from '../hlynk/a11y';
import { burstOpacity, burstScale } from './hatch-model';
import type { HatchBurstProps } from './HatchBurst.types';

export type { HatchBurstProps };

/**
 * PLATFORM FORK (web): the same bloom as an SVG radial gradient whose
 * opacity and scale follow `progress` through an animated style, so the
 * page does not load CanvasKit for a 500 ms flash. Reduced: nothing.
 */
export function HatchBurst({ progress, peakOpacity, reducedMotion, sizePt = 320, testID }: HatchBurstProps) {
  const style = useAnimatedStyle(() => ({
    opacity: burstOpacity(progress.get(), peakOpacity),
    transform: [{ scale: burstScale(progress.get()) }],
  }));
  if (reducedMotion) return null;
  const c = sizePt / 2;
  return (
    <Animated.View testID={testID} {...(hiddenA11y(true) as object)} style={[{ width: sizePt, height: sizePt, pointerEvents: 'none' }, style]}>
      <Svg width={sizePt} height={sizePt}>
        <Defs>
          <RadialGradient id="hatch-burst" cx={c} cy={c} r={c} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={palette.orange[100]} />
            <Stop offset="0.4" stopColor={palette.orange[300]} />
            <Stop offset="1" stopColor={palette.orange[500]} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c} fill="url(#hatch-burst)" />
      </Svg>
    </Animated.View>
  );
}
