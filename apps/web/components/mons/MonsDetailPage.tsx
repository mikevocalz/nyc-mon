import { copyFor, sectionFor, sectionText } from '@acme/content/site-content';
import { PageSections, originalLayout, type PageProps, type WebsitePageProps } from '../cms/PageContent';
import { placedArt } from '../cms/art';
import { placedMonArt, monDetailCopy } from './cms';
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
import { siteHref } from '../../lib/site-href';

/** Giant Dex numerals: the slot tone's face, decorative (the Dex chip carries the number as text). */
// The giant Dex numerals use the 600 step: the 500 orange and leaf fall under 3:1 on light grounds.
const NUMERAL_TEXT = { orange: 'text-orange-600', royal: 'text-royal-500', leaf: 'text-leaf-600' } as Record<string, string>;

/**
 * HERO: the Mon on night. The name is set as signage plates, one word a
 * plate, each line stepped right like the home headline; the Dex plate and
 * the egg sit under it. The portrait takes the other half with the Dex
 * number at poster size behind it.
 *
 * Motion: the page's standout. The portrait settles from slightly large on
 * load, then its image layer drifts inside the fixed frame while the number
 * behind it drifts the other way, so the Mon reads as standing in front of
 * its number (`mpx-hero-*`, desktop only).
 */
function Hero({ starter, page }: { starter: MonsStarter } & PageProps) {
  const cms = sectionFor(page, 'hero');
  const labels = copyFor(cms, { name: starter.babyName, bloodline: starter.bloodline, eggName: starter.eggName, cultureNote: starter.cultureNote ?? '' }, `cards.${starter.slot}`);
  const conceptArt = sectionText(cms, 'conceptArt', W02_COPY.conceptArt);
  const copy = monDetailCopy(page, 'hero');
  const a = placedMonArt(cms, starter.slot);
  const t = TONE_CLASSES[a.tone];
  const words = labels.name.split(' ');
  return (
    <Section
      aria-labelledby={`w02-${starter.slug}-title`}
      data-testid={`w02-mon-${starter.slug}`}
      id="trg-hero"
      className="scheme-dark w-full overflow-hidden bg-ink-950"
    >
      <View className="mx-auto w-full max-w-screen-xl gap-12 px-4 pb-16 pt-10 sm:px-6 md:pt-14 lg:grid lg:grid-cols-12 lg:items-end lg:gap-x-10 lg:px-8 lg:pb-20 lg:pt-12">
        <Link
          href={siteHref(copy.backHref)}
          className="-mb-6 self-start lg:col-span-12 lg:mb-2 text-sm font-semibold text-silver-200 underline decoration-orange-500 decoration-2 underline-offset-4 hover:text-signage-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {copy.back}
        </Link>
        <View className="min-w-0 gap-6 lg:col-span-6">
          <Eyebrow night>{copy.eyebrow(starter.bloodline)}</Eyebrow>
          <Heading
            level={1}
            id={`w02-${starter.slug}-title`}
            className="my-0 flex flex-col items-start gap-2 font-display uppercase leading-display md:gap-3"
          >
            {words.map((word, i) => (
              <Text
                key={word}
                id={`mfx-hero-title-${i}`}
                className={`block max-w-full break-words border-l-8 bg-signage-black px-4 pb-1.5 pt-3 font-display text-[2.5rem] leading-display text-signage-white sm:text-display-xl sm:leading-display xl:text-display-2xl xl:leading-display ${t.border} ${i > 0 ? 'ml-8 md:ml-16' : ''}`}
              >
                {i < words.length - 1 ? `${word} ` : word}
              </Text>
            ))}
          </Heading>
          <View id="mfx-hero-meta" className="flex-row flex-wrap items-center gap-4">
            <DexChip dexId={starter.dexId} tone={a.tone} large />
            <View className="flex-row items-center gap-3">
              <RouteDisc tone={a.tone} />
              <Text className="text-base font-semibold text-silver-200">{W02_COPY.index.hatchesFrom(starter.eggName)}</Text>
            </View>
          </View>
          <Paragraph id="mfx-hero-body" className="my-0 max-w-content-measure text-base leading-7 text-silver-300 md:text-lg md:leading-8">
            {copy.bloodlineBody(starter.bloodline)}
          </Paragraph>
        </View>

        <View className="relative min-w-0 pt-24 sm:pt-32 lg:col-span-6 lg:pt-32">
          <View id="mpx-hero-numeral-mid-rev" aria-hidden className="absolute right-0 top-0">
            <Text className={`block font-display text-[8.5rem] leading-none sm:text-[13rem] lg:text-[15rem] xl:text-[18rem] ${NUMERAL_TEXT[a.tone]}`}>
              {dexDigits(starter.dexId)}
            </Text>
          </View>
          <Figure
            id="mfx-hero-portrait"
            className="relative m-0 aspect-[4/5] w-full overflow-hidden border-2 border-ink-800 bg-ink-900 sm:aspect-[5/4] lg:aspect-square"
          >
            <ArtFill entry={a.baby} drift="mpx-hero-portrait-far" eager />
            <ConceptCaption label={conceptArt} />
          </Figure>
        </View>
      </View>
    </Section>
  );
}

