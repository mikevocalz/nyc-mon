'use client';

import type { ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { NIGHT_SCHEME, NightScope } from '../NightScope';
import { View } from '../tw';

export type SolidTone = 'orange' | 'royal' | 'carolina' | 'leaf' | 'apple' | 'ink';

export interface SolidPanelProps {
  children?: ReactNode;
  /** Classes for the face (padding, layout). */
  className?: string;
  /** Colour family. Default orange. */
  tone?: SolidTone;
  /** How far the depth plate steps out, down and right. Default md. */
  depth?: 'none' | 'sm' | 'md' | 'lg';
  /** Lit top edge: a highlight-shade band along the top of the face. Default true. */
  rim?: boolean;
  /**
   * `page`: the face takes the page's raised surface instead of a tone, so it
   * is daylit in the light scheme and night in the dark one, and themed text
   * inside reads the page palette. Use it to put copy over a busy scene
   * without turning the page dark. Overrides `tone`. Default `tone`.
   */
  surface?: 'tone' | 'page';
}

/**
 * The basic stacked-solid surface: a face in the tone's 500 step over a
 * depth plate in its 800 step, with a 950 keyline and an optional 300 rim
 * light. Same shade steps as shadeSteps(), expressed as classes so it
 * styles identically on web and native with no inline styles.
 */
const solid = tv({
  slots: {
    root: 'relative',
    plate: 'absolute inset-0',
    face: 'relative border-2',
    rim: 'pointer-events-none absolute inset-x-0 top-0 h-1',
  },
  variants: {
    tone: {
      orange: { plate: 'bg-orange-800', face: 'border-orange-950 bg-orange-500', rim: 'bg-orange-300' },
      royal: { plate: 'bg-royal-800', face: 'border-royal-950 bg-royal-500', rim: 'bg-royal-300' },
      carolina: { plate: 'bg-carolina-800', face: 'border-carolina-950 bg-carolina-500', rim: 'bg-carolina-300' },
      leaf: { plate: 'bg-leaf-800', face: 'border-leaf-950 bg-leaf-500', rim: 'bg-leaf-300' },
      apple: { plate: 'bg-apple-800', face: 'border-apple-950 bg-apple-500', rim: 'bg-apple-300' },
      ink: { plate: 'bg-ink-950', face: 'border-ink-950 bg-ink-800', rim: 'bg-ink-600' },
    },
    surface: {
      tone: {},
      page: { plate: 'bg-ink-950', face: 'border-ink-950 bg-surface-raised', rim: 'bg-cta' },
    },
    depth: {
      none: { plate: 'hidden' },
      sm: { root: 'mb-1 mr-1', plate: 'translate-x-1 translate-y-1' },
      md: { root: 'mb-1.5 mr-1.5', plate: 'translate-x-1.5 translate-y-1.5' },
      lg: { root: 'mb-2.5 mr-2.5', plate: 'translate-x-2.5 translate-y-2.5' },
    },
  },
});

export function SolidPanel({ children, className, tone = 'orange', depth = 'md', rim = true, surface = 'tone' }: SolidPanelProps) {
  const page = surface === 'page';
  // A page face drops the tone classes so the surface ones are the only fill.
  const s = solid({ tone: page ? undefined : tone, depth, surface });
  // The ink face is night in both themes, so themed tokens dropped inside it
  // (text-primary, text-muted) must resolve their dark values, as on Card.
  // A page face follows the page scheme, so it never scopes night.
  const night = !page && tone === 'ink';
  const panel = (
    <View className={s.root()}>
      <View aria-hidden className={s.plate()} />
      <View className={s.face({ className: night ? `${NIGHT_SCHEME} ${className ?? ''}` : className })}>
        {rim ? <View aria-hidden className={s.rim()} /> : null}
        {children}
      </View>
    </View>
  );
  return night ? <NightScope>{panel}</NightScope> : panel;
}
