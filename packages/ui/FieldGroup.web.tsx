'use client';
import { tv } from 'tailwind-variants';
import { View } from './tw';
import { Text } from './Text';
import { Heading } from './html';
import { NIGHT_SCHEME, NightScope } from './NightScope';
import { resolveControlTone, toneVariants } from './district';
import type { FieldGroupProps, FieldSectionProps } from './FieldGroup.types';

// A grouped settings form drawn as NYC-MON night panels: a solid tone cap
// bar (the cornice), a header strip with the title in the display face over
// an ink keyline, and the fields on the raised night face. The panel scopes
// the dark theme (NightScope), so kit Text and controls inside stay legible
// on a light page.
const section = tv({
  slots: {
    root: `${NIGHT_SCHEME} border-2 border-ink-800 bg-ink-900`,
    cap: 'h-1.5',
    header: 'border-b-2 border-ink-800 px-4 py-2.5',
    title: 'm-0 font-display text-sm tracking-wide md:text-base',
    body: 'gap-4 p-4',
  },
  variants: {
    tone: toneVariants((c) => ({ cap: c.face, title: c.text })),
    uppercase: { true: { title: 'uppercase' } },
  },
});

export function FieldGroup({ children }: FieldGroupProps) {
  return <View className="gap-6">{children}</View>;
}

FieldGroup.Section = function FieldSection({ children, title, titleUppercase = false, tone, district }: FieldSectionProps) {
  const s = section({ tone: resolveControlTone(tone, district), uppercase: titleUppercase });
  return (
    <NightScope>
      <View role="group" aria-label={title} className={s.root()}>
        <View aria-hidden className={s.cap()} />
        {title ? (
          <View className={s.header()}>
            <Heading level={3} className={s.title()}>{title}</Heading>
          </View>
        ) : null}
        <View className={s.body()}>{children}</View>
      </View>
    </NightScope>
  );
};

FieldGroup.SectionHeader = function FieldSectionHeader({ children }: { children?: React.ReactNode }) {
  return <Text className="font-display text-sm tracking-wide text-silver-300 md:text-base">{children}</Text>;
};

FieldGroup.SectionFooter = function FieldSectionFooter({ children }: { children?: React.ReactNode }) {
  return <Text className="text-xs text-silver-300 md:text-sm">{children}</Text>;
};
