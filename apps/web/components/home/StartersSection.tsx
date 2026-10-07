import { bloodlineLabel, eggs, starterBloodlines } from '@acme/content';
import { Badge, Image, type ImageProps } from '@acme/ui';
import { Article, Heading, List, ListItem, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { art, starterSlot, type StarterId } from './art';
import { Eyebrow } from './Eyebrow';
import { W01_COPY } from './copy';

export interface StarterCard {
  key: string;
  slot: StarterId;
  babyName: string;
  dexId: number;
  bloodline: string;
  eggName: string;
}

/** The three starters from @acme/content: Baby name, its Bloodline, the egg it hatches from. Nothing past Baby. */
export function starterCards(): StarterCard[] {
  return starterBloodlines.map(({ slot, bloodline }, i) => {
    const baby = bloodline.chain.evolvesTo[0];
    const egg = eggs[i];
    if (!baby || baby.formName === null || baby.dexId === null || !egg) {
      throw new Error(`${bloodline.bloodlineId} has no Baby form or egg in @acme/content`);
    }
    return { key: bloodline.bloodlineId, slot, babyName: baby.formName, dexId: baby.dexId, bloodline: bloodlineLabel(bloodline), eggName: egg.eggName };
  });
}

/**
 * The starters as character introductions (W01 §04.E): each card is mostly
 * a large framed art plate — a district scene standing in for the Baby Mon
 * render (the `starter.<slot>` art slots in ./art.ts) — with its identity plate below.
 * `mfx-starter-*` marks the staggered first entrance authored in ./motion.ts.
 */
export function StartersSection({ cards }: { cards: readonly StarterCard[] }) {
  const copy = W01_COPY.starters;
  return (
    <Section
      aria-labelledby="w01-starters-title"
      data-testid="w01-starters"
      id="trg-starters"
      className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:py-28 lg:px-8"
    >
      <View id="mfx-starters-head" className="max-w-2xl gap-4">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <Heading
          level={2}
          id="w01-starters-title"
          className="my-0 font-display text-3xl uppercase leading-heading tracking-tight text-text md:text-5xl"
        >
          {copy.title}
        </Heading>
        <Paragraph className="my-0 text-base leading-7 text-text-secondary md:text-lg md:leading-8">{copy.body}</Paragraph>
      </View>
      <List className="m-0 list-none gap-6 p-0 md:flex-row md:items-stretch">
        {cards.map((card, i) => {
          const plate = art(starterSlot(card.slot));
          return (
            <ListItem
              key={card.key}
              id={`mfx-starter-${i}`}
              className="group min-w-0 flex-1 transition-transform duration-base hover:-translate-y-1"
            >
              <Article className="h-full gap-0 overflow-hidden border-2 border-ink-950 bg-surface-raised">
                <View className="overflow-hidden">
                  <Image
                    src={plate.src as ImageProps['src']}
                    alt={plate.alt}
                    fill
                    district={plate.district}
                    sizes={plate.sizes}
                    loading="lazy"
                    unoptimized
                    placeholder="blur"
                    blurDataURL={plate.blurDataURL}
                    className="aspect-[4/5] w-full transition-transform duration-slow group-hover:scale-page-hover md:aspect-[3/4]"
                  />
                </View>
                <View className="gap-2 border-t-2 border-ink-950 bg-surface-raised px-5 py-4">
                  <Badge label={copy.dex(card.dexId)} tone="neutral" size="sm" />
                  <Heading level={3} className="my-0 font-display text-2xl uppercase leading-tight text-text">
                    {card.babyName}
                  </Heading>
                  <Paragraph className="my-0 text-base font-semibold text-text-secondary">{card.bloodline}</Paragraph>
                  <Paragraph className="my-0 text-sm text-text-muted">{copy.hatchesFrom(card.eggName)}</Paragraph>
                </View>
              </Article>
            </ListItem>
          );
        })}
      </List>
    </Section>
  );
}