/**
 * DOSSIER: the page's bento, composed apart from the home page's. A
 * signage-black board runs the public line (Egg to Baby, PS-029) as two
 * stops on a route; the egg stands in a tall tile beside it; under the board
 * the street the concept art is set on, and, where the route copy has one,
 * the starter's line on the slot tone's face. Phones read board, egg,
 * street, line.
 */
function Dossier({ starter, page }: { starter: MonsStarter } & PageProps) {
  const cms = sectionFor(page, 'dossier');
  const labels = copyFor(cms, { name: starter.babyName, bloodline: starter.bloodline, eggName: starter.eggName, cultureNote: starter.cultureNote ?? '' }, `cards.${starter.slot}`);
  const conceptArt = sectionText(cms, 'conceptArt', W02_COPY.conceptArt);
  const copy = monDetailCopy(page, 'dossier');
  const a = placedMonArt(cms, starter.slot);
  const t = TONE_CLASSES[a.tone];
  const blurb = copy.blurb[starter.slug];
  return (
    <Section aria-labelledby="w02-line-title" id="trg-dossier" className="mx-auto w-full max-w-screen-xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <View className="gap-6 lg:grid lg:grid-cols-12 lg:gap-6">
        <View id="mfx-dossier-board" className="min-w-0 gap-8 bg-signage-black px-6 py-8 md:px-10 md:py-10 lg:col-span-8 lg:row-start-1">
          <View className="gap-3">
            <Text className={`text-type-tag font-extrabold uppercase ${t.text}`}>{labels.bloodline}</Text>
            <Heading level={2} id="w02-line-title" className="my-0 font-display text-display-md uppercase leading-heading text-signage-white md:text-display-lg md:leading-heading">
              {copy.lineTitle}
            </Heading>
          </View>
          <List className="m-0 list-none p-0 md:grid md:grid-cols-2">
            {starter.line.map((step, i) => {
              const last = i === starter.line.length - 1;
              return (
                <ListItem key={step.key} className="relative flex-row items-start gap-4 pb-8 md:flex-col md:gap-4 md:pb-0 md:pr-6">
                  {last ? null : (
                    <View
                      aria-hidden
                      className="absolute bottom-0 left-3.5 top-4 w-1 bg-silver-500 md:bottom-auto md:left-4 md:right-0 md:top-3.5 md:h-1 md:w-auto"
                    />
                  )}
                  <RouteDisc tone={a.tone} className="relative h-8 w-8" />
                  <View className="min-w-0 flex-1 gap-1 md:flex-none">
                    <Text className="text-sm font-semibold uppercase tracking-widest text-silver-300">
                      {step.dexId === null ? step.stage : `${step.stage} · ${copy.dex(step.dexId)}`}
                    </Text>
                    <Text className="break-words font-display text-2xl uppercase leading-heading text-signage-white sm:text-display-board">{step.name ?? copy.unnamedForm}</Text>
                  </View>
                </ListItem>
              );
            })}
          </List>
        </View>

        <Article
          id="mfx-dossier-egg"
          aria-labelledby="w02-egg-title"
          className="min-w-0 border-2 border-ink-950 bg-surface-raised lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1"
        >
          <Figure className="relative m-0 aspect-[4/5] w-full overflow-hidden bg-ink-900 sm:aspect-[3/2] lg:aspect-[4/5]">
            <ArtFill entry={a.egg} />
            <ConceptCaption label={conceptArt} />
          </Figure>
          <View className="gap-3 border-t-2 border-ink-950 px-6 pb-7 pt-5">
            <Heading level={3} id="w02-egg-title" className="my-0 font-display text-display-sm uppercase leading-heading text-text">
              {labels.eggName}
            </Heading>
            <Paragraph className="my-0 text-base leading-7 text-text-secondary">{copy.eggBody(starter.eggName, starter.babyName)}</Paragraph>
          </View>
        </Article>

        <View id="mfx-dossier-street" className={`min-w-0 lg:row-start-2 ${blurb ? 'lg:col-span-5' : 'lg:col-span-8'}`}>
          <StreetFigure entry={a.street} drift="mpx-dossier-street-near" className="aspect-[4/3] w-full border-2 border-ink-950 lg:aspect-auto lg:h-full lg:min-h-72" />
        </View>

        {blurb ? (
          <View id="mfx-dossier-line" className={`min-w-0 justify-end px-6 py-7 lg:col-span-3 lg:col-start-6 lg:row-start-2 ${t.face}`}>
            <Paragraph className={`my-0 font-display text-xl uppercase leading-heading md:text-2xl ${t.onFace}`}>{blurb}</Paragraph>
          </View>
        ) : null}

        {starter.cultureNote ? (
          <Paragraph className="my-0 text-sm leading-6 text-text-muted lg:col-span-12">{labels.cultureNote}</Paragraph>
        ) : null}
      </View>
    </Section>
  );
}

