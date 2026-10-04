import { useEffect } from 'react';
import {
  Easing, ReduceMotion, useDerivedValue, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';

/** Intro progress, 0 to 1, on the UI thread. */
export type IntroProgress = SharedValue<number>;

/**
 * Chart intro on native: a shared value that times from 0 to 1. Skia reads
 * shared values directly, so the intro never re-renders React. Reduced motion
 * jumps to 1 (both our flag and Reanimated's own ReduceMotion.System).
 */
export function useIntro(duration: number, reduced: boolean): IntroProgress {
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      progress.set(1);
      return;
    }
    progress.set(
      withTiming(1, { duration, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }),
    );
  }, [duration, reduced, progress]);
  return progress;
}

/** Map the progress to a Skia prop on the UI thread. `map` must be a worklet. */
export function useIntroValue<T>(progress: IntroProgress, map: (p: number) => T): SharedValue<T> {
  return useDerivedValue(() => map(progress.get()));
}
