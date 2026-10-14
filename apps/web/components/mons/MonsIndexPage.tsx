import { breakpoints } from '@acme/theme';
import { LinkButton, SkylineDivider, TONE_CLASSES } from '@acme/ui';
import { Article, Figure, Heading, Link, List, ListItem, Paragraph, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { Eyebrow } from '../home/Eyebrow';
import { hatchArt, monsArt } from './art';
import { W02_COPY } from './copy';
import { MonsMotion } from './MonsMotion';
import { ArtFill, ConceptCaption, DexChip, RouteDisc, StreetFigure, dexDigits } from './parts';
import { monsStarters, type MonsStarter } from './starters';

/**
 * Bento placement per roster row. Even rows put the portrait on the left,
 * odd rows mirror it, so the roster zig-zags down the page. Literal class
 * strings, so the stylesheet keeps every one of them.
 */
const ROW = [
  {
    portrait: 'lg:col-span-7 lg:col-start-1 lg:row-span-2 lg:row-start-1',
    numeral: 'left-0',
    sign: 'lg:col-span-5 lg:col-start-8 lg:row-start-1',
    pair: 'lg:col-span-5 lg:col-start-8 lg:row-start-2',
  },
  {
    portrait: 'lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1',
    numeral: 'right-0',
    sign: 'lg:col-span-5 lg:col-start-1 lg:row-start-1',
    pair: 'lg:col-span-5 lg:col-start-1 lg:row-start-2',
  },
] as const;

/** Display colour of a giant Dex numeral: the slot tone's face, decorative. */
// The giant Dex numerals use the 600 step: the 500 orange and leaf fall under 3:1 on light grounds.
const NUMERAL_TEXT = { orange: 'text-orange-600', royal: 'text-royal-500', leaf: 'text-leaf-600' } as Record<string, string>;

/**
 * One starter as a bento row (W02, after the Grail and Berd cards in
 * MOBBIN_2026-10_ADDENDUM.md): the Baby's portrait over seven columns and two
 * rows with its Dex number at poster size behind it, a signage tile with the
 * name, Bloodline and the link to the Mon's page, then the egg and the street
 * the concept art is set on, side by side. Phones read it as one column:
 * portrait, signage, egg and street.
 *
 * Motion (`trg-roster-<i>`): the portrait rises, the Dex number slides out
 * from behind it, then the tiles follow; the number drifts on desktop scroll.
 */
function RosterRow({ starter, index }: { starter: MonsStarter; index: number }) {
  const copy = W02_COPY.index;
  const a = monsArt(starter.slot);
  const place = ROW[index % 2]!;
  const nameId = `w02-roster-${starter.slug}`;
  const beat = `roster-${index}`;
  const t = TONE_CLASSES[a.tone];
  return (
    <ListItem id={`trg-${beat}`} className="w-full overflow-hidden py-10 md:py-14">
      <Article
        aria-labelledby={nameId}
        className="mx-auto w-full max-w-screen-xl gap-5 px-4 sm:px-6 md:gap-6 lg:grid lg:grid-cols-12 lg:gap-x-6 lg:gap-y-6 lg:px-8"
      >
        {/* Portrait with the giant Dex number behind it. */}
        <View className={`relative min-w-0 pt-20 sm:pt-28 lg:pt-36 ${place.portrait}`}>
          <View id={`mpx-${beat}-numeral-far`} aria-hidden className={`absolute top-0 ${place.numeral}`}>
            <Text
              id={`mfx-${beat}-dex`}
              className={`block font-display text-[8.5rem] leading-none sm:text-[12rem] lg:text-[15rem] xl:text-[17rem] ${NUMERAL_TEXT[a.tone]}`}
            >
              {dexDigits(starter.dexId)}
            </Text>
          </View>
          <Figure
            id={`mfx-${beat}-portrait`}
            className="relative m-0 aspect-[4/5] w-full overflow-hidden border-2 border-ink-950 bg-ink-900 sm:aspect-[5/4] lg:aspect-[6/5]"
          >
            <ArtFill entry={a.baby} />
            <ConceptCaption className={index % 2 === 0 ? 'bottom-0 right-0' : 'bottom-0 left-0'} />
          </Figure>
        </View>

        {/* Signage tile: Dex, name, Bloodline, the egg, the way in. */}
        <View id={`mfx-${beat}-sign`} className={`min-w-0 justify-between gap-6 bg-signage-black px-6 py-7 md:px-8 md:py-9 ${place.sign}`}>
          <View className="gap-4">
            <View className="flex-row flex-wrap items-center gap-3">
              <DexChip dexId={starter.dexId} tone={a.tone} />
              <Text className="text-sm font-semibold text-silver-200">{copy.hatchesFrom(starter.eggName)}</Text>
            </View>
            <Heading
              level={2}
              id={nameId}
              className="my-0 break-words font-display text-[2.5rem] uppercase leading-display text-signage-white sm:text-display-lg sm:leading-display xl:text-display-xl xl:leading-display"
            >
              {starter.babyName}
            </Heading>
            <View className="flex-row items-center gap-3 border-t-2 border-ink-700 pt-4">
              <RouteDisc tone={a.tone} />
              <Text className={`text-base font-semibold ${t.text}`}>{starter.bloodline}</Text>
            </View>
          </View>
          <LinkButton
            title={copy.cardLabel(starter.babyName)}
            href={copy.cardHref(starter.slug)}
            tone={a.tone}
            testID={`w02-roster-${starter.slug}-link`}
          />
        </View>

        {/* The egg and the street, side by side at every width. */}
        <View className={`min-w-0 flex-row gap-4 md:gap-6 ${place.pair}`}>
          <Figure
            id={`mfx-${beat}-egg`}
            className="relative m-0 aspect-[4/5] w-2/5 shrink-0 overflow-hidden border-2 border-ink-950 bg-ink-900"
          >
            <ArtFill entry={a.egg} />
            <ConceptCaption />
          </Figure>
          <View id={`mfx-${beat}-street`} className="min-w-0 flex-1">
            <StreetFigure entry={a.street} className="h-full w-full border-2 border-ink-950" />
          </View>
        </View>
      </Article>
    </ListItem>
  );
}

/**
 * W02 index: the roster. A night hero with the page title at poster size and
 * the egg waiting on its stoop, a still skyline, the three starters as
 * zig-zag bento rows on the daylit page, then a signage-black close with the
 * site's one call to action. Server HTML throughout; MonsMotion arms the
 * Kinetrell reveals after hydration.
 */
export function MonsIndexPage() {
  const copy = W02_COPY.index;
  const starters = monsStarters();
  const hero = hatchArt(`(min-width: ${breakpoints.lg}) 34rem, 100vw`);
  return (
    <>
      <MonsMotion />
      <View className="w-full flex-1 bg-bg">
        <Section
          aria-labelledby="w02-mons-title"
          data-testid="w02-mons"
          id="trg-hero"
          className="scheme-dark w-full overflow-hidden bg-ink-950"
        >
          <View className="mx-auto w-full max-w-screen-xl gap-10 px-4 pb-14 pt-12 sm:px-6 md:pb-20 md:pt-16 lg:grid lg:grid-cols-12 lg:items-center lg:gap-x-10 lg:px-8 lg:pb-24 lg:pt-20">
            <View className="min-w-0 gap-6 lg:col-span-7">
              <Eyebrow night>{copy.eyebrow}</Eyebrow>
              <Heading
                level={1}
                id="w02-mons-title"
                className="my-0 flex flex-col items-start font-display uppercase leading-display"
              >
                <Text id="mfx-hero-title-a" className="block bg-signage-black px-4 pb-1 pt-3 font-display text-display-xl leading-display text-signage-white md:text-display-2xl md:leading-display">
                  {`${copy.title.split(' ')[0]} `}
                </Text>
                <Text
                  id="mfx-hero-title-b"
                  className="ml-6 block font-display text-[4.75rem] leading-none text-orange-500 sm:ml-16 sm:text-[9rem] lg:text-[10rem] xl:text-[12rem]"
                >
                  {copy.title.split(' ').slice(1).join(' ')}
                </Text>
              </Heading>
              <Paragraph
                id="mfx-hero-body"
                className="my-0 max-w-content-measure border-l-4 border-orange-500 pl-4 text-base leading-7 text-silver-300 md:text-lg md:leading-8"
              >
                {copy.body}
              </Paragraph>
              <List id="mfx-hero-bullets" className="m-0 list-none flex-row flex-wrap gap-3 p-0">
                {starters.map((starter) => {
                  const tone = monsArt(starter.slot).tone;
                  return (
                    <ListItem key={starter.slug}>
                      <Link
                        href={copy.cardHref(starter.slug)}
                        aria-label={copy.cardLabel(starter.babyName)}
                        className="flex min-h-12 flex-row items-center gap-3 border-2 border-ink-700 bg-signage-black py-2 pl-2 pr-4 no-underline transition-colors duration-200 hover:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
                      >
                        <RouteDisc tone={tone} className="h-8 w-8" />
                        <Text className="font-display text-sm text-signage-white">{dexDigits(starter.dexId)}</Text>
                        <Text className="text-sm font-semibold text-silver-200">{starter.babyName}</Text>
                      </Link>
                    </ListItem>
                  );
                })}
              </List>
            </View>
            <Figure
              id="mfx-hero-art"
              className="relative m-0 aspect-[4/5] w-full min-w-0 overflow-hidden border-2 border-ink-800 bg-ink-900 sm:aspect-[3/2] lg:col-span-5 lg:aspect-[4/5]"
            >
              <ArtFill entry={hero} eager />
              <ConceptCaption className="right-0 top-0" />
            </Figure>
          </View>
        </Section>

        <SkylineDivider district="harlem" seed={11} size="lg" still />

        <List aria-label={copy.eyebrow} className="m-0 w-full list-none p-0 pb-6 pt-6 md:pt-10">
          {starters.map((starter, i) => (
            <RosterRow key={starter.slug} starter={starter} index={i} />
          ))}
        </List>

        <Section aria-labelledby="w02-mons-close" id="trg-close" className="w-full bg-signage-black">
          <View className="h-1 w-full bg-orange-500" aria-hidden />
          <View className="mx-auto w-full max-w-screen-xl gap-8 px-4 py-16 sm:px-6 md:flex-row md:items-end md:justify-between md:py-24 lg:px-8">
            <Heading
              level={2}
              id="w02-mons-close"
              className="my-0 max-w-3xl font-display text-display-md uppercase leading-heading text-signage-white md:text-display-xl md:leading-display"
            >
              <Text id="mfx-close-title" className="block font-display">
                {copy.closing}
              </Text>
            </Heading>
            <View id="mfx-close-cta">
              <LinkButton title={copy.cta.label} href={copy.cta.href} variant="cta" size="lg" testID="w02-mons-cta" />
            </View>
          </View>
        </Section>
      </View>
    </>
  );
}
