import { bloodlineLabel, eggs, starterBloodlines } from '@acme/content';
import { Image, type ImageProps } from '@acme/ui';
import { Article, Figure, Heading, List, ListItem, Paragraph, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { art, artPosition, starterSlot, type StarterId } from './art';
import { Eyebrow } from './Eyebrow';
import { W01_COPY } from './copy';
import { PlaceCaption } from './PlaceCaption';
import { sectionMarker } from './sections';

export interface StarterCard {
  key: string;
  slot: StarterId;
  babyName: string;
  dexId: number;
  bloodline: string;
  eggName: string;
}

/**
 * The three starters from @acme/content: Baby name, its Dex number, its
 * Bloodline label and the egg it hatches from. Nothing past Baby is read, so
 * no Small, Mid or Max name can reach the page. The egg is matched by
 * BloodlineId, not by array position.
 */
export function starterCards(): StarterCard[] {
  return starterBloodlines.map(({ slot, bloodline }) => {
    const baby = bloodline.chain.evolvesTo[0];
    const egg = eggs.find((e) => e.bloodlineId === bloodline.bloodlineId);
    if (!baby || baby.formName === null || baby.dexId === null || !egg) {
      throw new Error(`${bloodline.bloodlineId} has no Baby form or egg in @acme/content`);
    }
    return { key: bloodline.bloodlineId, slot, babyName: baby.formName, dexId: baby.dexId, bloodline: bloodlineLabel(bloodline), eggName: egg.eggName };
  });
}

/**
 * One starter as a poster (PS-020): the art plate first, then the egg, the
 * Dex plate, the Baby name large, and the Bloodline on a ruled line. Nothing
 * is interactive, so nothing changes on hover. Below `md` the poster is a
 * column; from `md` to `lg` it lies on its side (art the left half); from `lg` the
 * three stand side by side.
 */
function StarterPoster({ card, index }: { card: StarterCard; index: number }) {
  const copy = W01_COPY.starters;
  const plate = art(starterSlot(card.slot));
  const nameId = `w01-starter-${card.slot}`;
  return (
    <ListItem id={`mfx-starter-${index}`} className="min-w-0 lg:flex-1">
      <Article
        aria-labelledby={nameId}
        className="h-full gap-0 border-2 border-ink-950 bg-surface-raised md:flex-row lg:flex-col"
      >
        <Figure className="relative m-0 aspect-square w-full overflow-hidden bg-ink-900 md:aspect-auto md:min-h-80 md:w-1/2 md:shrink-0 lg:aspect-[4/5] lg:min-h-0 lg:w-full">
          <Image
            src={plate.src as ImageProps['src']}
            alt={plate.alt}
            fill
            framed={false}
            sizes={plate.sizes}
            loading="lazy"
            unoptimized
            placeholder="blur"
            blurDataURL={plate.blurDataURL}
            contentPosition={artPosition(plate)}
            className="h-full w-full"
          />
          <PlaceCaption entry={plate} className="bottom-0 left-0" />
        </Figure>
        <View className="min-w-0 flex-1 gap-3 border-t-2 border-ink-950 px-5 pb-6 pt-5 md:justify-end md:border-l-2 md:border-t-0 md:px-7 lg:border-l-0 lg:border-t-2 lg:px-6">
          <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2">
            <Text className="bg-ink-950 px-2.5 py-1 font-display text-sm text-signage-white">{copy.dex(card.dexId)}</Text>
            <Text className="text-sm font-semibold text-text-secondary">{copy.hatchesFrom(card.eggName)}</Text>
          </View>
          <Heading
            level={3}
            id={nameId}
            className="my-0 break-words font-display text-display-md uppercase leading-heading text-text xl:text-display-lg xl:leading-heading"
          >
            {card.babyName}
          </Heading>
          <Paragraph className="my-0 border-l-4 border-ink-950 pl-3 text-base font-semibold leading-6 text-text">
            {card.bloodline}
          </Paragraph>
        </View>
      </Article>
    </ListItem>
  );
}

/**
 * STARTERS (PS-020): three eggs on Dr. Santoro's table, introduced as
 * characters. A poster triptych from `lg`, side-on posters from `md`, a
 * single column on phones; DOM order is slot order at every width. The
 * posters are a list, so a screen reader hears "list, 3 items".
 * `mfx-starters-head` and `mfx-starter-0..2` are the entrance in ./motion.ts.
 */
export function StartersSection({ cards }: { cards: readonly StarterCard[] }) {
  const copy = W01_COPY.starters;
  return (
    <Section
      {...sectionMarker('starters')}
      aria-labelledby="w01-starters-title"
      data-testid="w01-starters"
      id="trg-starters"
      className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:gap-12 md:py-24 lg:px-8"
    >
      <View id="mfx-starters-head" className="gap-5 lg:max-w-4xl">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <Heading
          level={2}
          id="w01-starters-title"
          className="my-0 font-display text-display-md uppercase leading-heading text-text lg:text-display-lg lg:leading-heading xl:text-display-xl xl:leading-heading"
        >
          {copy.title}
        </Heading>
        <Paragraph className="my-0 max-w-content-measure text-base leading-7 text-text-secondary md:text-lg md:leading-8">
          {copy.body(cards.map((card) => card.eggName))}
        </Paragraph>
        <Paragraph className="my-0 max-w-content-measure border-l-4 border-ink-950 pl-4 text-base font-semibold leading-7 text-text">
          {copy.body2}
        </Paragraph>
      </View>
      <List className="m-0 list-none gap-6 p-0 lg:flex-row lg:items-stretch">
        {cards.map((card, i) => (
          <StarterPoster key={card.key} card={card} index={i} />
        ))}
      </List>
    </Section>
  );
}