/**
 * HATCH: the night band, after the home page's (same title, same closing
 * line, same picture): the egg in its case with the crack lit, then the
 * site's one call to action.
 */
function HatchBand({ page }: PageProps) {
  const cms = sectionFor(page, 'hatch');
  const conceptArt = sectionText(cms, 'conceptArt', W02_COPY.conceptArt);
  const copy = monDetailCopy(page, 'hatch');
  const [lead, payoff] = copy.hatchTitle;
  const picture = placedArt(cms, 'hatch', hatchArt(`(min-width: ${breakpoints.xl}) 80rem, 100vw`));
  return (
    <Section aria-labelledby="w02-hatch-title" id="trg-hatch" className="scheme-dark w-full bg-ink-950">
      <View className="h-1 w-full bg-orange-500" aria-hidden />
      <View className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:gap-12 md:py-24 lg:px-8">
        <Heading
          level={2}
          id="w02-hatch-title"
          className="my-0 font-display text-display-lg uppercase leading-display text-ink-50 md:text-display-xl md:leading-display lg:text-display-2xl lg:leading-display"
        >
          <Text id="mfx-hatch-title" className="block font-display">
            {lead}{' '}
            <Text className="block font-display text-orange-500">{payoff}</Text>
          </Text>
        </Heading>
        <Figure id="mfx-hatch-art" className="relative m-0 aspect-[4/5] w-full overflow-hidden bg-ink-900 sm:aspect-[3/2] md:aspect-[21/9]">
          <ArtFill entry={picture} drift="mpx-hatch-art-mid" />
          <ConceptCaption label={conceptArt} />
        </Figure>
        <View id="mfx-hatch-cta" className="gap-6 md:flex-row md:items-center md:justify-between">
          <Paragraph className="my-0 font-display text-2xl uppercase leading-heading text-ink-50 md:text-3xl">{copy.hatchClosing}</Paragraph>
          <LinkButton title={copy.cta.label} href={siteHref(copy.cta.href)} tone="royal" size="lg" testID="w02-detail-cta" />
        </View>
      </View>
    </Section>
  );
}

