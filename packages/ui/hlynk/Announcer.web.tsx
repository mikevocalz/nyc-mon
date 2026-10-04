'use client';
import { View, Text } from '../tw';

/** Props for the polite announcer inside {@linkcode HLynkShell}. */
export interface AnnouncerProps {
  /** Spoken politely whenever it changes to a non-empty value. */
  message: string | undefined;
}

/**
 * PLATFORM FORK (web): a visually hidden polite live region. Screen readers
 * read the new text after whatever they are saying, so it never cuts off the
 * destination's title (M01 07-a11y.md finding 4).
 */
export function Announcer({ message }: AnnouncerProps) {
  return (
    <View aria-live="polite" className="sr-only">
      <Text>{message ?? ''}</Text>
    </View>
  );
}
