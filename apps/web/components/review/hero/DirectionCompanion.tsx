import { creatureArt } from '@acme/assets/creatures';
import { Image, LinkButton, type ImageProps } from '@acme/ui';
import { Figcaption, Figure, Heading, List, ListItem, Paragraph, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { art, starterSlot, type StarterId } from '../../home/art';
import { W01_COPY } from '../../home/copy';
import { starterCards } from '../../home/StartersSection';
import { COMPANION_COPY, REVIEW_COPY } from './copy';
import { ConceptArtTag, HERO_GUTTERS, HERO_SURFACE, type HeadlineLevel } from './parts';

/** The egg concept art per starter slot (PS-028 bundles it for the egg choice; Decision #9 names). */
const EGG_ART: Record<StarterId, string> = { 1: 'metro-egg', 2: 'corner-egg', 3: 'prism-egg' };

/**
 * Direction B, companion-first (PROPOSED copy). The headline states the
 * two-way choice: the Caller picks an egg, and at the hatch the Mon chooses
 * too (Decision #14; never a rejection). The art is the relationship, not the
 * hardware: Squeaklet (concept art) with one ask-and-answer exchange taken
 * from the approved CARE copy, so the visitor sees what they will do. The
 * three eggs (Decision #5) sit under the CTA as the choice.
 *
 * Plain black display type on concrete, no plates, so the two sentences read
 * as a call and response. DOM (= phone) order: headline, support line, art,
 * CTA, eggs.
 */
export function DirectionCompanion({ level = 1 }: { level?: HeadlineLevel }) {
  const cards = starterCards();
  const first = cards[0];
  if (!first) throw new Error('@acme/content has no starter in slot 1');
  const baby = art(starterSlot(first.slot));
  const exchange = W01_COPY.care.items[0];
  const titleId = 'review-b-title';
  const eggsId = 'review-b-eggs';

  return (
    <View className={HERO_SURFACE} testID="review-hero-b">
      <View
        className={`${HERO_GUTTERS} gap-5 pb-10 pt-6 md:gap-6 md:py-12 lg:grid lg:grid-cols-12 lg:grid-rows-[1fr_auto_auto_auto_auto_1fr] lg:gap-x-10 lg:gap-y-6 lg:py-14`}
      >
        <Heading
          level={level}
          id={titleId}
          className="my-0 flex flex-col items-start gap-1 font-display text-display-md uppercase leading-display text-signage-black sm:text-display-lg lg:col-span-7 lg:row-start-2 lg:text-display-lg xl:text-display-xl"
        >
          {COMPANION_COPY.titleLines.map((line, i) => (
            <Text key={line} className="block font-display">
              {i < COMPANION_COPY.titleLines.length - 1 ? `${line} ` : line}
            </Text>
          ))}
        </Heading>

        <Paragraph className="my-0 max-w-content-measure text-base leading-7 text-signage-black md:text-lg md:leading-8 lg:col-span-7 lg:row-start-3">
          {COMPANION_COPY.body}
        </Paragraph>

        <Figure className="relative m-0 min-w-0 lg:col-span-5 lg:col-start-8 lg:row-span-6 lg:row-start-1 lg:self-center">
          <View className="relative w-full">
            <Image
              src={baby.src as ImageProps['src']}
              alt={baby.alt}
              fill
              priority
              loading="eager"
              sizes="(min-width: 1024px) 30rem, 92vw"
              placeholder="blur"
              blurDataURL={baby.blurDataURL}
              contentPosition={{ left: '50%', top: '25%' }}
              className="h-64 w-full sm:h-80 lg:aspect-[4/5] lg:h-auto"
            />
            <ConceptArtTag className="left-2 top-2" />
          </View>
          {/* The exchange is the figure's caption: what the picture is about, in the CARE section's words. */}
          <Figcaption className="absolute bottom-4 left-3 right-4 m-0 flex flex-col gap-2 lg:bottom-8 lg:left-6 lg:right-10">
            <View className="max-w-[85%] self-start border-2 border-signage-black bg-signage-black px-3 py-2">
              <Text className="text-xs font-bold uppercase tracking-wide text-silver-300">{COMPANION_COPY.monLabel}</Text>
              <Text className="text-sm font-semibold text-signage-white md:text-base">{exchange.cue}</Text>
            </View>
            <View className="max-w-[85%] self-end border-2 border-signage-black bg-signage-white px-3 py-2">
              <Text className="text-xs font-bold uppercase tracking-wide text-concrete-700">{COMPANION_COPY.youLabel}</Text>
              <Text className="text-sm font-semibold text-signage-black md:text-base">{exchange.answer}</Text>
            </View>
          </Figcaption>
        </Figure>

        <View className="w-full items-start lg:col-span-7 lg:row-start-4">
          <LinkButton title={W01_COPY.hero.cta} href={W01_COPY.hero.ctaHref} variant="cta" size="lg" />
        </View>

        <View className="gap-2 lg:col-span-7 lg:row-start-5">
          <View className="flex-row items-center gap-2">
            <Text {...({ id: eggsId } as object)} className="text-sm font-semibold text-signage-black">
              {COMPANION_COPY.choiceLabel}
            </Text>
            <Text className="bg-signage-white px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-signage-black">
              {REVIEW_COPY.conceptArt}
            </Text>
          </View>
          <List aria-labelledby={eggsId} className="m-0 list-none flex-row gap-3 p-0">
            {cards.map((card) => {
              const egg = creatureArt(EGG_ART[card.slot]);
              return (
                <ListItem key={card.key} className="min-w-0 flex-1 gap-1.5 sm:max-w-32">
                  <Image
                    src={egg.source as ImageProps['src']}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 8rem, 30vw"
                    placeholder="blur"
                    blurDataURL={egg.blurDataURL}
                    contentPosition={{ left: '50%', top: '55%' }}
                    className="aspect-square w-full"
                  />
                  <Text className="text-sm font-semibold text-signage-black">{card.eggName}</Text>
                </ListItem>
              );
            })}
          </List>
        </View>
      </View>
    </View>
  );
}
