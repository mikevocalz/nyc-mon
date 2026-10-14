import type { ReactNode } from 'react';
import { breakpoints } from '@acme/theme';
import { LinkButton } from '@acme/ui';
import { Heading, Link, List, ListItem, Nav, OrderedList, Paragraph, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { Eyebrow } from '../home/Eyebrow';
import { HeroCity } from '../home/HeroDistrictIsland';
import { starterCards, type StarterCard } from '../home/StartersSection';
import { ArtTile } from './ArtTile';
import { babyArt, eggArt, hatchNightArt, hlynkArt } from './art';
import { CareBento } from './CareBento';
import { CityTerminus } from './CityTerminus';
import { W04_COPY } from './copy';
import { HowItWorksMotion } from './HowItWorksMotion';

type Step = (typeof W04_COPY.loop.steps)[number];

const MD_UP = `(min-width: ${breakpoints.md})`;
const LG_UP = `(min-width: ${breakpoints.lg})`;

/** The in-page anchor for a stop, shared by the hero's line map and the stop itself. */
const stepId = (step: Step) => `hiw-${step.verb.toLowerCase()}`;

/**
 * HERO: the title as two signage plates (the second set off to the right, as
 * on the home hero), the line on a concrete plate, and the five stops as a
 * line map of in-page links. From `lg` a three-tile art stack sits to the
 * right: the Metro Egg tall, the H-Lynk Core on its ink stage and a Baby.
 * Transform-only entrance (`mfx-hero-*` is never pre-hidden), so nothing in
 * the first view ever goes transparent.
 */
function Hero({ cards }: { cards: readonly StarterCard[] }) {
  const loop = W04_COPY.loop;
  const [first] = cards;
  return (
    <HeroCity id="trg-hiw-hero" labelledBy="w04-loop-title" className="w-full overflow-hidden">
      <View
        data-testid="w04-loop"
        className="mx-auto w-full max-w-screen-xl gap-10 px-4 pb-14 pt-10 sm:px-6 md:pb-20 md:pt-16 lg:grid lg:grid-cols-12 lg:items-center lg:gap-x-10 lg:px-8 lg:py-24"
      >
        <View id="mfx-hero-hiw-copy" className="min-w-0 items-start gap-6 lg:col-span-7">
          <Heading
            level={1}
            id="w04-loop-title"
            className="my-0 flex flex-col items-start gap-2 font-display text-display-hero uppercase leading-display text-signage-white md:gap-3 md:text-display-2xl md:leading-display"
          >
            {loop.titleLines.map((line, i) => (
              <Text
                key={line}
                className={`block w-fit bg-signage-black px-3 pb-1.5 pt-2.5 font-display md:px-5 md:pb-2 md:pt-3.5 ${i > 0 ? 'ml-6 sm:ml-10 md:ml-24' : ''}`}
              >
                {i < loop.titleLines.length - 1 ? `${line} ` : line}
              </Text>
            ))}
          </Heading>
          <Paragraph className="my-0 max-w-content-measure border-l-4 border-orange-500 bg-surface-raised px-4 py-3 text-lg leading-8 text-text md:text-xl md:leading-8">
            {loop.body}
          </Paragraph>
          <LineMap />
        </View>

        <View id="mfx-hero-hiw-art" className="min-w-0 lg:col-span-5">
          <View className="grid grid-cols-5 gap-3 md:gap-4">
            {first ? (
              <ArtTile
                eager
                art={eggArt(first.slot, `${LG_UP} 15rem, 55vw`)}
                frame="col-span-3 row-span-2 aspect-auto min-h-72 border-2 border-ink-950 md:min-h-[28rem]"
              />
            ) : null}
            <View className="scheme-dark col-span-2 aspect-square items-center justify-center bg-ink-950">
              <ArtTile eager art={hlynkArt(`${LG_UP} 10rem, 38vw`)} fit="contain" frame="h-[88%] w-[88%] bg-ink-950" />
            </View>
            {first ? (
              <ArtTile eager art={babyArt(first.slot, `${LG_UP} 10rem, 38vw`)} frame="col-span-2 aspect-square border-2 border-ink-950" />
            ) : null}
          </View>
        </View>
      </View>
    </HeroCity>
  );
}

/**
 * The five stops as a line map: a route line with a numbered bullet per
 * stop, each a link to that stop below. Five columns at every width; the
 * verb sits under its number.
 */
function LineMap() {
  const loop = W04_COPY.loop;
  return (
    <Nav aria-label={loop.listLabel} className="w-full max-w-xl bg-ink-950 px-2 pb-2 pt-3 md:px-4">
      <OrderedList className="relative m-0 grid list-none grid-cols-5 gap-1 p-0">
        <View aria-hidden className="absolute left-[10%] right-[10%] top-5 h-1 bg-orange-500" />
        {loop.steps.map((step) => (
          <ListItem key={step.verb} className="min-w-0">
            <Link
              href={`#${stepId(step)}`}
              className="group flex min-h-12 flex-col items-center gap-1.5 py-1 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <Text className="relative flex h-9 w-9 items-center justify-center border-2 border-silver-200 bg-signage-black text-center font-display text-sm text-signage-white group-hover:bg-orange-500 group-hover:text-on-cta md:h-11 md:w-11 md:text-lg">
                {step.numeral}
              </Text>
              <Text className="max-w-full text-center text-xs font-semibold text-silver-100 underline-offset-4 group-hover:underline sm:text-sm">
                {step.verb}
              </Text>
            </Link>
          </ListItem>
        ))}
      </OrderedList>
    </Nav>
  );
}

/** Stop 01: the three eggs on Dr. Santoro's table, each named. */
function MeetArt({ cards }: { cards: readonly StarterCard[] }) {
  return (
    <List className="m-0 grid list-none grid-cols-3 gap-2 p-0 md:gap-4">
      {cards.map((card, i) => (
        <ListItem key={card.key} className={`min-w-0 gap-0 ${i === 1 ? 'mt-6 md:mt-10' : ''}`}>
          <ArtTile art={eggArt(card.slot)} frame="aspect-[4/5] border-2 border-ink-950" />
          <Text className="bg-signage-black px-2 py-1.5 font-display text-xs uppercase leading-4 text-signage-white md:px-3 md:text-sm">
            {card.eggName}
          </Text>
        </ListItem>
      ))}
    </List>
  );
}

/** Stop 02: the H-Lynk Core on its ink stage, named and with its line. */
function NameArt() {
  const copy = W04_COPY.hlynk;
  return (
    <View className="scheme-dark relative min-h-80 flex-row items-center justify-center overflow-hidden bg-ink-950 px-4 py-8 md:min-h-[26rem]">
      <ArtTile art={hlynkArt(`${LG_UP} 18rem, ${MD_UP} 40vw, 60vw`)} fit="contain" frame="h-72 w-full max-w-64 bg-ink-950 md:h-96 md:max-w-80" />
      <View className="absolute bottom-0 left-0 gap-0.5 bg-signage-black px-4 py-3">
        <Text className="font-display text-base uppercase text-signage-white">{copy.name}</Text>
        <Text className="text-sm text-silver-200">{copy.lede}</Text>
      </View>
    </View>
  );
}

/** Stop 03: the egg waiting at night, and the three incubation times as plates. */
function IncubateArt() {
  const copy = W04_COPY.incubation;
  return (
    <View className="gap-0">
      <ArtTile art={hatchNightArt(`${LG_UP} 44rem, 100vw`)} frame="aspect-[4/3] border-2 border-ink-950 md:aspect-[3/2]" />
      <List aria-label={copy.label} className="m-0 list-none flex-row flex-wrap gap-0 border-x-2 border-b-2 border-ink-950 bg-signage-black p-0">
        {copy.options.map((option, i) => (
          <ListItem
            key={option}
            className={`flex-1 items-center px-1 py-3 ${i > 0 ? 'border-l-2 border-silver-500' : ''}`}
          >
            <Text className="whitespace-nowrap font-display text-xs uppercase text-signage-white sm:text-sm md:text-lg">{option}</Text>
          </ListItem>
        ))}
      </List>
    </View>
  );
}

/** Stop 04: the three Baby forms, one large and two stacked, and the hatch band's closing line. */
function HatchArt({ cards }: { cards: readonly StarterCard[] }) {
  const [lead, ...rest] = cards;
  return (
    <View className="gap-3 md:gap-4">
      <View className="grid grid-cols-3 gap-3 md:gap-4">
        {lead ? (
          <ArtTile art={babyArt(lead.slot, `${LG_UP} 30rem, 66vw`)} frame="col-span-2 row-span-2 aspect-[4/5] border-2 border-ink-950" />
        ) : null}
        {rest.map((card) => (
          <ArtTile key={card.key} art={babyArt(card.slot, `${LG_UP} 14rem, 33vw`)} frame="aspect-auto min-h-0 border-2 border-ink-950" />
        ))}
      </View>
      <Paragraph className="my-0 w-fit bg-signage-black px-4 py-2.5 font-display text-lg uppercase leading-heading text-signage-white md:text-2xl">
        {W04_COPY.hatchClosing}
      </Paragraph>
    </View>
  );
}

/**
 * One stop on the route. The bullet sits on the line: a signage-black plate
 * with the stop number at display size and an orange plate behind it, offset
 * like the CTA's shadow. The orange plate is the stop's light: it scales up
 * when the drawn line reaches the stop (`mpx-hiw-lit-*`) and is simply there
 * without motion. From `lg` the copy and the art sit side by side,
 * alternating sides stop to stop; stop 05 holds the care bento full width.
 */
function Stop({ step, index, art, wide = false }: { step: Step; index: number; art: ReactNode; wide?: boolean }) {
  const flip = index % 2 === 1;
  return (
    <ListItem id={stepId(step)} className="relative scroll-mt-28 pl-16 md:pl-36">
      {/* The route line from this stop down to the next stop (or the terminus), centred under the bullet. */}
      <View aria-hidden className="absolute -bottom-24 left-[1.3125rem] top-12 w-1.5 bg-silver-300 md:-bottom-32 md:left-[2.8125rem] md:top-24">
        <View id={`mpx-hiw-line-${index}`} className="absolute inset-0 bg-orange-500" style={{ transformOrigin: 'top' }} />
      </View>
      <View aria-hidden id={`trg-hiw-stop-${index}`} className="absolute left-0 top-0 h-12 w-12 md:h-24 md:w-24">
        <View id={`mpx-hiw-lit-${index}`} className="absolute left-1.5 top-1.5 h-full w-full bg-orange-500 md:left-2 md:top-2" />
        <View className="absolute inset-0 items-center justify-center bg-signage-black">
          <Text className="pt-1 font-display text-2xl leading-none text-signage-white md:text-display-lg md:leading-none">
            {step.numeral}
          </Text>
        </View>
      </View>
      <View
        id={`mfx-hiw-stop-${index}`}
        className={wide ? 'gap-8 md:gap-10' : 'gap-8 lg:grid lg:grid-cols-12 lg:items-center lg:gap-x-10'}
      >
        <View
          className={`min-w-0 gap-4 ${wide ? 'lg:max-w-3xl' : flip ? 'lg:col-span-5 lg:col-start-8 lg:row-start-1' : 'lg:col-span-5 lg:row-start-1'}`}
        >
          <Heading
            level={2}
            className="my-0 font-display text-display-md uppercase leading-display text-text sm:text-display-lg sm:leading-display md:text-display-xl md:leading-display lg:text-display-lg lg:leading-display xl:text-display-xl xl:leading-display 2xl:text-display-2xl 2xl:leading-display"
          >
            {step.verb}
          </Heading>
          <Paragraph className="my-0 max-w-content-measure text-lg leading-8 text-text md:text-xl md:leading-9">{step.line}</Paragraph>
        </View>
        <View className={`min-w-0 ${wide ? '' : flip ? 'lg:col-span-7 lg:col-start-1 lg:row-start-1' : 'lg:col-span-7 lg:col-start-6 lg:row-start-1'}`}>
          {art}
        </View>
      </View>
    </ListItem>
  );
}

/**
 * W04: the Phase-1 companion loop as a route. A route line runs down the
 * left edge past five numbered stops (Meet, Name, Incubate, Hatch, Care),
 * each with its real art, and ends at a terminus where the loop goes out
 * into the city; then the waitlist band.
 *
 * Motion (HowItWorksMotion, Kinetrell on the home page's single GSAP clock):
 * the hero settles on load; the orange line draws itself down the route as
 * you scroll (`mpx-hiw-line-*`, scrubbed stop to stop), and each stop lights as the
 * line reaches it; stop copy, bento tiles and the city tiles stagger in.
 * Reduced motion or no JavaScript: all of it is drawn, lit and at rest.
 */
export function HowItWorksPage() {
  const cards = starterCards();
  const [meet, name, incubate, hatch, care] = W04_COPY.loop.steps;
  const cta = W04_COPY.cta;
  return (
    <>
      <HowItWorksMotion />
      <View className="w-full flex-1 bg-bg">
        <Hero cards={cards} />

        <View className="w-full border-t-4 border-signage-black">
          <View className="relative mx-auto w-full max-w-screen-xl gap-24 px-4 py-16 sm:px-6 md:gap-32 md:py-28 lg:px-8">
            <OrderedList aria-label={W04_COPY.loop.listLabel} className="m-0 list-none gap-24 p-0 md:gap-32">
              {meet ? <Stop step={meet} index={0} art={<MeetArt cards={cards} />} /> : null}
              {name ? <Stop step={name} index={1} art={<NameArt />} /> : null}
              {incubate ? <Stop step={incubate} index={2} art={<IncubateArt />} /> : null}
              {hatch ? <Stop step={hatch} index={3} art={<HatchArt cards={cards} />} /> : null}
              {care ? <Stop step={care} index={4} art={<CareBento />} wide /> : null}
            </OrderedList>
            <CityTerminus />
          </View>
        </View>

        {/* The page's one night band, like W01's HatchBand: the one action. */}
        <Section aria-labelledby="w04-cta-title" data-testid="w04-cta" id="trg-hiw-cta" className="w-full bg-ink-950">
          <View className="h-1 w-full bg-orange-500" aria-hidden />
          <View className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-20 sm:px-6 md:py-28 lg:grid lg:grid-cols-12 lg:items-end lg:gap-x-10 lg:px-8">
            <View id="mfx-hiw-cta-copy" className="min-w-0 items-start gap-6 lg:col-span-7">
              <Eyebrow night>{cta.eyebrow}</Eyebrow>
              <Heading
                level={2}
                id="w04-cta-title"
                className="my-0 font-display text-display-lg uppercase leading-display text-orange-500 md:text-display-xl md:leading-display lg:text-display-2xl lg:leading-display"
              >
                {cta.title}
              </Heading>
              <Paragraph className="my-0 max-w-content-measure text-lg leading-8 text-ink-50">{cta.body}</Paragraph>
              <LinkButton title={cta.cta} href={cta.ctaHref} variant="cta" size="lg" testID="w04-cta" />
            </View>
            <View id="mfx-hiw-cta-art" className="min-w-0 lg:col-span-5">
              <ArtTile art={eggArt(3, `${LG_UP} 28rem, 92vw`)} frame="aspect-[4/3] lg:aspect-[4/5]" />
            </View>
          </View>
        </Section>
      </View>
    </>
  );
}
