'use client';
import { tv } from 'tailwind-variants';
import { View, Text } from './tw';
import { Output } from './primitives';
import type { ReactNode } from 'react';

/**
 * The console's one bold element (04-components.md G11): the MTA-signage
 * band. `signage` is `signage-black` face with `signage-white` type
 * (21.00:1); `danger` is the `danger` face with `on-danger` type (5.48:1 by
 * day). `hero` is the Overview band, `strip` the one-line 44 px global alert
 * above the pane row. Tone changes are announced politely; same-tone detail
 * edits are not — the strip would re-announce on every poll.
 */
const band = tv({
  slots: {
    root: 'w-full flex-row items-center gap-3 px-4',
    headline: 'font-display tracking-wide',
    detail: 'text-sm',
    action: 'ml-auto shrink-0',
  },
  variants: {
    tone: {
      signage: { root: 'bg-signage-black', headline: 'text-signage-white', detail: 'text-signage-white' },
      danger: { root: 'bg-danger', headline: 'text-on-danger', detail: 'text-on-danger' },
    },
    size: {
      hero: { root: 'min-h-16 py-3', headline: 'text-2xl leading-8' },
      strip: { root: 'h-11', headline: 'text-sm' },
    },
  },
  defaultVariants: { tone: 'signage', size: 'hero' },
});

export interface SignageBandProps {
  tone: 'signage' | 'danger';
  headline: string;
  detail?: string;
  action?: ReactNode;
  /** 'hero' (default) is the Overview band; 'strip' is the 44 px global alert. */
  size?: 'hero' | 'strip';
  className?: string;
}

export function SignageBand({ tone, headline, detail, action, size = 'hero', className }: SignageBandProps) {
  const s = band({ tone, size });
  return (
    <View className={s.root({ className })}>
      <Text className={s.headline()}>{headline}</Text>
      {detail ? (
        // <output> is a polite live region: announced when the tone (and so
        // the band's meaning) changes.
        <Output key={tone} className="min-w-0 flex-1">
          <Text className={s.detail()}>{detail}</Text>
        </Output>
      ) : null}
      {action ? <View className={s.action()}>{action}</View> : null}
    </View>
  );
}
