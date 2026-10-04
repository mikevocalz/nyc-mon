import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

// The OS "Reduce motion" switch, kept live through the change event. One
// module-level subscription serves every mounted background (repo rule: no
// React useState); it starts with the first subscriber and stops with the last.
let reduced = false;
const listeners = new Set<() => void>();
let systemSubscription: { remove: () => void } | null = null;

function publish(value: boolean) {
  if (value === reduced) return;
  reduced = value;
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

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => reduced, () => false);
}
