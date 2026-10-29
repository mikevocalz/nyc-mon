'use client';

import { useEffect, useRef, type ComponentProps, type FC, type Ref } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Heading, Text, useReducedMotion } from '@acme/ui';
import { Nav, Pressable, ScrollView, Text as InlineText, View } from '@acme/ui/tw';
import { LEGAL_COPY, LEGAL_UI, type LegalDocument, type LegalParagraph } from './copy.ts';

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

/**
 * The kit ScrollView with its ref typed. On React 19 a function component gets
 * `ref` as a plain prop, and the Uniwind wrapper spreads every prop into RN's
 * ScrollView, so the ref lands on the native scroll view; only the FC type
 * leaves it out.
 */
type ScrollHandle = { scrollTo: (to: { y: number; animated?: boolean }) => void };
const DocScroll = ScrollView as FC<Omit<ComponentProps<typeof ScrollView>, 'ref'> & { ref?: Ref<ScrollHandle> }>;

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
 * - Tablet portrait (md): the same order, top-aligned, in a wider column
 *   (content-screen) with the masthead heading one rung up.
 * - Landscape from md: masthead and contents on the left, the document on the
 *   right at the content-detail measure, each scrolling on its own, like the
 *   site's lg layout. A contents row scrolls the document to its section.
 *
 * Both trees stay mounted (Tailwind picks the one drawn), so rotating keeps
 * the document and its scroll position. Section offsets live in refs.
 */
export function LegalScreen({ slug, onOpen }: { slug: LegalSlug; onOpen: (slug: LegalSlug) => void }) {
  const doc = LEGAL_DOCS[slug];
  const reducedMotion = useReducedMotion();
  const stackScroll = useRef<ScrollHandle>(null);
  const contentsScroll = useRef<ScrollHandle>(null);
  const documentScroll = useRef<ScrollHandle>(null);
  // Landscape document pane: the sections wrapper's top inside the scroll
  // content, and each section's top inside that wrapper.
  const wrapperTop = useRef(0);
  const sectionTops = useRef<Record<string, number>>({});

  // A new document starts at its top in every pane. Section ids are unique
  // across documents, so the offsets need no reset (and clearing them here
  // could race the new sections' onLayout).
  useEffect(() => {
    for (const ref of [stackScroll, contentsScroll, documentScroll]) {
      ref.current?.scrollTo({ y: 0, animated: false });
    }
  }, [slug]);

  const jumpTo = (id: string) => {
    const top = sectionTops.current[id];
    if (top === undefined) return;
    documentScroll.current?.scrollTo({ y: Math.max(0, wrapperTop.current + top - 16), animated: !reducedMotion });
  };

  // `column`: the portrait masthead lines up with the centred document column.
  const masthead = (column: boolean) => (
    <View className={`bg-ink-950 px-4 pb-8 pt-6 md:pb-10 ${column ? "" : "md:px-8"}`}>
      <View className={`gap-4 ${column ? 'mx-auto w-full max-w-content-screen md:px-8' : ''}`}>
      <Text className="font-display text-sm uppercase tracking-widest text-orange-500">{doc.eyebrow}</Text>
      {/* Tablet: one rung above the kit's display-sm step at md. */}
      <Heading level={1} size="display-sm" className="uppercase text-ink-50 md:text-display-lg">{doc.title}</Heading>
      <Text className="text-silver-300 md:text-lg">{doc.updated}</Text>
      <View className="flex-row flex-wrap gap-2 pt-1" role={'tablist' as never} aria-label={LEGAL_UI.switcherLabel}>
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

  // `track`: the landscape document pane records each section's top for jumpTo.
  const sections = (track: boolean) => doc.sections.map((section, i) => (
    <View
      key={section.id}
      className={`gap-4 py-8 ${i === 0 ? 'pt-0' : 'border-t-2 border-ink-700'}`}
      onLayout={track ? (e: LayoutChangeEvent) => { sectionTops.current[section.id] = e.nativeEvent.layout.y; } : undefined}
    >
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
    <Nav className="gap-1" aria-label={LEGAL_UI.contentsLabel}>
      <Text className="self-start bg-signage-black px-3 pb-1.5 pt-2 font-display text-sm uppercase text-signage-white">{doc.title}</Text>
      <View className="border-l-4 border-signage-black">
        {doc.sections.map((section, i) => (
          <Pressable
            key={section.id}
            role="link"
            accessibilityHint={LEGAL_UI.contentsHint}
            onPress={() => jumpTo(section.id)}
            className="min-h-11 flex-row items-center gap-3 py-1.5 pl-4 pr-2"
          >
            <Text aria-hidden className="w-7 font-display text-sm text-text-muted">{numeral(i)}</Text>
            <Text className="flex-1 font-semibold underline">{section.title}</Text>
          </Pressable>
        ))}
      </View>
    </Nav>
  );

  return (
    <View className="flex-1 bg-bg">
      {/* Phone and tablet portrait: one scroll. */}
      <DocScroll ref={stackScroll} className="flex-1 md:landscape:hidden" contentContainerClassName="pb-12">
        {masthead(true)}
        <View className="mx-auto w-full max-w-content-screen px-4 pt-8 md:px-8 md:pt-10">{sections(false)}</View>
      </DocScroll>
      {/* Landscape from md: masthead and contents left, the document right. */}
      <View className="hidden flex-1 flex-row md:landscape:flex">
        <DocScroll ref={contentsScroll} className="w-[40%] border-r-2 border-border" contentContainerClassName="pb-12">
          {masthead(false)}
          <View className="px-8 pt-8">{contents}</View>
        </DocScroll>
        {/* The document at a readable measure, not stretched to the pane. */}
        <DocScroll ref={documentScroll} className="flex-1" contentContainerClassName="px-10 pb-12 pt-10">
          <View
            className="max-w-content-detail"
            onLayout={(e: LayoutChangeEvent) => { wrapperTop.current = e.nativeEvent.layout.y; }}
          >
            {sections(true)}
          </View>
        </DocScroll>
      </View>
    </View>
  );
}
