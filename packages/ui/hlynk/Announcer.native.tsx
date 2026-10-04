'use client';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { AnnouncerProps } from './Announcer.web';

export type { AnnouncerProps };

/**
 * PLATFORM FORK (native): queue the message behind current speech
 * (`queue: true`, iOS) so it stays polite. Renders nothing.
 */
export function Announcer({ message }: AnnouncerProps) {
  const last = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (message && message !== last.current) {
      AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
    }
    last.current = message;
  }, [message]);
  return null;
}
