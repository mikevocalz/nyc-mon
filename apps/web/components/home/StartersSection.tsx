import { bloodlineLabel, eggs, starterBloodlines } from '@acme/content';
import { Image, type ImageProps } from '@acme/ui';
import { Article, Figure, Heading, List, ListItem, Paragraph, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { artPosition, STARTER_SIZES, starterArt, type StarterId } from './art';
import { ComingSoonArt } from './ComingSoonArt';
import { Eyebrow } from './Eyebrow';
import { W01_COPY } from './copy';
import { sectionMarker } from './sections';
import { sectionImage, sectionText, type CmsSectionProps } from './cms';

export interface StarterCard {
  key: string;
  slot: StarterId;
  babyName: string;
  dexId: number;
  bloodline: string;
  eggName: string;
}

/**
 * The four starters from @acme/content: Baby name, its Dex number, its
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
 * One starter as a poster (PS-020): the art plate first (the Baby form,
 * PS-028; no place caption, because the picture is a Mon, not a street; a
 * Coming Soon plate where the Baby has no art yet), then the egg, the Dex
 * plate, the Baby name large, and the Bloodline on a ruled line. Nothing is
 * interactive, so nothing changes on hover. The poster is always a column:
 * one per row on phones, two per row from `md`, all four side by side from `xl`.
 * The website editor can replace the plate (slot `starter.N`) and the three
 * lines; without an edit the canon from @acme/content is shown.
 */
function StarterPoster({ card, index, cms }: { card: StarterCard; index: number } & CmsSectionProps) {
  const copy = W01_COPY.starters;
  const plate = sectionImage(cms, `starter.${card.slot}`, STARTER_SIZES) ?? starterArt(card.slot);
  const nameId = `w01-starter-${card.slot}`;
  return (
    <ListItem id={`mfx-starter-${index}`} className="min-w-0">
      <Article aria-labelledby={nameId} className="h-full gap-0 border-2 border-ink-950 bg-surface-raised">
        <Figure className="relative m-0 aspect-square w-full overflow-hidden bg-ink-900 md:aspect-[4/5]">
          {plate === null ? (
            <ComingSoonArt />
          ) : (
            <Image
              src={plate.src as ImageProps['src']}
              alt={plate.alt}
              fill
              framed={false}
              sizes={plate.sizes}
              loading="lazy"
              unoptimized={typeof plate.src === 'string' && plate.src.startsWith('https:')}
              placeholder={plate.blurDataURL ? 'blur' : 'empty'}
              blurDataURL={plate.blurDataURL}
              contentPosition={artPosition(plate)}
              className="h-full w-full"
            />
          )}
        </Figure>
        <View className="min-w-0 flex-1 justify-end gap-3 border-t-2 border-ink-950 px-5 pb-6 pt-5 md:px-6">
          <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2">
            <Text className="bg-ink-950 px-2.5 py-1 font-display text-sm text-signage-white">{copy.dex(card.dexId)}</Text>
            <Text className="text-sm font-semibold text-text-secondary">{sectionText(cms, `cards.${card.slot}.hatchesFrom`, copy.hatchesFrom(card.eggName))}</Text>
          </View>
          <Heading
            level={3}
            id={nameId}
            className="my-0 break-words font-display text-display-md uppercase leading-heading text-text md:text-display-lg md:leading-heading xl:text-display-sm xl:leading-heading"
          >
            {sectionText(cms, `cards.${card.slot}.name`, card.babyName)}
          </Heading>
          <Paragraph className="my-0 border-l-4 border-ink-950 pl-3 text-base font-semibold leading-6 text-text">
            {sectionText(cms, `cards.${card.slot}.bloodline`, card.bloodline)}
          </Paragraph>
        </View>
      </Article>
    </ListItem>
  );
}

/**
 * STARTERS (PS-020): four eggs on Dr. Santoro's table, introduced as
 * characters. Four posters in a row from `xl`, a two-by-two grid from `md`,
 * a single column on phones; DOM order is slot order at every width. The
 * posters are a list, so a screen reader hears "list, 4 items".
 * `mfx-starters-head` and `mfx-starter-0..3` are the entrance in ./motion.ts.
 */
export function StartersSection({ cards, cms }: { cards: readonly StarterCard[] } & CmsSectionProps) {
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
        <Eyebrow>{sectionText(cms, 'eyebrow', copy.eyebrow)}</Eyebrow>
        <Heading
          level={2}
          id="w01-starters-title"
          className="my-0 font-display text-display-md uppercase leading-heading text-text lg:text-display-lg lg:leading-heading xl:text-display-xl xl:leading-heading"
        >
          {sectionText(cms, 'title', copy.title)}
        </Heading>
        <Paragraph className="my-0 max-w-content-measure text-base leading-7 text-text-secondary md:text-lg md:leading-8">
          {sectionText(cms, 'body', copy.body(cards.map((card) => card.eggName)))}
        </Paragraph>
        <Paragraph className="my-0 max-w-content-measure border-l-4 border-ink-950 pl-4 text-base font-semibold leading-7 text-text">
          {sectionText(cms, 'body2', copy.body2)}
        </Paragraph>
      </View>
      <List className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, i) => (
          <StarterPoster key={card.key} card={card} index={i} cms={cms} />
        ))}
      </List>
    </Section>
  );
}
