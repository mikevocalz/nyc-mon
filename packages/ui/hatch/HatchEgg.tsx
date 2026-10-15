'use client';
import '../rn-globals-shim';
import type { ReactNode } from 'react';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, Polyline, RadialGradient, Rect, Stop } from 'react-native-svg';
import { palette } from '@acme/theme';
import { hiddenA11y } from '../hlynk/a11y';
import { View } from '../tw';
import { CRACK_AT, crackStage } from './hatch-model';

export interface HatchEggProps {
  /** Egg skin by Egg-form Dex id (dex-001 / dex-008 / dex-061). Q11 open: skin per line assumed. */
  eggSpeciesId: string;
  /** 0–1, UI thread. Crack stages at 0.25 / 0.55 / 0.85. */
  hatchProgress: SharedValue<number>;
  /** 0–1 crack light; orange-500 core, orange-300 falloff. */
  crackGlow: SharedValue<number>;
  reducedMotion: boolean;
  /**
   * The egg art. The kit holds no art (it depends on the theme only), so the
   * screen passes the cut-out for `eggSpeciesId`, or until cut-outs exist the
   * `hatch-night.webp` plate (M12 04-components.md).
   */
  art: ReactNode;
  /** @default 120 */
  sizePt?: number;
  testID?: string;
}

/** Three crack polylines in a 100 × 100 box over the egg's upper half; each one more than the last. */
const CRACKS = [
  '50,22 46,30 53,36 47,44',
  '47,44 40,49 44,57 36,62',
  '53,36 61,41 57,49 65,55 60,62',
] as const;

function Crack({ points, index, progress, reducedMotion }: { points: string; index: number; progress: SharedValue<number>; reducedMotion: boolean }) {
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const on = crackStage(p) > index;
    if (reducedMotion || !on) return { opacity: on ? 1 : 0 };
    // Full motion: the crack draws in over the first 0.05 of progress past its stage.
    const t = (p - CRACK_AT[index]!) / 0.05;
    return { opacity: t >= 1 ? 1 : t <= 0 ? 0 : t };
  });
  return (
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Polyline points={points} fill="none" stroke={palette.orange[500]} strokeWidth={1.6} strokeLinejoin="miter" />
      </Svg>
    </Animated.View>
  );
}

/**
 * The egg in the cradle during the hatch (M12). The screen's art underneath;
 * the kit draws the three cracks (at 0.25, 0.55, 0.85 of `hatchProgress`)
 * and the light through them. Both read shared values, so the crack phase
 * never re-renders React. Reduced motion: each crack appears whole at its
 * stage and the light holds steady. Decorative: the case carries the image
 * name and the screen announces the hatch.
 */
export function HatchEgg({ eggSpeciesId, hatchProgress, crackGlow, reducedMotion, art, sizePt = 120, testID }: HatchEggProps) {
  const glowStyle = useAnimatedStyle(() => {
    const g = crackGlow.get();
    const stage = crackStage(hatchProgress.get());
    const level = stage === 0 ? 0 : reducedMotion ? 0.6 : g;
    return { opacity: level <= 0 ? 0 : level >= 1 ? 1 : level };
  });
  return (
    <View testID={testID} {...(hiddenA11y(true) as object)} style={{ width: sizePt, height: sizePt }}>
      <View className="absolute inset-0 items-center justify-center overflow-hidden">{art}</View>
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, glowStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={`crack-${eggSpeciesId}`} cx="50" cy="45" r="28" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={palette.orange[500]} stopOpacity={0.9} />
              <Stop offset="0.5" stopColor={palette.orange[300]} stopOpacity={0.45} />
              <Stop offset="1" stopColor={palette.orange[300]} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={100} height={100} fill={`url(#crack-${eggSpeciesId})`} />
        </Svg>
      </Animated.View>
      {CRACKS.map((points, i) => (
        <Crack key={points} points={points} index={i} progress={hatchProgress} reducedMotion={reducedMotion} />
      ))}
    </View>
  );
}
