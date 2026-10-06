import { LinkButton, SolidPanel, Text } from '@acme/ui';
import { Article, Heading, List, ListItem, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { Eyebrow } from '../home/Eyebrow';
import { STORY_COPY } from './copy';

/** District accent bars, one brand colour per card — same rotation as /city. */
const CARD_ACCENTS = ['bg-orange-500', 'bg-royal-500', 'bg-carolina-500', 'bg-leaf-500'] as const;

const sectionClass =
  'mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:px-8';
const headClass = 'my-0 font-display text-3xl leading-tight text-text md:text-4xl';
const bodyClass = 'my-0 text-base leading-7 text-text-secondary md:text-lg md:leading-8';

function SectionHead({ eyebrow, title, body, id }: { eyebrow: string; title: string; body?: string; id: string }) {
  return (
    <View className="max-w-2xl gap-4">
      <Eyebrow>{eyebrow}</Eyebrow>
      <Heading level={2} id={id} className={headClass}>
        {title}
      </Heading>
      {body !== undefined ? <Paragraph className={bodyClass}>{body}</Paragraph> : null}
    </View>
  );
}

/** A chapter: full-width panel, eyebrow + title + body. */
function Chapter({ testID, id, eyebrow, title, body, quote }: {
  testID: string; id: string; eyebrow: string; title: string; body: string; quote?: string;
}) {
  return (
    <Section aria-labelledby={id} data-testid={testID} className={sectionClass}>
      <View className="max-w-3xl gap-4">
        <Eyebrow>{eyebrow}</Eyebrow>
        <Heading level={2} id={id} className={headClass}>
          {title}
        </Heading>
        <Paragraph className={bodyClass}>{body}</Paragraph>
        {quote !== undefined ? (
          <View className="border-l-4 border-orange-500 pl-4">
            <Text className="font-display text-xl italic leading-8 text-text">{quote}</Text>
          </View>
        ) : null}
      </View>
    </Section>
  );
}

/** The Story page: the Clean City Legacy through the return of the Mons. */
export function StoryPage() {
  const copy = STORY_COPY;
  return (
    <View className="w-full flex-1 bg-bg">
      {/* Hero — "We killed them." */}
      <Section aria-labelledby="story-title" data-testid="story-hero" className={sectionClass}>
        <View className="max-w-3xl gap-4">
          <Eyebrow>{copy.hero.eyebrow}</Eyebrow>
          <Heading level={1} id="story-title" className="my-0 font-display text-4xl leading-tight text-text md:text-6xl">
            {copy.hero.title}
          </Heading>
          <Paragraph className={bodyClass}>{copy.hero.body}</Paragraph>
        </View>
      </Section>

      <Chapter
        testID="story-clean-city" id="story-clean-city-title"
        eyebrow={copy.cleanCity.eyebrow} title={copy.cleanCity.title} body={copy.cleanCity.body}
      />
      <Chapter
        testID="story-project-zero" id="story-project-zero-title"
        eyebrow={copy.projectZero.eyebrow} title={copy.projectZero.title}
        body={copy.projectZero.body} quote={copy.projectZero.quote}
      />
      <Chapter
        testID="story-vale" id="story-vale-title"
        eyebrow={copy.vale.eyebrow} title={copy.vale.title} body={copy.vale.body}
      />
      <Chapter
        testID="story-extinction" id="story-extinction-title"
        eyebrow={copy.extinction.eyebrow} title={copy.extinction.title} body={copy.extinction.body}
      />

      {/* The five lineages as cards. */}
      <Section aria-labelledby="story-cascade-title" data-testid="story-cascade" className={sectionClass}>
        <SectionHead
          eyebrow={copy.cascade.eyebrow} title={copy.cascade.title}
          body={copy.cascade.body} id="story-cascade-title"
        />
        <List aria-label={copy.cascade.title} className="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {copy.cascade.lineages.map((lineage, i) => (
            <ListItem key={lineage.name}>
              <SolidPanel surface="page" depth="md" className="h-full gap-3 overflow-hidden px-5 py-6">
                <View className={`-mx-5 -mt-6 mb-2 h-1.5 ${CARD_ACCENTS[i % CARD_ACCENTS.length]}`} aria-hidden />
                <Article className="gap-3">
                  <Heading level={3} className="my-0 font-display text-2xl leading-tight text-text">
                    {lineage.name}
                  </Heading>
                  <Paragraph className="my-0 text-base leading-7 text-text-secondary">{lineage.line}</Paragraph>
                </Article>
              </SolidPanel>
            </ListItem>
          ))}
        </List>
      </Section>

      <Chapter
        testID="story-returned" id="story-returned-title"
        eyebrow={copy.returned.eyebrow} title={copy.returned.title}
        body={copy.returned.body} quote={copy.returned.quote}
      />

      {/* EngineX's three eras. */}
      <Section aria-labelledby="story-enginex-title" data-testid="story-enginex" className={sectionClass}>
        <SectionHead
          eyebrow={copy.enginex.eyebrow} title={copy.enginex.title} id="story-enginex-title"
        />
        <List className="m-0 list-none gap-6 p-0 md:flex-row">
          {copy.enginex.eras.map((era, i) => (
            <ListItem key={era.era} className="flex-1">
              <SolidPanel surface="page" depth="md" className="h-full gap-3 overflow-hidden px-5 py-6">
                <View className={`-mx-5 -mt-6 mb-2 h-1.5 ${CARD_ACCENTS[i % CARD_ACCENTS.length]}`} aria-hidden />
                <Heading level={3} className="my-0 font-display text-xl leading-tight text-text">{era.era}</Heading>
                <Paragraph className="my-0 text-base leading-7 text-text-secondary">{era.line}</Paragraph>
              </SolidPanel>
            </ListItem>
          ))}
        </List>
        <View className="max-w-3xl">
          <Paragraph className={bodyClass}>{copy.enginex.body}</Paragraph>
        </View>
      </Section>

      {/* Outro band — dark, like /how-it-works. */}
      <Section data-testid="story-outro" className="w-full bg-ink-950">
        <View className="mx-auto w-full max-w-screen-xl gap-6 px-4 py-16 sm:px-6 md:py-20 lg:px-8">
          <View className="h-1 w-10 bg-orange-500" aria-hidden />
          <Heading level={2} className="my-0 font-display text-3xl leading-tight text-ink-50 md:text-4xl">
            {copy.footer.title}
          </Heading>
          <Text className="text-ink-300">{copy.footer.body}</Text>
          <LinkButton title={copy.footer.cta.label} href={copy.footer.cta.href} variant="cta" size="lg" testID="story-cta" />
        </View>
      </Section>
    </View>
  );
}
