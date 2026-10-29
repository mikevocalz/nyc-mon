import { useEffect, type EffectCallback } from 'react';

/**
 * Web: a route is focused while it is mounted, so focus is mount and blur is
 * unmount. Kept out of expo-router so the Next.js build never bundles it.
 */
export function useScreenFocus(effect: EffectCallback): void {
  useEffect(effect, [effect]);
}
