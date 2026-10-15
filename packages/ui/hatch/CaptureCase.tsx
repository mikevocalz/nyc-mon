'use client';
import '../rn-globals-shim';
import { useId } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { View } from '../tw';
import { CaseDrawing } from './CaseDrawing';
import { lidAngle } from './hatch-model';

export interface CaptureCaseProps {
  /** `closed` on M11; M12 drives `opening` → `open` from its phase clock. */
  lid: 'closed' | 'opening' | 'open';
  /** 0–1 lid progress while `opening`; a SharedValue so M12 can drive it on the UI thread. */
  lidProgress?: SharedValue<number>;
  /** 0–1 pad glow; a SharedValue fed by the shared breath clock (`useLedBreathPhase` + `padGlowAt`). */
  padGlow: SharedValue<number>;
  /** Orange seam light along the lid edge: ready and the hatch (Decision #7). */
  seam: 'off' | 'lit';
  scheme: 'daylit' | 'night';
  reducedMotion: boolean;
  /** "Metro Egg in its case". The case is one image to assistive tech. */
  accessibilityLabel: string;
  /** Side of the square footprint in points. @default 193 (55% of the iPhone SE screen) */
  sizePt?: number;
  /** The egg in the cradle, seen once the lid lifts (M12 passes `HatchEgg`). */
  children?: React.ReactNode;
  testID?: string;
}

/**
 * The single-egg case of M11 and M12 (V11 ¶64), drawn in 2D now; a glb
 * replaces the drawing later behind the same props. While `opening`, the lid
 * angle follows `lidProgress` with M12's 12° overshoot (`lidAngle`); under
 * reduced motion the lid never swings and the open frame cross-fades in. The
 * case never wobbles: the life signal is the pad light, not the object
 * (M11 03-direction.md).
 */
export function CaptureCase({
  lid, lidProgress, padGlow, seam, scheme, reducedMotion, accessibilityLabel, sizePt = 193, children, testID,
}: CaptureCaseProps) {
  const gradientId = `case-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const lidDeg = useDerivedValue(() => lidAngle(lid, lidProgress ? lidProgress.get() : lid === 'open' ? 1 : 0));
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      role="img"
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
    >
      <CaseDrawing
        sizePt={sizePt}
        lidDeg={lidDeg}
        padGlow={padGlow}
        seamLit={seam === 'lit'}
        scheme={scheme}
        reducedMotion={reducedMotion}
        gradientId={gradientId}
      >
        {children}
      </CaseDrawing>
    </View>
  );
}
