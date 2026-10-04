import type { ReactNode } from 'react';
import { Heading, Paragraph, Section } from '../html';
import { SolidPanel } from '../neon/SolidPanel';
import { View } from '../tw';

/** A solid caption plate for background stories. */
export function BackgroundCaption({ title, line }: { title: string; line?: string }) {
  return (
    <View className="absolute bottom-4 left-4 max-w-xs">
      <SolidPanel tone="ink" depth="sm" className="gap-1 px-4 py-3">
        <Heading level={2} className="my-0 font-display text-lg text-ink-50">{title}</Heading>
        {line ? <Paragraph className="my-0 text-sm text-silver-300">{line}</Paragraph> : null}
      </SolidPanel>
    </View>
  );
}

/** One tile per child: a column on phones, two across from md up. */
export function DistrictGrid({ children }: { children: ReactNode[] }) {
  return (
    <View className="min-h-screen gap-4 bg-ink-950 p-4 md:flex-row md:flex-wrap">
      {children.map((child, i) => (
        <Section key={i} className="h-[300px] overflow-hidden border-2 border-ink-800 md:h-[360px] md:w-[calc(50%-0.5rem)]">
          {child}
        </Section>
      ))}
    </View>
  );
}
