import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion as useReanimatedReducedMotion } from 'react-native-reanimated';
import { useForcedReducedMotion } from '../device-preferences';

// The OS "Reduce motion" switch. Reanimated's useReducedMotion gives the right
// value synchronously on the first frame, but it is read once at startup and
// never re-renders when the user flips the setting. The AccessibilityInfo
// event keeps it live. One module-level subscription serves every mounted
// background (repo rule: no React useState); it starts with the first
// subscriber and stops with the last.
let live: boolean | null = null;
const listeners = new Set<() => void>();
let systemSubscription: { remove: () => void } | null = null;

function publish(value: boolean) {
  if (value === live) return;
  live = value;
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (!systemSubscription) {
    systemSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', publish);
    void AccessibilityInfo.isReduceMotionEnabled().then(publish);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      systemSubscription?.remove();
      systemSubscription = null;
    }
  };
}

/** The OS setting OR the Caller's Settings override (M19: mirrors the OS, can force on). */
export function useReducedMotion(): boolean {
  const atLaunch = useReanimatedReducedMotion();
  const forced = useForcedReducedMotion();
  const system = useSyncExternalStore(subscribe, () => live ?? atLaunch, () => atLaunch);
  return forced || system;
}