/** One of the other starters as a link card: portrait, number behind the name, Bloodline. */
function OtherCard({ starter, index, page }: { starter: MonsStarter; index: number } & PageProps) {
  const cms = sectionFor(page, 'others');
  const labels = copyFor(cms, { name: starter.babyName, bloodline: starter.bloodline, eggName: starter.eggName, cultureNote: starter.cultureNote ?? '' }, `cards.${starter.slot}`);
  const conceptArt = sectionText(cms, 'conceptArt', W02_COPY.conceptArt);
  const copy = copyFor(cms, W02_COPY.index);
  const a = placedMonArt(cms, starter.slot);
  const t = TONE_CLASSES[a.tone];
  return (
    <ListItem id={`mfx-others-${index}`} className="min-w-0 md:flex-1">
      <Link
        href={siteHref(copy.cardHref(starter.slug))}
        aria-label={copy.cardLabel(starter.babyName)}
        className="group flex h-full flex-col border-2 border-ink-950 bg-surface-raised no-underline transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 sm:flex-row motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        <Figure className="relative m-0 aspect-square w-full shrink-0 overflow-hidden bg-ink-900 sm:w-1/2">
          <ArtFill entry={{ ...a.baby, sizes: `(min-width: ${breakpoints.md}) 20rem, 100vw` }} />
          <ConceptCaption label={conceptArt} />
        </Figure>
        <View className="relative min-w-0 flex-1 justify-end gap-3 overflow-hidden border-t-2 border-ink-950 px-5 pb-6 pt-16 sm:border-l-2 sm:border-t-0">
          <Text aria-hidden className={`absolute -right-2 top-0 font-display text-[6rem] leading-none ${NUMERAL_TEXT[a.tone]}`}>
            {dexDigits(starter.dexId)}
          </Text>
          <DexChip dexId={starter.dexId} tone={a.tone} />
          <Text className="relative font-display text-display-sm uppercase leading-heading text-text">{labels.name}</Text>
          <View className="flex-row items-center gap-2 border-l-4 border-ink-950 pl-3">
            <Text className="text-base font-semibold text-text">{labels.bloodline}</Text>
          </View>
          <Text className={`text-sm font-bold uppercase tracking-widest ${t.pageText}`}>{copy.cardLabel(starter.babyName)}</Text>
        </View>
      </Link>
    </ListItem>
  );
}

function Others({ starter, page }: { starter: MonsStarter } & PageProps) {
  const cms = sectionFor(page, 'others');
  const conceptArt = sectionText(cms, 'conceptArt', W02_COPY.conceptArt);
  const copy = monDetailCopy(page, 'others');
  const others = monsStarters().filter((s) => s.slug !== starter.slug);
  return (
    <Section aria-labelledby="w02-others-title" id="trg-others" className="mx-auto w-full max-w-screen-xl gap-8 px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <View id="mfx-others-head" className="gap-4 md:flex-row md:items-end md:justify-between">
        <Heading level={2} id="w02-others-title" className="my-0 font-display text-display-md uppercase leading-heading text-text lg:text-display-lg lg:leading-heading">
          {copy.othersTitle}
        </Heading>
        <LinkButton title={copy.back} href={siteHref(copy.backHref)} testID={`w02-${starter.slug}-back`} />
      </View>
      <List className="m-0 list-none gap-6 p-0 md:flex-row">
        {others.map((other, i) => (
          <OtherCard page={page} key={other.slug} starter={other} index={i} />
        ))}
      </List>
    </Section>
  );
}

/**
 * W02 detail: one starter as a character page. Night hero with the portrait
 * and its Dex number, a still skyline of the district the concept art is set
 * in, the dossier bento (line, egg, street), the hatch band with the site's
 * one call to action, then the other two starters. Server HTML; MonsMotion
 * arms the Kinetrell reveals after hydration.
 */
export function MonsDetailPage({ starter, page, embedOrigins, siteOrigin }: { starter: MonsStarter } & WebsitePageProps) {
  const a = monsArt(starter.slot);
  const sections = {
    hero: <Hero starter={starter} page={page} />,
    skyline: <SkylineDivider district={a.district} seed={starter.slot * 5} size="md" still />,
    dossier: <Dossier starter={starter} page={page} />,
    hatch: <HatchBand page={page} />,
    others: <Others starter={starter} page={page} />,
  };
  return <>{originalLayout(page, Object.keys(sections)) ? <MonsMotion /> : null}<View className="w-full flex-1 bg-bg"><PageSections page={page} embedOrigins={embedOrigins} siteOrigin={siteOrigin} sections={sections} /></View></>;
}
