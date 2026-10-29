// The Caller's device preferences the kit itself must obey (M19): haptics,
// UI sound and a forced reduced motion. The app owns and persists them
// (packages/app/features/settings/device-prefs.store.ts) and pushes each
// value here on hydrate and on change; every kit path that vibrates, plays a
// sound or animates reads it at the moment it acts. Module state plus a
// listener set, so React hooks subscribe with useSyncExternalStore and
// non-React code (the haptics guard, the chirp) reads it directly.
import { useSyncExternalStore } from 'react';

interface KitPreferences {
  readonly haptics: boolean;
  readonly sound: boolean;
  /** True forces reduced motion on even when the OS setting is off. */
  readonly forceReducedMotion: boolean;
}

let current: KitPreferences = { haptics: true, sound: true, forceReducedMotion: false };
const listeners = new Set<() => void>();

/** Replaces any of the preferences. Unchanged values notify nobody. */
export function setKitPreferences(next: Partial<KitPreferences>): void {
  const merged = { ...current, ...next };
  if (
    merged.haptics === current.haptics &&
    merged.sound === current.sound &&
    merged.forceReducedMotion === current.forceReducedMotion
  ) return;
  current = merged;
  for (const listener of [...listeners]) listener();
}

export function getKitPreferences(): KitPreferences {
  return current;
}

export function hapticsEnabled(): boolean {
  return current.haptics;
}

export function soundEnabled(): boolean {
  return current.sound;
}

export function subscribeKitPreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The forced reduced motion flag, live. */
export function useForcedReducedMotion(): boolean {
  return useSyncExternalStore(subscribeKitPreferences, () => current.forceReducedMotion, () => current.forceReducedMotion);
}

/** The UI sound switch, live. */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribeKitPreferences, () => current.sound, () => current.sound);
}
