import { Link } from 'solito/link';
import { Badge, SolidPanel } from '@acme/ui';
import { Article, Heading, List, ListItem, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { Eyebrow } from '../home/Eyebrow';
import { W02_COPY } from './copy';
import { monsStarters } from './starters';

/** Bloodline accent bars, one brand colour per starter slot (as W01). */
const CARD_ACCENTS = ['bg-orange-500', 'bg-royal-500', 'bg-leaf-500'] as const;

/** W02 index: the three starters, each card linking to its /mons/[slug] page. */
export function MonsIndexPage() {
  const copy = W02_COPY.index;
  const starters = monsStarters();
  return (
    <View className="w-full flex-1 bg-bg">
      <Section
        aria-labelledby="w02-mons-title"
        data-testid="w02-mons"
        className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:px-8"
      >
        <View className="max-w-2xl gap-4">
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <Heading level={1} id="w02-mons-title" className="my-0 font-display text-3xl leading-tight text-text md:text-4xl">
            {copy.title}
          </Heading>
          <Paragraph className="my-0 text-base leading-7 text-text-secondary md:text-lg md:leading-8">{copy.body}</Paragraph>
        </View>
        <List className="m-0 list-none gap-6 p-0 md:flex-row">
          {starters.map((starter, i) => (
            <ListItem key={starter.slug} className="flex-1">
              <Link
                href={copy.cardHref(starter.slug)}
                aria-label={copy.cardLabel(starter.babyName)}
                className="block h-full no-underline transition-transform duration-200 hover:-translate-y-1"
              >
                <SolidPanel surface="page" depth="md" className="h-full gap-3 overflow-hidden px-5 py-6">
                  <View className={`-mx-5 -mt-6 mb-2 h-1.5 ${CARD_ACCENTS[i % CARD_ACCENTS.length]}`} aria-hidden />
                  <Article className="gap-3">
                    <Badge label={copy.dex(starter.dexId)} tone="neutral" size="sm" />
                    <Heading level={2} className="my-0 font-display text-2xl leading-tight text-text">
                      {starter.babyName}
                    </Heading>
                    <Paragraph className="my-0 text-base font-semibold text-text-secondary">{starter.bloodline}</Paragraph>
                    <Paragraph className="my-0 text-sm text-text-muted">{copy.hatchesFrom(starter.eggName)}</Paragraph>
                  </Article>
                </SolidPanel>
              </Link>
            </ListItem>
          ))}
        </List>
      </Section>
    </View>
  );
}
