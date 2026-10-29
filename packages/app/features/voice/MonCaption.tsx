'use client';

import { Text } from '@acme/ui/tw';
import { useMonCaption } from './use-mon-voice';

/**
 * The line the Mon is saying, on screen for as long as it is heard (and for a
 * reading time when the voice is off). Already passed through `captionText`
 * by the speaker. A polite live region, so a screen reader reads it too.
 */
export function MonCaption({ testID, className }: { testID: string; className?: string }) {
  const caption = useMonCaption();
  if (caption === null) return null;
  return (
    <Text testID={testID} accessibilityLiveRegion="polite" className={`text-xr-body text-signage-white ${className ?? ''}`}>
      {caption}
    </Text>
  );
}
