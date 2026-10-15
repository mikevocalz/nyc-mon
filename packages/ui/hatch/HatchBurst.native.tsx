'use client';
import '../rn-globals-shim';
import { useDerivedValue } from 'react-native-reanimated';
import { Canvas, Circle, RadialGradient, vec } from 'react-native-skia';
import { palette } from '@acme/theme';
import { hiddenA11y } from '../hlynk/a11y';
import { View } from '../tw';
import { burstOpacity, burstScale } from './hatch-model';
import type { HatchBurstProps } from './HatchBurst.types';

export type { HatchBurstProps };

/**
 * PLATFORM FORK (native): the hatch burst as a Skia radial gradient
 * (`react-native-skia` 3.0.2 `Circle` + `RadialGradient`). Opacity and radius
 * are derived values of `progress`, so the 500 ms bloom never re-renders
 * React. When the TypeGPU pass lands (§3.3) it replaces these internals
 * behind the same props; the light-budget cap stays. Reduced: nothing.
 */
export function HatchBurst({ progress, peakOpacity, reducedMotion, sizePt = 320, testID }: HatchBurstProps) {
  const c = sizePt / 2;
  const opacity = useDerivedValue(() => burstOpacity(progress.get(), peakOpacity));
  const r = useDerivedValue(() => c * burstScale(progress.get()));
  if (reducedMotion) return null;
  return (
    <View testID={testID} {...(hiddenA11y(true) as object)} style={{ width: sizePt, height: sizePt, pointerEvents: 'none' }}>
      <Canvas style={{ width: sizePt, height: sizePt }}>
        <Circle cx={c} cy={c} r={r} opacity={opacity}>
          <RadialGradient
            c={vec(c, c)}
            r={c}
            colors={[palette.orange[100], palette.orange[300], `${palette.orange[500]}00`]}
            positions={[0, 0.4, 1]}
          />
        </Circle>
      </Canvas>
    </View>
  );
}
