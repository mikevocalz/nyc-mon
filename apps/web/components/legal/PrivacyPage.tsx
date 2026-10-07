import { Article, Heading, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { Eyebrow } from '../home/Eyebrow';
import { LEGAL_COPY } from './copy';
import { LegalParagraph, legalParagraphKey } from './LegalParagraph';

/** W06 — the privacy notice. Document sections are Sections inside an Article. */
export function PrivacyPage() {
  const doc = LEGAL_COPY.privacy;
  return (
    <View className="w-full flex-1 bg-bg">
      <Section
        aria-labelledby="w06-privacy-title"
        data-testid="w06-privacy"
        className="mx-auto w-full max-w-screen-md gap-10 px-4 py-16 sm:px-6 md:py-24 lg:px-8"
      >
        <View className="gap-4">
          <Eyebrow>{doc.eyebrow}</Eyebrow>
          <Heading
            level={1}
            id="w06-privacy-title"
            className="my-0 font-display text-4xl leading-tight text-text md:text-5xl"
          >
            {doc.title}
          </Heading>
          <Paragraph className="my-0 text-sm text-text-muted">{doc.updated}</Paragraph>
        </View>
        <Article className="gap-6">
          {doc.sections.map((section) => (
            <Section key={section.id} aria-labelledby={section.id} className="gap-3">
              <Heading level={2} id={section.id} className="my-0 font-display text-2xl text-text">
                {section.title}
              </Heading>
              {section.body.map((paragraph) => (
                <LegalParagraph key={legalParagraphKey(paragraph)} paragraph={paragraph} />
              ))}
            </Section>
          ))}
        </Article>
      </Section>
    </View>
  );
}
