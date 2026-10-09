'use client';
// RN globals (__DEV__) must exist before Reanimated evaluates on web.
import '../rn-globals-shim';
import { useEffect } from 'react';
import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { breathPhaseAt } from './breath-clock';

/**
 * The H-Lynk breath clock as a `SharedValue<number>`: the 0–1 phase of the
 * `motion-led-breath` period (4000 ms), read from the wall clock on the UI
 * thread every frame (`useFrameCallback`, react-native-reanimated 4.7
 * `lib/typescript/hook/useFrameCallback`). The scanner LED, the case pad glow
 * and the warm haptic read it, so they share one beat (M11 04-components.md
 * "Shared breath clock"). Because the phase comes from the wall clock, two
 * readers that mount at different times still agree.
 *
 * `active: false` stops the frame callback (nothing on screen breathes, or
 * reduced motion is on); the value then holds its last phase.
 */
export function useLedBreathPhase(active: boolean = true): SharedValue<number> {
  const phase = useSharedValue(0);
  const frame = useFrameCallback(() => {
    'worklet';
    phase.set(breathPhaseAt(Date.now()));
  }, active);
  // `autostart` is read once; later changes go through setActive.
  useEffect(() => {
    frame.setActive(active);
  }, [frame, active]);
  return phase;
}
