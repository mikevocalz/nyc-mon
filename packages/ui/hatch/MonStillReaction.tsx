'use client';
import '../rn-globals-shim';
import { useEffect, type ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { REACTION_MS, reactionPose, type StillReaction } from './hatch-model';

export interface MonStillReactionProps {
  /** The still. */
  children: ReactNode;
  /** Pivot in the image's own 0–1 space; per-asset, authored by lookdev. @default { x: 0.5, y: 0.85 } */
  pivot?: { x: number; y: number };
  /** Bump to play once. A change while playing restarts from the current pose, never stacks. */
  playKey: number;
  reaction: StillReaction;
  /** Reduced: no movement at all (the sibling is "none"). */
  reducedMotion: boolean;
}

/**
 * A small authored transform on a 2D creature still (M09 naming, M13's tap
 * for attention) about a per-asset pivot, until the model's clip takes over
 * behind the same props. The pose is `reactionPose(reaction, t)`; `t` runs
 * 0 → 1 over 600 ms on the UI thread, and each new `playKey` restarts it
 * from wherever the still is, so taps never stack. `playKey` 0 never plays.
 */
export function MonStillReaction({ children, pivot = { x: 0.5, y: 0.85 }, playKey, reaction, reducedMotion }: MonStillReactionProps) {
  const t = useSharedValue(1);
  const w = useSharedValue(0);
  const h = useSharedValue(0);
  // The pose the still was in when the latest play began; it decays to rest
  // over the new run, so a restart blends from where the still is.
  const fromRot = useSharedValue(0);
  const fromY = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion || playKey === 0) return;
    const now = reactionPose(reaction, t.get());
    const k = 1 - t.get();
    fromRot.set(now.rotateDeg + fromRot.get() * k);
    fromY.set(now.translateYPt + fromY.get() * k);
    t.set(0);
    t.set(withTiming(1, { duration: REACTION_MS, easing: Easing.linear }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey, reducedMotion]);

  const style = useAnimatedStyle(() => {
    if (reducedMotion) return { transform: [] };
    const tt = t.get();
    const pose = reactionPose(reaction, tt);
    const p = { rotateDeg: pose.rotateDeg + fromRot.get() * (1 - tt), translateYPt: pose.translateYPt + fromY.get() * (1 - tt) };
    // Rotate about the pivot: move it to the centre, rotate, move back.
    const dx = (pivot.x - 0.5) * w.get();
    const dy = (pivot.y - 0.5) * h.get();
    return {
      transform: [
        { translateX: dx },
        { translateY: dy + p.translateYPt },
        { rotate: `${p.rotateDeg}deg` },
        { translateX: -dx },
        { translateY: -dy },
      ],
    };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    w.set(e.nativeEvent.layout.width);
    h.set(e.nativeEvent.layout.height);
  };

  return (
    <Animated.View onLayout={onLayout} style={style}>
      {children}
    </Animated.View>
  );
}
