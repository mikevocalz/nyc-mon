import { breakpoints } from '@acme/theme';
import { DISTRICT_TONE, Image, LinkButton, SkylineDivider, TONE_CLASSES, type ImageProps } from '@acme/ui';
import { Article, Heading, List, ListItem, Paragraph, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { DISTRICT_COPY, HOME_COPY } from '@acme/spatial/copy';
import { creatureArt } from '@acme/assets/creatures';
import { W01_COPY } from '../home/copy';
import { Eyebrow } from '../home/Eyebrow';
import { HeroCity, HeroDistrictPicker } from '../home/HeroDistrictIsland';
import { WAITLIST_CTA } from '../site/nav';
import { placePhoto } from '../story/editorial';
import { PhotoFrame, SignageHeadline } from '../story/EditorialKit';
import { BOARD_PHOTO, BOARD_ROUTE } from './board';
import { CityMotion } from './CityMotion';
import { StreetGridBand } from './StreetGridBand';
import { W03_COPY } from './copy';

const MD_UP = `(min-width: ${breakpoints.md})`;
const LG_UP = `(min-width: ${breakpoints.lg})`;
const XL_UP = `(min-width: ${breakpoints.xl})`;
const cols = (n: number) => `${XL_UP} ${Math.round((80 * n) / 12)}rem, ${MD_UP} ${Math.round((100 * n) / 12)}vw, 100vw`;

const shell = 'mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8';
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * HERO: the live district city behind the page title (the home hero's
 * canvas island, reused), the title on two signage plates, and a big "04"
 * tile naming the four districts. The picker changes the city behind it.
 */
function CityHero() {
  const copy = W03_COPY.districts;
  return (
    <HeroCity id="city-hero" labelledBy="w03-districts-title" className="lg:min-h-hero-wide">
      <View
        data-testid="w03-hero"
        className={`${shell} flex-1 gap-10 pb-16 pt-10 md:py-16 lg:grid lg:grid-cols-12 lg:content-center lg:items-center lg:gap-x-8 lg:py-20`}
      >
        <View className="min-w-0 items-start gap-6 lg:col-span-8">
          <View id="mfx-hero-title" className="items-start gap-4">
            <View className="bg-signage-black px-3 py-2">
              <Eyebrow night>{copy.eyebrow}</Eyebrow>
            </View>
            <SignageHeadline title={copy.title} level={1} id="w03-districts-title" tone="plate" size="hero" />
          </View>
          <Paragraph
            id="mfx-hero-body"
            className="my-0 max-w-content-measure border-l-4 border-orange-500 bg-surface-raised px-4 py-3 text-base leading-7 text-text md:text-lg md:leading-8"
          >
            {copy.body}
          </Paragraph>
          <View className="w-full max-w-xl">
            <HeroDistrictPicker label={W01_COPY.hero.districtLabel} />
          </View>
        </View>

        <View id="mfx-hero-art" aria-hidden className="relative min-w-0 lg:col-span-4">
          <View aria-hidden className="absolute -bottom-3 -right-3 left-3 top-3 bg-orange-500" />
          <View className="relative items-start gap-4 bg-signage-black p-6 md:p-8">
            <Text className="font-display text-[7rem] leading-none text-signage-white md:text-[10rem]">
              {String(BOARD_ROUTE.length).padStart(2, '0')}
            </Text>
            <Text className="font-display text-2xl uppercase leading-heading text-orange-500">{copy.listLabel}</Text>
            <View className="flex-row gap-2">
              {BOARD_ROUTE.map((d) => (
                <View key={d} className={`h-5 w-5 rounded-full ${TONE_CLASSES[DISTRICT_TONE[d]].face}`} />
              ))}
            </View>
          </View>
        </View>
      </View>
    </HeroCity>
  );
}

/**
 * THE DISTRICT BOARD: the four districts as one transit departures board,
 * north to south. Each stop is a tone disc on the route line, the district
 * name at display size on a signage plate, its line and cross streets, and a
 * photograph of its own corner. Photographs alternate sides down the board.
 * Motion: the discs light and the names flip down in route order
 * (CityMotionRoot.tsx).
 */
function DistrictBoard() {
  const copy = W03_COPY.districts;
  return (
    <Section data-testid="w03-districts" id="trg-board" className="w-full bg-ink-950">
      <View aria-hidden className="h-1 w-full bg-orange-500" />
      <View className={`${shell} py-16 md:py-24`}>
        <List aria-label={copy.listLabel} className="m-0 list-none p-0">
          {BOARD_ROUTE.map((district, i) => {
            const d = DISTRICT_COPY[district];
            const tone = TONE_CLASSES[DISTRICT_TONE[district]];
            const pic = BOARD_PHOTO[district];
            const photo = placePhoto(pic.id, cols(5), pic.focal);
            const last = i === BOARD_ROUTE.length - 1;
            const flip = i % 2 === 1;
            return (
              <ListItem key={district} className="relative flex-row gap-4 pb-14 md:gap-8 md:pb-20 lg:pb-24">
                {/* The route line runs down the left gutter, disc to disc; it stops at the last stop. */}
                {last ? null : <View aria-hidden className="absolute bottom-0 left-5 top-6 w-1.5 bg-silver-500 md:left-7" />}
                <View id={`mpx-board-disc-${i}`} aria-hidden className={`relative h-11 w-11 shrink-0 rounded-full border-4 border-ink-950 md:h-16 md:w-16 ${tone.face}`} />
                <Article className="min-w-0 flex-1 gap-6 lg:grid lg:grid-cols-12 lg:gap-x-8">
                  <View className={`min-w-0 gap-5 lg:col-span-7 ${flip ? 'lg:col-start-6 lg:row-start-1' : ''}`}>
                    <Text aria-hidden className={`text-type-tag font-extrabold uppercase ${tone.text}`}>
                      {`${String(i + 1).padStart(2, '0')} / ${String(BOARD_ROUTE.length).padStart(2, '0')}`}
                    </Text>
                    <View id={`mpx-board-name-${i}`} className="items-start">
                      <Heading
                        level={2}
                        className="my-0 w-fit max-w-full bg-signage-black px-3 pb-1.5 pt-2.5 font-display text-display-sm uppercase leading-display text-signage-white sm:text-display-md sm:leading-display md:px-5 md:text-display-xl md:leading-display xl:text-[5rem] xl:leading-display"
                      >
                        {d.name}
                      </Heading>
                      <View aria-hidden className={`h-2 w-full ${tone.face}`} />
                    </View>
                    <Paragraph id={`mfx-board-line-${i}`} className="my-0 max-w-content-measure font-display text-xl uppercase leading-heading text-ink-50 md:text-2xl lg:text-3xl">
                      {d.line}
                    </Paragraph>
                    {d.streets ? (
                      <Text className="w-fit border-2 border-silver-500 px-3 py-1.5 text-sm font-semibold text-silver-100">{d.streets}</Text>
                    ) : null}
                  </View>
                  <PhotoFrame
                    entry={photo}
                    driftId={`mpx-board-${district}-drift`}
                    className={`aspect-[3/2] border-2 border-silver-500 lg:col-span-5 lg:aspect-[4/3] lg:self-center ${flip ? 'lg:col-start-1 lg:row-start-1' : ''}`}
                  />
                </Article>
              </ListItem>
            );
          })}
        </List>
      </View>
    </Section>
  );
}

/** Hood Mons tile art: a Baby form loose on a Times Square sidewalk (PS-028 concept art). */
const HOOD_ART = creatureArt('yotito');
const STREET = placePhoto('midtown-times-square', cols(6), { x: 0.5, y: 0.5 });
const WATER = placePhoto('downtown-one-wtc', cols(3), { x: 0.5, y: 0.35 });

/**
 * THE CAST, as a bento: a big orange head tile, then Callers, Hood Mons and
 * the H-Lynk as tiles of different sizes and faces (a render of the H-Lynk
 * Core, a starter Baby on the street), broken by a district count tile and
 * two place photographs. One column in DOM order below `lg`.
 */
function CastBento() {
  const cast = W03_COPY.cast;
  const [callers, hood, hlynk] = cast.items;
  return (
    <Section aria-labelledby="w03-cast-title" data-testid="w03-cast" id="trg-cast" className="w-full bg-bg">
      <View className={`${shell} gap-4 py-16 md:py-24 lg:grid lg:grid-cols-12 lg:gap-4`}>
        <View id="mfx-cast-head" className="relative min-w-0 lg:col-span-5 lg:row-span-2 lg:row-start-1">
          <View className="h-full items-start justify-between gap-10 bg-orange-500 p-6 md:p-10">
            <View className="items-start gap-5">
              <Text className="text-type-tag font-extrabold uppercase text-ink-950">{cast.eyebrow}</Text>
              <SignageHeadline title={cast.title} level={2} id="w03-cast-title" tone="plate" />
            </View>
            <Paragraph className="my-0 max-w-content-measure text-lg font-semibold leading-8 text-ink-950 md:text-xl md:leading-9">{cast.body}</Paragraph>
          </View>
        </View>

        {callers ? (
          <View id="mfx-cast-callers" className="min-w-0 justify-end gap-6 bg-royal-500 p-6 md:p-8 lg:col-span-4 lg:row-start-1">
            <View className="gap-3">
              <Heading level={3} className="my-0 font-display text-display-sm uppercase leading-heading text-ink-50">{callers.title}</Heading>
              <Paragraph className="my-0 text-base font-semibold leading-7 text-ink-50">{callers.line}</Paragraph>
            </View>
          </View>
        ) : null}

        {hlynk ? (
          <View id="mfx-cast-hlynk" className="min-w-0 gap-4 bg-ink-950 p-6 md:p-8 lg:col-span-3 lg:row-span-2 lg:row-start-1">
            <View className="relative aspect-[4/5] w-full max-w-xs self-center">
              <Image
                src={`${BASE}/home/h-lynk-core-v2.png`}
                alt={W01_COPY.hlynk.caption}
                fill
                framed={false}
                sizes={`${LG_UP} 18rem, 80vw`}
                loading="lazy"
                className="h-full w-full"
              />
            </View>
            <Heading level={3} className="my-0 font-display text-display-sm uppercase leading-heading text-orange-500">{hlynk.title}</Heading>
            <Paragraph className="my-0 text-base leading-7 text-silver-200">{hlynk.line}</Paragraph>
          </View>
        ) : null}

        {hood ? (
          <View id="mfx-cast-hood" className="min-w-0 flex-row overflow-hidden bg-signage-black lg:col-span-4 lg:row-start-2">
            <View className="relative w-2/5 shrink-0">
              <Image
                src={HOOD_ART.source as ImageProps['src']}
                alt={HOOD_ART.alt}
                fill
                framed={false}
                sizes={`${LG_UP} 12rem, 40vw`}
                loading="lazy"
                contentPosition={{ left: '55%', top: '33%' }}
                className="h-full w-full"
              />
            </View>
            <View className="min-w-0 flex-1 justify-end gap-3 p-5 md:p-6">
              <Heading level={3} className="my-0 font-display text-display-sm uppercase leading-heading text-signage-white">{hood.title}</Heading>
              <Paragraph className="my-0 text-sm leading-6 text-silver-200 md:text-base md:leading-7">{hood.line}</Paragraph>
            </View>
          </View>
        ) : null}

        <View id="mfx-cast-count" aria-hidden className="min-w-0 justify-between gap-4 border-4 border-ink-950 bg-surface-raised p-6 md:p-8 lg:col-span-3 lg:row-start-3">
          <Text className="font-display text-[6rem] leading-none text-ink-950 md:text-[8rem]">{String(BOARD_ROUTE.length).padStart(2, '0')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {BOARD_ROUTE.map((d) => (
              <View key={d} className="flex-row items-center gap-1.5">
                <View className={`h-3 w-3 rounded-full ${TONE_CLASSES[DISTRICT_TONE[d]].face}`} />
                <Text className="text-sm font-bold uppercase text-text">{DISTRICT_COPY[d].name}</Text>
              </View>
            ))}
          </View>
        </View>
        <View id="mfx-cast-street" className="min-w-0 lg:col-span-6 lg:row-start-3">
          <PhotoFrame entry={STREET} driftId="mpx-cast-street-drift" className="aspect-[3/2] lg:aspect-auto lg:h-full lg:min-h-72" />
        </View>
        <View id="mfx-cast-water" className="min-w-0 lg:col-span-3 lg:row-start-3">
          <PhotoFrame entry={WATER} className="aspect-[3/2] lg:aspect-auto lg:h-full lg:min-h-72" />
        </View>
      </View>
    </Section>
  );
}

/** The close: the slogan on two plates over a Downtown skyline, and the one action. */
function CityOutro() {
  return (
    <Section aria-labelledby="w03-outro-title" data-testid="w03-outro" id="trg-outro" className="w-full bg-ink-950">
      <SkylineDivider district="downtown" seed={5} size="lg" still />
      <View className={`${shell} items-start gap-8 py-20 md:py-28`}>
        <View id="mfx-outro-head" className="items-start">
          <SignageHeadline title={HOME_COPY.tagline} level={2} id="w03-outro-title" tone="night" size="giant" />
        </View>
        <View id="mfx-outro-cta">
          <LinkButton title={WAITLIST_CTA.label} href={WAITLIST_CTA.href} variant="cta" size="lg" testID="w03-cta" />
        </View>
      </View>
    </Section>
  );
}

/**
 * W03, the product site's setting page, as a transit board: the live city
 * and the title, the four districts as a departures board, the street grid,
 * then who shares the streets as a bento. Server HTML; CityMotion binds the
 * Kinetrell beats and the board flip.
 */
export function CityPage() {
  return (
    <>
      <CityMotion />
      <View className="w-full flex-1 bg-bg">
        <CityHero />
        <DistrictBoard />
        <StreetGridBand />
        <CastBento />
        <CityOutro />
      </View>
    </>
  );
}
