'use client';

import type { ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { Button, Text } from '../html';
import { View } from '../tw';

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
// in white 19:1), solid labels sit on the tone itself. ink-950 is the brand
// night and ink-50 the banner white.
const circuit = tv({
  slots: {
    root:
      'relative min-h-11 justify-center overflow-hidden border px-5 py-3 transition-shadow duration-fast ' +
      'hover:shadow-glow-royal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ' +
      'focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:opacity-80',
    // NeonBlade-style corner brackets
    tickStart: 'pointer-events-none absolute left-0 top-0 h-2 w-8 border-l-2 border-t-2',
    tickEnd: 'pointer-events-none absolute bottom-0 right-0 h-2 w-8 border-b-2 border-r-2',
    label: 'text-center text-sm font-bold tracking-wide',
  },
  variants: {
    tone: {
      orange: { root: 'border-orange-500' },
      carolina: { root: 'border-carolina-500' },
      royal: { root: 'border-royal-500' },
    },
    variant: {
      solid: {},
      outline: { root: 'bg-ink-950/90' },
    },
  },
  compoundVariants: [
    { tone: 'orange', variant: 'solid', class: { root: 'bg-orange-500', tickStart: 'border-ink-950', tickEnd: 'border-ink-950', label: 'text-ink-950' } },
    { tone: 'carolina', variant: 'solid', class: { root: 'bg-carolina-500', tickStart: 'border-ink-950', tickEnd: 'border-ink-950', label: 'text-ink-950' } },
    { tone: 'royal', variant: 'solid', class: { root: 'bg-royal-500', tickStart: 'border-ink-50', tickEnd: 'border-ink-50', label: 'text-ink-50' } },
    { tone: 'orange', variant: 'outline', class: { tickStart: 'border-orange-500', tickEnd: 'border-orange-500', label: 'text-orange-500' } },
    { tone: 'carolina', variant: 'outline', class: { tickStart: 'border-carolina-500', tickEnd: 'border-carolina-500', label: 'text-carolina-500' } },
    { tone: 'royal', variant: 'outline', class: { tickStart: 'border-royal-500', tickEnd: 'border-royal-500', label: 'text-ink-50' } },
  ],
});

export function CircuitButton({
  children,
  onPress,
  tone = 'carolina',
  variant = 'outline',
  className,
}: CircuitButtonProps) {
  const s = circuit({ tone, variant });
  return (
    <Button onPress={onPress} className={s.root({ className })}>
      <View className={s.tickStart()} />
      <View className={s.tickEnd()} />
      <Text className={s.label()}>{children}</Text>
    </Button>
  );
}
