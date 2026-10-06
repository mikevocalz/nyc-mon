'use client';
import { tv } from 'tailwind-variants';
import { View, Text } from './tw';
import { Info, TriangleAlert, Check } from './icons';
import type { ReactNode } from 'react';

/**
 * Page-level notices for the console (04-components.md G16): masking
 * reminders, "deletion scheduled", "not connected", errors with a Try again
 * action. Not dismissible by default — a screen that lets staff close one
 * owns that state. `live="alert"` is only for a banner that appears in
 * response to an action; banners present on load use the default `status`.
 */
const banner = tv({
  slots: {
    root: 'w-full flex-row items-start gap-3 border-2 px-4 py-3',
    icon: 'mt-0.5 shrink-0',
    body: 'min-w-0 flex-1 gap-1',
    title: 'font-display text-base leading-tight',
    description: 'text-sm leading-snug',
    action: 'mt-1 self-start',
  },
  variants: {
    tone: {
      info: { root: 'border-info bg-surface-raised', icon: 'text-info', title: 'text-text', description: 'text-text-secondary' },
      success: { root: 'border-success bg-surface-raised', icon: 'text-success', title: 'text-text', description: 'text-text-secondary' },
      danger: { root: 'border-danger bg-surface-raised', icon: 'text-danger', title: 'text-text', description: 'text-text-secondary' },
      neutral: { root: 'border-border bg-surface-sunken', icon: 'text-text-muted', title: 'text-text', description: 'text-text-secondary' },
    },
  },
  defaultVariants: { tone: 'neutral' },
});

const TONE_ICON = { info: Info, success: Check, danger: TriangleAlert, neutral: Info } as const;

export interface BannerProps {
  tone: 'info' | 'danger' | 'success' | 'neutral';
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * 'status' (default) is a polite region; 'alert' is assertive — use only
   * when the banner appears in response to an action (G16, 07-a11y.md).
   */
  live?: 'status' | 'alert';
  className?: string;
}

export function Banner({ tone, title, description, action, live = 'status', className }: BannerProps) {
  const s = banner({ tone });
  const Icon = TONE_ICON[tone];
  return (
    <View role={live} className={s.root({ className })}>
      <View aria-hidden className={s.icon()}>
        <Icon size={18} />
      </View>
      <View className={s.body()}>
        <Text className={s.title()}>{title}</Text>
        {description ? <Text className={s.description()}>{description}</Text> : null}
        {action ? <View className={s.action()}>{action}</View> : null}
      </View>
    </View>
  );
}
