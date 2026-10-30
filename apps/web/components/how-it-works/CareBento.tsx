import { Heading, List, ListItem, Paragraph, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { ArtTile } from './ArtTile';
import { howCopy } from './cms';
import { sectionFor } from '@acme/content/site-content';
import type { PageProps } from '../cms/PageContent';
import { routeArtFor } from '../cms/route-art';
import { breakpoints } from '@acme/theme';

type CareItem = ReturnType<typeof howCopy>['care']['items'][number];

/** Per meter: the filled lot (700 step, 3:1 on the daylight surface, as on home) and the tile's top keyline. */
const TONE = {
  orange: { lot: 'border-orange-700 bg-orange-700', bar: 'bg-orange-500' },
  royal: { lot: 'border-royal-700 bg-royal-700', bar: 'bg-royal-500' },
  leaf: { lot: 'border-leaf-700 bg-leaf-700', bar: 'bg-leaf-500' },
} as const satisfies Record<CareItem['color'], { lot: string; bar: string }>;

const LOTS = 10;

/**
 * A care meter as static markup, the home page's pattern: `role="meter"`
 * with an "example level" name, ten lots filled solid up to the level and
 * hollow above it, so filled versus empty never depends on colour. No
 * percentage on screen and nothing counts up.
 */
function Meter({ item, page }: { item: CareItem } & PageProps) {
  const W04_COPY = howCopy(page);
  const { babyArt, photoArt } = routeArtFor(sectionFor(page, 'journey'), 'care');
  const filled = Math.round((item.value / 100) * LOTS);
  return (
    <View className="gap-2">
      <Text aria-hidden className="text-sm font-semibold text-text">
        {item.meter}
      </Text>
      <View
        role="meter"
        aria-label={W04_COPY.care.meterLabel(item.meter)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={item.value}
        aria-valuetext={`${item.value}%`}
        className="h-5 w-full flex-row gap-1"
      >
        {Array.from({ length: LOTS }, (_, i) => (
          <View
            key={i}
            aria-hidden
            className={`h-full flex-1 border-2 ${i < filled ? TONE[item.color].lot : 'border-ink-950 bg-transparent'}`}
          />
        ))}
      </View>
    </View>
  );
}

function CareTile({ item, index, page }: { item: CareItem; index: number } & PageProps) {
  const W04_COPY = howCopy(page);
  const { babyArt, photoArt } = routeArtFor(sectionFor(page, 'journey'), 'care');
  const copy = W04_COPY.care;
  return (
    <ListItem
      id={`mfx-hiw-care-${index + 1}`}
      className="min-w-0 gap-5 border-2 border-ink-950 bg-surface-raised"
    >
      <View aria-hidden className={`h-2 w-full ${TONE[item.color].bar}`} />
      <View className="flex-1 justify-between gap-6 px-5 pb-6 md:px-6">
        <View className="gap-3">
          <Heading level={3} className="my-0 font-display text-display-md uppercase leading-display text-text lg:text-display-sm lg:leading-display xl:text-display-md xl:leading-display">
            {item.verb}
          </Heading>
          <Paragraph className="my-0 text-base leading-6 text-text">
            <Text className="font-semibold">{copy.cueLabel}: </Text>
            {item.cue}
          </Paragraph>
          <Paragraph className="my-0 text-base leading-6 text-text-secondary">
            <Text className="font-semibold text-text">{copy.answerLabel}: </Text>
            {item.answer}
          </Paragraph>
        </View>
        <Meter page={page} item={item} />
      </View>
    </ListItem>
  );
}

/**
 * Stop 05's bento (PS-021 copy, one source with home). From `lg`: a tall
 * Baby poster over two rows on the left; beside it the section line on a
 * wide night plate, then Feed, Rest and Play as three tiles under it; the
 * closing line runs under all of it as a full-width signage strip. Below `lg` it
 * stacks in DOM order. The meters are labelled as example levels.
 */
export function CareBento({ page }: PageProps) {
  const W04_COPY = howCopy(page);
  const { babyArt, photoArt } = routeArtFor(sectionFor(page, 'journey'), 'care');
  const copy = W04_COPY.care;
  return (
    <View className="gap-4 md:gap-5">
      <View className="gap-4 md:grid md:grid-cols-2 md:gap-5 lg:grid-cols-12">
        <ArtTile
          id="mfx-hiw-care-0"
          art={babyArt(2, `(min-width: ${breakpoints.lg}) 26rem, (min-width: ${breakpoints.md}) 50vw, 100vw`)}
          frame="aspect-[4/5] border-2 border-ink-950 md:aspect-auto md:min-h-80 lg:col-span-4 lg:row-span-2 lg:row-start-1"
        />
        <View
          id="mfx-hiw-care-head"
          className="scheme-dark justify-end gap-3 bg-ink-950 px-5 py-6 md:px-8 md:py-8 lg:col-span-8 lg:col-start-5 lg:row-start-1"
        >
          <View aria-hidden className="h-1 w-10 bg-orange-500" />
          <Paragraph className="my-0 font-display text-display-sm uppercase leading-heading text-ink-50 lg:text-display-md lg:leading-heading">{copy.title}</Paragraph>
          <Paragraph className="my-0 max-w-content-measure text-base leading-7 text-silver-300 md:text-lg md:leading-8">{copy.body}</Paragraph>
        </View>
        <List className="m-0 list-none gap-4 p-0 md:col-span-2 md:grid md:grid-cols-3 md:gap-5 lg:col-span-8 lg:col-start-5 lg:row-start-2">
          {copy.items.map((item, i) => (
            <CareTile page={page} key={item.verb} item={item} index={i} />
          ))}
        </List>
      </View>
      <View
        id="mfx-hiw-care-4"
        className="gap-2 bg-signage-black px-5 py-5 md:flex-row md:items-baseline md:justify-between md:gap-8 md:px-6"
      >
        <Paragraph className="my-0 font-display text-lg uppercase leading-heading text-signage-white md:text-xl">
          {copy.closing}
        </Paragraph>
        <Paragraph className="my-0 shrink-0 text-sm text-silver-200">{copy.example}</Paragraph>
      </View>
    </View>
  );
}
