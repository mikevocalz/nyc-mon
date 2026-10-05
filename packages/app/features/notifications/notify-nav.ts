'use client';

import { Linking } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * The notifications-off follow-up actions (M06 → M11). Native only — the M06
 * sheet is a mobile form sheet and OS Settings exists only on-device.
 */
export function useNotifyActions(): {
  /** Reopens the M06 sheet. */
  ask: () => void;
  /** `Linking.openSettings()` — the only way back from a denial. */
  openSettings: () => void;
} {
  const router = useRouter();
  return {
    ask: () => router.push('/(onboarding)/notify'),
    openSettings: () => {
      void Linking.openSettings();
    },
  };
}
