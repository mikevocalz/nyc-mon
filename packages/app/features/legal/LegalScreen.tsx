'use client';

import { Heading, Text } from '@acme/ui';
import { Pressable, ScrollView, Text as InlineText, View } from '@acme/ui/tw';
import { LEGAL_COPY, type LegalDocument, type LegalParagraph } from './copy.ts';

/** The app's legal routes, keyed by the same slugs as the site's /legal/* pages. */
export const LEGAL_DOCS = {
  privacy: LEGAL_COPY.privacy,
  terms: LEGAL_COPY.terms,
  'childrens-privacy': LEGAL_COPY.childrens,
} as const satisfies Record<string, LegalDocument>;

export type LegalSlug = keyof typeof LEGAL_DOCS;

export function isLegalSlug(value: unknown): value is LegalSlug {
  return typeof value === 'string' && value in LEGAL_DOCS;
}

const numeral = (i: number) => String(i + 1).padStart(2, '0');
const PARAGRAPH = 'text-base leading-7 text-text md:text-lg md:leading-8';

function Paragraph({ paragraph, onOpen }: { paragraph: LegalParagraph; onOpen: (slug: LegalSlug) => void }) {
  if (typeof paragraph === 'string') return <Text className={PARAGRAPH}>{paragraph}</Text>;
  const slug = paragraph.link.href.replace(/^\/legal\//, '');
  return (
    <Text className={PARAGRAPH}>
      {paragraph.before}
      <InlineText
        role="link"
        className="font-semibold text-text underline"
        onPress={isLegalSlug(slug) ? () => onOpen(slug) : undefined}
      >
        {paragraph.link.label}
      </InlineText>
      {paragraph.after}
    </Text>
  );
}

/**
 * One legal document in the app, the same wording as the site's W06 page
 * (./copy.ts). Night masthead with the three notices as a switcher, then the
 * numbered sections. The stack header carries the back button.
 *
 * - Phone: masthead, then the sections in one column.
 * - Tablet portrait (md): the same order in a wider, larger column.
 * - Landscape from md: contents on the left, the document on the right, each
 *   scrolling on its own, like the site's lg layout.
 */
export function LegalScreen({ slug, onOpen }: { slug: LegalSlug; onOpen: (slug: LegalSlug) => void }) {
  const doc = LEGAL_DOCS[slug];

  // `column`: the portrait masthead lines up with the centred document column.
  const masthead = (column: boolean) => (
    <View className={`bg-ink-950 px-4 pb-8 pt-6 md:pb-10 ${column ? "" : "md:px-8"}`}>
      <View className={`gap-4 ${column ? 'mx-auto w-full max-w-[760px] md:px-8' : ''}`}>
      <Text className="font-display text-sm uppercase tracking-widest text-orange-500">{doc.eyebrow}</Text>
      <Heading level={1} size="display-sm" className="uppercase text-ink-50">{doc.title}</Heading>
      <Text className="text-silver-300">{doc.updated}</Text>
      <View className="flex-row flex-wrap gap-2 pt-1" role={'tablist' as never}>
        {(Object.keys(LEGAL_DOCS) as LegalSlug[]).map((other) => {
          const current = other === slug;
          return (
            <Pressable
              key={other}
              role="tab"
              aria-selected={current}
              onPress={() => (current ? undefined : onOpen(other))}
              className={`min-h-11 justify-center border-2 px-4 ${current ? 'border-orange-500 bg-orange-500' : 'border-silver-500'}`}
            >
              <Text className={`text-sm font-semibold ${current ? 'text-on-cta' : 'text-ink-50'}`}>{LEGAL_DOCS[other].title}</Text>
            </Pressable>
          );
        })}
      </View>
      </View>
    </View>
  );

  const sections = doc.sections.map((section, i) => (
    <View key={section.id} className={`gap-4 py-8 ${i === 0 ? 'pt-0' : 'border-t-2 border-ink-700'}`}>
      <View className="flex-row items-start gap-3">
        <Text aria-hidden className="bg-signage-black px-2.5 pb-1 pt-1.5 font-display text-base text-signage-white md:text-lg">
          {numeral(i)}
        </Text>
        <Heading level={2} size="title" className="min-w-0 flex-1 uppercase">{section.title}</Heading>
      </View>
      {section.body.map((paragraph, j) => (
        <Paragraph key={j} paragraph={paragraph} onOpen={onOpen} />
      ))}
    </View>
  ));

  const contents = (
    <View className="gap-1">
      <Text className="self-start bg-signage-black px-3 pb-1.5 pt-2 font-display text-sm uppercase text-signage-white">{doc.title}</Text>
      <View className="border-l-4 border-signage-black">
        {doc.sections.map((section, i) => (
          <View key={section.id} className="min-h-11 flex-row items-center gap-3 py-1.5 pl-4 pr-2">
            <Text aria-hidden className="w-7 font-display text-sm text-text-muted">{numeral(i)}</Text>
            <Text className="flex-1 font-semibold">{section.title}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-bg">
      {/* Phone and tablet portrait: one scroll. */}
      <ScrollView className="flex-1 md:landscape:hidden" contentContainerClassName="pb-12">
        {masthead(true)}
        <View className="mx-auto w-full max-w-[760px] px-4 pt-8 md:px-8 md:pt-10">{sections}</View>
      </ScrollView>
      {/* Landscape from md: masthead and contents left, the document right. */}
      <View className="hidden flex-1 flex-row md:landscape:flex">
        <ScrollView className="w-[40%] border-r-2 border-border" contentContainerClassName="pb-12">
          {masthead(false)}
          <View className="px-8 pt-8">{contents}</View>
        </ScrollView>
        <ScrollView className="flex-1" contentContainerClassName="px-10 pb-12 pt-10">
          <View className="max-w-[760px]">{sections}</View>
        </ScrollView>
      </View>
    </View>
  );
}
