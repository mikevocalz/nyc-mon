'use client';

import { AccessibilityInfo } from 'react-native';

/** Polite announcement through the platform AT (VoiceOver / TalkBack). */
export function announcePolitely(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}
