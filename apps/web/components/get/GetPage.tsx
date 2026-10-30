import { breakpoints } from '@acme/theme';
import { LinkButton, SkylineDivider } from '@acme/ui';
import { Heading, Link, List, ListItem, Paragraph, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { starterCards } from '../home/StartersSection';
import { ArtTile } from '../how-it-works/ArtTile';
import { eggArt, hatchNightArt, hlynkArt } from '../how-it-works/art';
import { WaitlistForm } from '../waitlist/WaitlistForm';
import { W05_COPY } from './copy';
import { GetMotion } from './GetMotion';
import { siteHref } from '../../lib/site-href';

const MD_UP = `(min-width: ${breakpoints.md})`;
const LG_UP = `(min-width: ${breakpoints.lg})`;

/** The two stores as signage plates: the name, then when. Text only; no store marks ship in the repo. */
function StoreBadges({ night = false }: { night?: boolean }) {
  const copy = W05_COPY.stores;
  return (
    <List aria-label={copy.label} className="m-0 list-none flex-row flex-wrap gap-3 p-0">
      {copy.badges.map((badge) => (
        <ListItem
          key={badge.name}
          className={`flex-row items-center gap-3 border-2 px-4 py-2.5 ${night ? 'border-silver-500 bg-ink-950' : 'border-ink-950 bg-signage-black'}`}
        >
          <Text className="font-display text-base uppercase text-signage-white">{badge.name}</Text>
          <Text className="bg-silver-200 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-ink-950">{badge.note}</Text>
        </ListItem>
      ))}
    </List>
  );
}

/**
 * HERO, a bento with the form as its star. From `lg`: the title plates over
 * seven columns, the key art (the egg waiting in its case at night) under
 * them, and the form plate standing over both rows on the right, raised on
 * an orange plate like the CTA. On a phone the order is title, form, art, so
 * the form is in the first scroll.
 *
 * The form is interactive from first paint: its plate's entrance is
 * transform-only (`mfx-hero-*` is never pre-hidden), plays with the art as
 * one beat, and is skipped when the motion chunk arrives late.
 */
function Hero() {
  const copy = W05_COPY.hero;
  return (
    <Section aria-labelledby="w05-get-title" data-testid="w05-get" className="w-full overflow-hidden bg-bg">
      <View className="mx-auto w-full max-w-screen-xl gap-8 px-4 pb-16 pt-10 sm:px-6 md:pb-24 md:pt-14 lg:grid lg:grid-cols-12 lg:gap-x-8 lg:gap-y-8 lg:px-8">
        <View id="mfx-hero-get-title" className="min-w-0 items-start gap-5 lg:col-span-7 lg:row-start-1 lg:self-end">
          <Heading
            level={1}
            id="w05-get-title"
            className="my-0 flex flex-col items-start gap-2 font-display text-display-md uppercase leading-display text-signage-white sm:text-display-hero sm:leading-display md:gap-3 md:text-display-2xl md:leading-display"
          >
            {copy.titleLines.map((line, i) => (
              <Text
                key={line}
                className={`block w-fit bg-signage-black px-3 pb-1.5 pt-2.5 font-display md:px-5 md:pb-2 md:pt-3.5 ${i > 0 ? 'ml-6 sm:ml-10 md:ml-24' : ''}`}
              >
                {i < copy.titleLines.length - 1 ? `${line} ` : line}
              </Text>
            ))}
          </Heading>
          <Paragraph className="my-0 max-w-content-measure border-l-4 border-orange-500 bg-surface-raised px-4 py-3 text-lg leading-8 text-text md:text-xl md:leading-8">
            {copy.body}
          </Paragraph>
          <StoreBadges />
        </View>

        {/* The form plate: an orange plate under a raised face, the CTA's shadow at panel size. */}
        <View id="mfx-hero-get-form" className="relative min-w-0 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:self-center">
          <View aria-hidden className="absolute bottom-0 left-2 right-0 top-2 bg-orange-500 md:left-3 md:top-3" />
          <View className="relative mb-2 mr-2 gap-6 border-2 border-ink-950 bg-surface-raised px-5 pb-7 pt-6 md:mb-3 md:mr-3 md:px-8 md:pb-9 md:pt-8">
            <View aria-hidden className="h-1.5 w-12 bg-orange-500" />
            <Heading
              level={2}
              className="my-0 font-display text-display-sm uppercase leading-heading text-text md:text-display-md md:leading-heading"
            >
              {W05_COPY.form.title}
            </Heading>
            <WaitlistForm source="get" className="max-w-none" />
          </View>
        </View>

        <View id="mfx-hero-get-art" className="min-w-0 lg:col-span-7 lg:row-start-2">
          <ArtTile
            eager
            art={hatchNightArt(`${LG_UP} 46rem, 100vw`)}
            frame="aspect-[4/3] border-2 border-ink-950 sm:aspect-[16/9] lg:aspect-[2/1]"
          />
        </View>
      </View>
    </Section>
  );
}

/**
 * THE BENTO, on a night band: what NYC-MON is, in tiles of mixed size, each
 * in the site's existing words. From `lg`, a 12-column grid:
 *   row 1-2: the four eggs (seven columns, two rows) | the H-Lynk Core on ink
 *   row 2:                                            | the privacy plate
 *   row 3:   the route of How it works, full width, as a line of five stops.
 * Below `lg` the tiles stack in DOM order. The tiles stagger in on scroll.
 */
function Bento() {
  const copy = W05_COPY.bento;
  const cards = starterCards();
  return (
    <Section aria-labelledby="w05-bento-title" id="trg-get-bento" className="w-full bg-ink-950">
      {/* Harlem's skyline, drawn once and held still: the city between the form and what it is for. */}
      <SkylineDivider district="harlem" seed={5} size="md" still className="bg-bg" />
      <View className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <Heading
          level={2}
          id="w05-bento-title"
          className="my-0 font-display text-display-md uppercase leading-heading text-ink-50 lg:text-display-xl lg:leading-heading"
        >
          {copy.title}
        </Heading>

        <View className="gap-4 md:gap-5 lg:grid lg:grid-cols-12">
          {/* Eggs: the big tile. */}
          <View id="mfx-get-tile-0" className="min-w-0 gap-6 bg-bg px-5 pb-6 pt-6 md:px-8 md:pb-8 lg:col-span-7 lg:row-span-2">
            <Heading level={3} className="my-0 font-display text-2xl uppercase leading-heading text-text sm:text-display-sm sm:leading-heading md:text-display-md md:leading-heading">
              {copy.eggs.title}
            </Heading>
            <List className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4 md:gap-4">
              {cards.map((card, i) => (
                <ListItem key={card.key} className={`min-w-0 ${i % 2 === 1 ? 'mt-5 md:mt-8' : ''}`}>
                  <ArtTile art={eggArt(card.slot, `${LG_UP} 10rem, (min-width: ${breakpoints.sm}) 22vw, 46vw`)} frame="aspect-[4/5] border-2 border-ink-950" />
                  <Text className="bg-signage-black px-2 py-1.5 font-display text-xs uppercase leading-4 text-signage-white md:px-3 md:text-sm">
                    {card.eggName}
                  </Text>
                </ListItem>
              ))}
            </List>
            <Paragraph className="my-0 max-w-content-measure border-l-4 border-ink-950 pl-4 text-base leading-7 text-text md:text-lg md:leading-8">
              {copy.eggs.body}
            </Paragraph>
          </View>

          {/* The H-Lynk Core on its ink stage. */}
          <View
            id="mfx-get-tile-1"
            className="scheme-dark min-w-0 flex-row items-center gap-4 overflow-hidden border-2 border-silver-500 bg-ink-900 px-5 py-5 md:px-6 lg:col-span-5 lg:col-start-8 lg:row-start-1"
          >
            <ArtTile art={hlynkArt(`${MD_UP} 10rem, 30vw`)} fit="contain" frame="h-40 w-28 shrink-0 bg-ink-900 md:h-48 md:w-36" />
            <View className="min-w-0 flex-1 gap-2">
              <Heading level={3} className="my-0 font-display text-2xl uppercase leading-heading text-ink-50 md:text-3xl">
                {copy.hlynk.title}
              </Heading>
              <Paragraph className="my-0 text-lg font-semibold leading-7 text-ink-50">{copy.hlynk.lede}</Paragraph>
              <Paragraph className="my-0 text-sm leading-6 text-silver-300 md:text-base md:leading-7">{copy.hlynk.body}</Paragraph>
            </View>
          </View>

          {/* The privacy plate: the promise, the line from the notice, and both notices. */}
          <View id="mfx-get-tile-2" className="min-w-0 gap-4 bg-signage-black px-5 py-6 md:px-6 lg:col-span-5 lg:col-start-8 lg:row-start-2">
            <Heading level={3} className="my-0 font-display text-2xl uppercase leading-heading text-signage-white">
              {copy.privacy.title}
            </Heading>
            <Paragraph className="my-0 border-l-4 border-orange-500 pl-3 text-base font-semibold leading-6 text-signage-white">
              {copy.privacy.promise}
            </Paragraph>
            <Paragraph className="my-0 text-sm leading-6 text-silver-200 md:text-base md:leading-7">{copy.privacy.body}</Paragraph>
            <View className="flex-row flex-wrap gap-x-6 gap-y-1">
              {copy.privacy.links.map((link) => (
                <Link
                  key={link.href}
                  href={siteHref(link.href)}
                  className="inline-flex min-h-11 items-center text-base font-semibold text-signage-white underline underline-offset-4"
                >
                  {link.label}
                </Link>
              ))}
            </View>
          </View>

          {/* How it works, as the route: five numbered stops on one line, and the way there. */}
          <View
            id="mfx-get-tile-3"
            className="min-w-0 gap-6 border-2 border-silver-500 px-5 py-6 md:px-8 md:py-8 lg:col-span-12 lg:row-start-3 lg:grid lg:grid-cols-12 lg:items-center lg:gap-x-8"
          >
            <View className="min-w-0 items-start gap-4 lg:col-span-4">
              <Heading level={3} className="my-0 font-display text-display-sm uppercase leading-heading text-ink-50">
                {copy.loop.title}
              </Heading>
              <Paragraph className="my-0 text-base leading-7 text-silver-300">{copy.loop.body}</Paragraph>
              <LinkButton title={copy.loop.title} href={siteHref(copy.loop.href)} district="downtown" testID="w05-how" />
            </View>
            <List className="relative m-0 grid list-none grid-cols-5 gap-1 p-0 lg:col-span-8">
              <View aria-hidden className="absolute left-[10%] right-[10%] top-6 h-1 bg-orange-500 md:top-7" />
              {copy.loop.steps.map((step) => (
                <ListItem key={step.verb} className="min-w-0 items-center gap-2">
                  <Text className="relative flex h-12 w-12 items-center justify-center bg-signage-black font-display text-lg text-signage-white md:h-14 md:w-14 md:text-2xl">
                    {step.numeral}
                  </Text>
                  <Text className="max-w-full text-center text-xs font-semibold text-ink-50 sm:font-display sm:text-sm sm:uppercase md:text-base">{step.verb}</Text>
                </ListItem>
              ))}
            </List>
          </View>
        </View>
      </View>
    </Section>
  );
}

/** W05, the waitlist page: the hero bento with the form (PS-023), then what is on its way. */
export function GetPage() {
  return (
    <>
      <GetMotion />
      <View className="w-full flex-1 bg-bg">
        <Hero />
        <Bento />
      </View>
    </>
  );
}
