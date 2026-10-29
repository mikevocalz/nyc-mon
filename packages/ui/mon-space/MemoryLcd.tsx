'use client';

import { View } from '../tw';
import type { MemoryLcdProps } from './MemoryLcd.types';

/**
 * The full-screen Memory LCD (M32 Mon Space). Stub: the TSL renderer lands in
 * the next commits; the props are final so lane (c) can build against them.
 */
export function MemoryLcd({ accessibilityLabel, className }: MemoryLcdProps) {
  return (
    <View
      className={className ?? 'flex-1'}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
