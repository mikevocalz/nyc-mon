import { useSyncExternalStore, type RefObject } from 'react';
import { AppState } from 'react-native';

function subscribe(onChange: () => void): () => void {
  const subscription = AppState.addEventListener('change', onChange);
  return () => subscription.remove();
}

const active = () => AppState.currentState === 'active';

/**
 * Native: the loop stops while the app is backgrounded. React Native has no
 * viewport intersection signal, so a mounted view counts as on screen; screens
 * unmount or pass `paused` when they leave.
 */
export function useOnScreen(_target: RefObject<unknown>): boolean {
  return useSyncExternalStore(subscribe, active, () => true);
}
