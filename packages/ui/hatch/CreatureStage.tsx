'use client';
import '../rn-globals-shim';
import { useEffect, type ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { View } from '../tw';
import { FRAMING, emergePose, firstLookPose, type CreatureFraming } from './hatch-model';
import { easingPoints, tokenMs } from './motion-curves';

/** Hatch-only performance the scene contract has no intent for yet (M12 "Contract gap"). */
export type CreaturePerformance =
  | { kind: 'hatch-emerge' }
  | { kind: 'first-look'; choice: 'lean-in' | 'hesitate'; resolved: boolean };

export interface CreatureStageProps<S> {
  /** `null` while an egg incubates (M11 draws the case instead). The screen passes `selectSceneInput(...)`. */
  scene: S | null;
  /** Framing preset; the move between presets is the continuity (M11 → M12 → M09 → M13). */
  framing: CreatureFraming;
  performance?: CreaturePerformance;
  reducedMotion: boolean;
  /**
   * Draws the creature for a scene: the Baby plate from `creatureArt(...)`
   * now, the renderer's `MonModelSlot` later. The kit holds no art and does
   * not import `@acme/core`, so the screen supplies this.
   */
  renderStill: (scene: S) => ReactNode;
  /** @default 'home-creature-stage' */
  testID?: string;
}

const EMPHASIZED = easingPoints('emphasized');
const REFRAME_MS = tokenMs('motion-enter', false);
const EMERGE_MS = 1000;

/**
 * The creature layer shared by M11, M12, M09 and M13. It lives in
 * `/(home)/_layout.tsx` under the shell's screen slot, so route changes never
 * unmount the creature; only `framing` and `performance` change. Framing
 * moves animate on the UI thread (300 ms `emphasized`); reduced motion
 * reframes instantly. A hesitation tucks aside but never turns away and
 * resolves into the lean-in (D-15g).
 */
export function CreatureStage<S>({
  scene, framing, performance, reducedMotion, renderStill, testID = 'home-creature-stage',
}: CreatureStageProps<S>) {
  const height = useSharedValue(0);
  const width = useSharedValue(0);
  const scale = useSharedValue(FRAMING[framing].scale);
  const ty = useSharedValue(FRAMING[framing].translateY);
  const emerge = useSharedValue(performance?.kind === 'hatch-emerge' ? 0 : 1);
  const lookScale = useSharedValue(1);
  const lookX = useSharedValue(0);
  const lookRot = useSharedValue(0);

  useEffect(() => {
    const f = FRAMING[framing];
    const cfg = { duration: REFRAME_MS, easing: Easing.bezier(...EMPHASIZED) };
    scale.set(reducedMotion ? f.scale : withTiming(f.scale, cfg));
    ty.set(reducedMotion ? f.translateY : withTiming(f.translateY, cfg));
  }, [framing, reducedMotion, scale, ty]);

  const kind = performance?.kind;
  const choice = performance?.kind === 'first-look' ? performance.choice : undefined;
  const resolved = performance?.kind === 'first-look' ? performance.resolved : false;
  useEffect(() => {
    if (kind === 'hatch-emerge') {
      emerge.set(0);
      emerge.set(reducedMotion ? 1 : withTiming(1, { duration: EMERGE_MS, easing: Easing.bezier(...EMPHASIZED) }));
    } else {
      emerge.set(1);
    }
    const pose = choice ? firstLookPose(choice, resolved) : { scale: 1, translateX: 0, rotateDeg: 0 };
    const cfg = { duration: REFRAME_MS, easing: Easing.bezier(...EMPHASIZED) };
    lookScale.set(reducedMotion ? pose.scale : withTiming(pose.scale, cfg));
    lookX.set(reducedMotion ? pose.translateX : withTiming(pose.translateX, cfg));
    lookRot.set(reducedMotion ? pose.rotateDeg : withTiming(pose.rotateDeg, cfg));
  }, [kind, choice, resolved, reducedMotion, emerge, lookScale, lookX, lookRot]);

  const style = useAnimatedStyle(() => {
    const e = emergePose(emerge.get());
    return {
      opacity: e.opacity,
      transform: [
        { translateY: (ty.get() + e.translateY) * height.get() },
        { translateX: lookX.get() * width.get() },
        { scale: scale.get() * lookScale.get() },
        { rotate: `${lookRot.get()}deg` },
      ],
    };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    height.set(e.nativeEvent.layout.height);
    width.set(e.nativeEvent.layout.width);
  };

  return (
    <View testID={testID} className="absolute inset-0 overflow-hidden" style={{ pointerEvents: 'none' }} onLayout={onLayout}>
      {scene === null ? null : (
        <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', transformOrigin: 'bottom' }, style]}>
          {renderStill(scene)}
        </Animated.View>
      )}
    </View>
  );
}
