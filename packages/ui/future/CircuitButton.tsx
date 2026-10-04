'use client';

import type { ReactNode } from 'react';
import { brand } from '@acme/theme';
import { Pressable, Text, View } from '../tw';

export type CircuitTone = 'orange' | 'royal' | 'carolina';

export interface CircuitButtonProps {
  children: ReactNode;
  onPress?: () => void;
  /** orange = the main action, carolina = secondary, royal = structural. */
  tone?: CircuitTone;
  variant?: 'solid' | 'outline';
  className?: string;
}

// Label colours were picked per tone so every pair clears AA: outline labels
// sit on night (orange 7.8:1, carolina 7.9:1, royal is too dark so it labels
// in white 19:1), solid labels sit on the tone itself.
const tones: Record<CircuitTone, { line: string; outlineLabel: string; solidLabel: string }> = {
  orange: { line: brand.orange, outlineLabel: brand.orange, solidLabel: brand.night },
  carolina: { line: brand.carolina, outlineLabel: brand.carolina, solidLabel: brand.night },
  royal: { line: brand.royal, outlineLabel: brand.white, solidLabel: brand.white },
};

export function CircuitButton({
  children,
  onPress,
  tone = 'carolina',
  variant = 'outline',
  className,
}: CircuitButtonProps) {
  const { line, outlineLabel, solidLabel } = tones[tone];
  const solid = variant === 'solid';
  const tick = solid ? solidLabel : line;

  return (
    <Pressable
      role="button"
      onPress={onPress}
      className={`relative min-h-11 justify-center overflow-hidden px-5 py-3 transition-shadow duration-fast hover:shadow-glow-royal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:opacity-80 ${className ?? ''}`}
      style={{
        borderWidth: 1,
        borderColor: line,
        backgroundColor: solid ? line : `${brand.night}E6`,
      }}
    >
      {/* NeonBlade-style corner brackets */}
      <View pointerEvents="none" className="absolute left-0 top-0 h-2 w-8" style={{ borderTopWidth: 2, borderLeftWidth: 2, borderColor: tick }} />
      <View pointerEvents="none" className="absolute bottom-0 right-0 h-2 w-8" style={{ borderBottomWidth: 2, borderRightWidth: 2, borderColor: tick }} />
      <Text className="text-center text-sm font-bold tracking-wide" style={{ color: solid ? solidLabel : outlineLabel }}>
        {children}
      </Text>
    </Pressable>
  );
}
