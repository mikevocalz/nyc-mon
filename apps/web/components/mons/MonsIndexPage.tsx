import { Link } from 'solito/link';
import { Card, type CardProps, type ControlTone } from '@acme/ui';
import { Heading, List, ListItem, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { Eyebrow } from '../home/Eyebrow';
import { W02_COPY } from './copy';
import { monsStarters } from './starters';

/**
 * One kit tone per starter slot, the same order the old accent bars used
 * (orange, royal, leaf). The notch face is the tone, so the bar is gone and
 * the text takes Card's on-face step: ink on orange 7.76:1, white on royal
 * 5.60:1, ink on leaf 7.09:1 (PS-034).
 */
const CARD_TONES: readonly ControlTone[] = ['orange', 'royal', 'leaf'];

/** Notches alternate top, bottom, top so the row reads as three cards, not one strip. */
type NotchSides = NonNullable<CardProps['notchSides']>;
const notchFor = (i: number): NotchSides => (i % 2 === 0 ? ['top'] : ['bottom']);

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
          {starters.map((starter, i) => {
            const notchSides = notchFor(i);
            return (
              <ListItem key={starter.slug} className="flex-1">
                <Link
                  href={copy.cardHref(starter.slug)}
                  aria-label={copy.cardLabel(starter.babyName)}
                  className="block h-full no-underline transition-transform duration-200 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  {/* Card pads the top for a top notch; a bottom notch gets the same room here. */}
                  <Card
                    variant="notch"
                    tone={CARD_TONES[i % CARD_TONES.length]}
                    notchSides={notchSides}
                    className={`gap-3 ${notchSides.includes('bottom') ? 'pb-7 md:pb-8' : ''}`}
                  >
                    <Paragraph className="my-0 text-sm font-semibold tracking-wide text-text">{copy.dex(starter.dexId)}</Paragraph>
                    <Heading level={2} className="my-0 font-display text-2xl leading-tight text-text">
                      {starter.babyName}
                    </Heading>
                    <Paragraph className="my-0 text-base font-semibold text-text">{starter.bloodline}</Paragraph>
                    <Paragraph className="my-0 text-sm text-text">{copy.hatchesFrom(starter.eggName)}</Paragraph>
                  </Card>
                </Link>
              </ListItem>
            );
          })}
        </List>
      </Section>
    </View>
  );
}
