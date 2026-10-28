'use client';

import { create } from 'zustand';
import { setKitPreferences } from '@acme/ui';
import { onboardingStorage } from '../onboarding/storage';
import { DEFAULT_DEVICE_PREFS, readDevicePrefs, writeDevicePrefs, type DevicePrefs } from './device-prefs-model.ts';

interface DevicePrefsState extends DevicePrefs {
  /** Sets one preference, saves all of them to MMKV and pushes the kit's share to @acme/ui. */
  set: <K extends keyof DevicePrefs>(key: K, value: DevicePrefs[K]) => void;
}

function pushToKit(prefs: DevicePrefs): void {
  setKitPreferences({ haptics: prefs.haptics, sound: prefs.sound, forceReducedMotion: prefs.forceReducedMotion });
}

function snapshot(state: DevicePrefs): DevicePrefs {
  return {
    haptics: state.haptics,
    sound: state.sound,
    forceReducedMotion: state.forceReducedMotion,
    notifications: state.notifications,
  };
}

/**
 * M19 device preferences: haptics, sound, forced reduced motion and the
 * egg-alert preference. MMKV `nyc-mon` on native, localStorage on web, the
 * same storage the onboarding flags use. Read synchronously at module load,
 * so the first frame already obeys them; the kit gets its share at once.
 */
export const useDevicePrefs = create<DevicePrefsState>()((set, get) => {
  const initial = readDevicePrefs(onboardingStorage);
  pushToKit(initial);
  return {
    ...initial,
    set: (key, value) => {
      const next = { ...snapshot(get()), [key]: value } as DevicePrefs;
      writeDevicePrefs(onboardingStorage, next);
      pushToKit(next);
      set({ [key]: value } as Partial<DevicePrefsState>);
    },
  };
});

/** Re-reads storage (after Delete account clears it, or a test). */
export function hydrateDevicePrefs(): void {
  const prefs = readDevicePrefs(onboardingStorage);
  pushToKit(prefs);
  useDevicePrefs.setState(prefs);
}

/** The current preferences without subscribing (export, notification gate). */
export function devicePrefs(): DevicePrefs {
  return snapshot(useDevicePrefs.getState());
}

export { DEFAULT_DEVICE_PREFS };
