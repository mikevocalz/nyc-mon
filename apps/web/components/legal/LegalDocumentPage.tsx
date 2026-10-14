import { Article, Heading, Link, List, ListItem, Nav, OrderedList, Paragraph, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { Eyebrow } from '../home/Eyebrow';
import { LEGAL_COPY, type LegalDocument } from './copy';
import { LegalParagraph, legalParagraphKey } from './LegalParagraph';

// Kept apart so the contrast audit (packages/theme contrast §1.3) reads each pairing on its own:
// the current tab is an orange CTA plate with the signage-black CTA label.
const TAB_CURRENT = 'border-orange-500 bg-orange-500 text-on-cta';
const TAB_OTHER = 'border-silver-500 text-ink-50 hover:border-ink-50';

/** The three notices, in the order the switcher lists them. Labels are the documents' own titles. */
const DOCS = [
  { doc: LEGAL_COPY.privacy, href: '/legal/privacy' },
  { doc: LEGAL_COPY.terms, href: '/legal/terms' },
  { doc: LEGAL_COPY.childrens, href: '/legal/childrens-privacy' },
] as const;

const numeral = (i: number) => String(i + 1).padStart(2, '0');

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2';

/**
 * W06, one legal document as a readable page in the site's language. The
 * wording is the document's own (./copy.ts), untouched.
 *
 * - A night masthead: the kicker, the title in display type, the "Last
 *   updated" line, and the three notices as a switcher (the current one
 *   marked with `aria-current`).
 * - The body on daylight concrete: from `lg` a contents list sits in the
 *   left four columns and stays in view while you read (sticky); the
 *   document runs in a prose measure on the right. Below `lg` the contents
 *   come first, then the document.
 * - Each section heading is a signage line: its number on a black plate,
 *   then the title in display type. The numbers are decoration; the
 *   headings are the document's own titles.
 *
 * Calm on purpose: no motion and no scroll smoothing, so anchors and the
 * browser's own find and scroll behave as expected.
 */
export function LegalDocumentPage({ doc, testId }: { doc: LegalDocument; testId: string }) {
  const titleId = `${testId}-title`;
  const tocId = `${testId}-contents`;
  return (
    <View className="w-full flex-1 bg-bg">
      <Section aria-labelledby={titleId} data-testid={testId} className="w-full">
        <View className="scheme-dark w-full bg-ink-950">
          <View className="mx-auto w-full max-w-screen-xl gap-6 px-4 pb-10 pt-12 sm:px-6 md:pb-14 md:pt-16 lg:px-8">
            <Eyebrow night>{doc.eyebrow}</Eyebrow>
            <Heading
              level={1}
              id={titleId}
              className="my-0 font-display text-display-md uppercase leading-heading text-ink-50 md:text-display-xl md:leading-heading"
            >
              {doc.title}
            </Heading>
            <Paragraph className="my-0 text-base text-silver-300">{doc.updated}</Paragraph>
            <Nav aria-label={doc.eyebrow} className="pt-2">
              <List className="m-0 list-none flex-row flex-wrap gap-2 p-0">
                {DOCS.map(({ doc: other, href }) => {
                  const current = other.title === doc.title;
                  return (
                    <ListItem key={href}>
                      <Link
                        href={href}
                        aria-current={current ? 'page' : undefined}
                        className={`inline-flex min-h-11 items-center border-2 px-4 text-sm font-semibold no-underline ${FOCUS} focus-visible:ring-offset-ink-950 ${current ? TAB_CURRENT : TAB_OTHER}`}
                      >
                        {other.title}
                      </Link>
                    </ListItem>
                  );
                })}
              </List>
            </Nav>
          </View>
          <View aria-hidden className="h-1 w-full bg-orange-500" />
        </View>

        <View className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-12 sm:px-6 md:py-20 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-10 lg:px-8">
          <Nav aria-labelledby={tocId} className="min-w-0 lg:sticky lg:top-32 lg:col-span-4 lg:self-start">
            <Text id={tocId} className="block w-fit bg-signage-black px-3 pb-1.5 pt-2 font-display text-sm uppercase text-signage-white">
              {doc.title}
            </Text>
            <OrderedList className="m-0 list-none gap-0 border-l-4 border-signage-black p-0">
              {doc.sections.map((section, i) => (
                <ListItem key={section.id}>
                  <Link
                    href={`#${section.id}`}
                    className={`flex min-h-11 flex-row items-center gap-3 py-1.5 pl-4 pr-2 text-base text-text no-underline hover:underline hover:underline-offset-4 ${FOCUS} focus-visible:ring-offset-bg`}
                  >
                    <Text aria-hidden className="w-7 shrink-0 font-display text-sm text-text-muted">
                      {numeral(i)}
                    </Text>
                    <Text className="min-w-0 font-semibold leading-6">{section.title}</Text>
                  </Link>
                </ListItem>
              ))}
            </OrderedList>
          </Nav>

          <Article className="min-w-0 gap-0 lg:col-span-8">
            {doc.sections.map((section, i) => (
              <Section
                key={section.id}
                aria-labelledby={section.id}
                className={`gap-4 py-8 md:py-10 ${i === 0 ? 'pt-0 md:pt-0' : 'border-t-2 border-ink-950'}`}
              >
                <View className="flex-row items-start gap-4">
                  <Text aria-hidden className="shrink-0 bg-signage-black px-2.5 pb-1 pt-1.5 font-display text-base leading-6 text-signage-white md:text-lg">
                    {numeral(i)}
                  </Text>
                  <Heading
                    level={2}
                    id={section.id}
                    className="my-0 min-w-0 scroll-mt-32 pt-0.5 font-display text-2xl uppercase leading-heading text-text md:text-3xl"
                  >
                    {section.title}
                  </Heading>
                </View>
                <View className="max-w-content-prose gap-4">
                  {section.body.map((paragraph) => (
                    <LegalParagraph key={legalParagraphKey(paragraph)} paragraph={paragraph} />
                  ))}
                </View>
              </Section>
            ))}
          </Article>
        </View>
      </Section>
    </View>
  );
}
