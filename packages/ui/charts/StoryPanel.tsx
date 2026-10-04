// Story-only frame for the chart stories (Charts/*). Not exported from the package.
import type { ReactNode } from 'react';
import { Heading, Paragraph, Section } from '../html';
import { View } from '../tw';

export function StoryPanel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Section className="gap-4 border-2 border-ink-800 bg-ink-950 p-4 md:p-6">
      <Heading level={2} className="my-0 font-display text-xl text-white">{title}</Heading>
      {children}
      {note ? <Paragraph className="my-0 text-sm text-silver-400">{note}</Paragraph> : null}
    </Section>
  );
}

export function StoryPage({ children }: { children: ReactNode }) {
  return <View className="min-h-screen gap-6 bg-ink-950 p-4 md:p-8">{children}</View>;
}
