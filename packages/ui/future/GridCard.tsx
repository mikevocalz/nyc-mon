import type { ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { Article, Heading, Paragraph } from '../html';
import { View } from '../tw';
import type { CircuitTone } from './CircuitButton';

export interface GridCardProps {
  /** Short sentence-case label above the title. Leave it out unless it adds information. */
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  tone?: CircuitTone;
  className?: string;
}

// Eyebrow colours hold AA on the night card (orange 7.8:1, carolina 7.9:1);
// royal is too dark for text there, so a royal card labels in carolina.
// ink-950 is the brand night and ink-50 the banner white.
const card = tv({
  slots: {
    root: 'relative overflow-hidden border bg-ink-950/85 p-5 shadow-card',
    lineTop: 'absolute left-0 top-0 h-px w-20',
    lineSide: 'absolute right-0 top-0 h-7 w-px',
    eyebrow: 'mb-1.5 mt-0 text-sm font-semibold',
    title: 'my-0 font-display text-lg text-ink-50',
  },
  variants: {
    tone: {
      orange: { root: 'border-orange-500/40', lineTop: 'bg-orange-500', lineSide: 'bg-orange-500', eyebrow: 'text-orange-500' },
      carolina: { root: 'border-carolina-500/40', lineTop: 'bg-carolina-500', lineSide: 'bg-carolina-500', eyebrow: 'text-carolina-500' },
      royal: { root: 'border-royal-500/40', lineTop: 'bg-royal-500', lineSide: 'bg-royal-500', eyebrow: 'text-carolina-500' },
    },
  },
});

export function GridCard({ eyebrow, title, children, tone = 'royal', className }: GridCardProps) {
  const s = card({ tone });
  return (
    <Article className={s.root({ className })}>
      <View className={s.lineTop()} />
      <View className={s.lineSide()} />
      {eyebrow ? <Paragraph className={s.eyebrow()}>{eyebrow}</Paragraph> : null}
      <Heading level={3} className={s.title()}>{title}</Heading>
      {children ? <View className="mt-3 gap-2">{children}</View> : null}
    </Article>
  );
}
