import { Image, LinkButton, SkylineDivider, TONE_CLASSES, type ImageProps, type Tone } from '@acme/ui';
import { Figure, Heading, Link, List, ListItem, Nav, Paragraph, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { artPosition } from '../home/art';
import { Eyebrow } from '../home/Eyebrow';
import { PlaceCaption } from '../home/PlaceCaption';
import { STORY_COPY as DEFAULT_STORY_COPY } from './copy';
import { storyCopy, storyPhotos } from './cms';
import { PageSections, originalLayout, type PageProps, type WebsitePageProps } from '../cms/PageContent';
import { chapterNumber } from './editorial';
import { ChapterNumeral, PhotoFrame, SignageHeadline } from './EditorialKit';
import { StoryMotion } from './StoryMotion';
import { siteHref } from '../../lib/site-href';

/** The chapters in reading order: the hero's line map links to each one. */
const CHAPTERS = [
  { id: 'story-clean-city', label: DEFAULT_STORY_COPY.cleanCity.eyebrow },
  { id: 'story-project-zero', label: DEFAULT_STORY_COPY.projectZero.eyebrow },
  { id: 'story-vale', label: DEFAULT_STORY_COPY.vale.eyebrow },
  { id: 'story-extinction', label: DEFAULT_STORY_COPY.extinction.eyebrow },
  { id: 'story-cascade', label: DEFAULT_STORY_COPY.cascade.eyebrow },
  { id: 'story-returned', label: DEFAULT_STORY_COPY.returned.eyebrow },
  { id: 'story-enginex', label: DEFAULT_STORY_COPY.enginex.eyebrow },
] as const;

const num = (id: (typeof CHAPTERS)[number]['id']) => chapterNumber(CHAPTERS.findIndex((c) => c.id === id));

const shell = 'mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8';
const body = 'my-0 max-w-content-measure text-base leading-7 text-text-secondary md:text-lg md:leading-8';
const nightBody = 'my-0 max-w-content-measure text-base leading-7 text-silver-200 md:text-lg md:leading-8';

/**
 * HERO: a night bridge, full bleed, with the confession set as two signage
 * plates over it. The line map along the foot links to the seven chapters,
 * like the stops on a line.
 */
function StoryHero({ page }: PageProps) {
  const DEFAULT_STORY_COPY = storyCopy(page);
  const PHOTOS = storyPhotos(page);
  const copy = DEFAULT_STORY_COPY.hero;
  return (
    <Section aria-labelledby="story-title" data-testid="story-hero" className="relative w-full overflow-hidden bg-ink-950">
      <Figure className="absolute inset-0 m-0">
        <View id="mfx-hero-art" className="absolute inset-0">
          <Image
        unoptimized
            src={PHOTOS.hero.src as ImageProps['src']}
            alt={PHOTOS.hero.alt}
            fill
            framed={false}
            priority
            loading="eager"
            sizes={PHOTOS.hero.sizes}
            placeholder={PHOTOS.hero.blurDataURL ? 'blur' : undefined}
            blurDataURL={PHOTOS.hero.blurDataURL}
            contentPosition={artPosition(PHOTOS.hero)}
            className="h-full w-full"
          />
        </View>
        <View aria-hidden className="absolute inset-0 bg-ink-950/55" />
        <View aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink-950 to-transparent" />
        <PlaceCaption entry={PHOTOS.hero} className="right-0 top-0" />
      </Figure>

      <View className={`${shell} relative min-h-hero justify-end gap-8 pb-10 pt-24 md:gap-10 md:pb-14 md:pt-40`}>
        <View id="mfx-hero-title" className="items-start gap-6">
          <Eyebrow night>{copy.eyebrow}</Eyebrow>
          <SignageHeadline title={copy.title} level={1} id="story-title" tone="plate" size="hero" />
        </View>
        <Paragraph
          id="mfx-hero-body"
          className="my-0 max-w-content-measure border-l-4 border-orange-500 bg-surface-raised px-4 py-3 text-base leading-7 text-text md:text-lg md:leading-8"
        >
          {copy.body}
        </Paragraph>

        <Nav aria-label="Chapters" className="mt-4 w-full">
          <List role="list" className="m-0 grid list-none grid-cols-1 gap-0 p-0 sm:grid-cols-2 lg:grid-cols-7">
            {CHAPTERS.filter((chapter) => !page?.sections.find((section) => `story-${section.sectionKey}` === chapter.id)?.hidden).map((chapter, i) => (
              <ListItem key={chapter.id} className="relative border-t-2 border-silver-500 lg:border-t-4">
                <Link
                  href={`#${chapter.id}`}
                  className="flex flex-row items-center gap-3 py-3 pr-3 text-silver-100 no-underline hover:text-orange-400 focus:text-orange-400 lg:flex-col lg:items-start lg:gap-2 lg:pt-4"
                >
                  <Text aria-hidden className="font-display text-xl leading-none text-orange-500 lg:text-3xl">
                    {chapterNumber(i)}
                  </Text>
                  <Text className="text-xs font-bold uppercase tracking-widest">{chapter.label}</Text>
                </Link>
              </ListItem>
            ))}
          </List>
        </Nav>
      </View>
    </Section>
  );
}

/** 01, daylight: the cleanup that worked, set beside a sealed brownstone row. */
function CleanCityChapter({ page }: PageProps) {
  const DEFAULT_STORY_COPY = storyCopy(page);
  const PHOTOS = storyPhotos(page);
  const copy = DEFAULT_STORY_COPY.cleanCity;
  return (
    <Section aria-labelledby="story-clean-city-title" data-testid="story-clean-city" id="trg-clean" className="w-full bg-bg">
      <View id="story-clean-city" className={`${shell} gap-10 py-20 md:grid md:grid-cols-12 md:gap-x-10 md:py-28`}>
        <View className="min-w-0 gap-6 md:col-span-7">
          <View id="mfx-clean-num" className="flex-row items-end gap-4">
            <ChapterNumeral value={num('story-clean-city')} />
          </View>
          <View id="mfx-clean-head" className="items-start gap-5">
            <Eyebrow>{copy.eyebrow}</Eyebrow>
            <SignageHeadline title={copy.title} level={2} id="story-clean-city-title" tone="plate" />
          </View>
          <Paragraph id="mfx-clean-body" className={`${body} md:text-xl md:leading-9`}>
            {copy.body}
          </Paragraph>
        </View>
        <PhotoFrame
          entry={PHOTOS.cleanCity}
          driftId="mpx-clean-drift"
          className="aspect-[4/5] border-2 border-ink-950 md:col-span-5 md:mt-24 md:aspect-auto md:min-h-[36rem]"
        />
      </View>
    </Section>
  );
}

/** 02, night: the serum. The quote is the chapter, set at display size. */
function ProjectZeroChapter({ page }: PageProps) {
  const DEFAULT_STORY_COPY = storyCopy(page);
  const PHOTOS = storyPhotos(page);
  const copy = DEFAULT_STORY_COPY.projectZero;
  return (
    <Section aria-labelledby="story-project-zero-title" data-testid="story-project-zero" id="trg-zero" className="w-full bg-ink-950">
      <View aria-hidden className="h-1 w-full bg-orange-500" />
      <View id="story-project-zero" className={`${shell} gap-12 py-20 md:py-28`}>
        <View className="gap-8 md:grid md:grid-cols-12 md:gap-x-10">
          <View id="mfx-zero-num" className="md:col-span-4">
            <ChapterNumeral value={num('story-project-zero')} night />
          </View>
          <View id="mfx-zero-head" className="min-w-0 items-start gap-6 md:col-span-8 md:pt-6">
            <Eyebrow night>{copy.eyebrow}</Eyebrow>
            <SignageHeadline title={copy.title} level={2} id="story-project-zero-title" tone="night" />
            <Paragraph className={nightBody}>{copy.body}</Paragraph>
          </View>
        </View>
        <Figure id="mfx-zero-quote" className="m-0 border-t-4 border-orange-500 pt-8 md:ml-[16%]">
          <Text aria-hidden className="block font-display text-[5rem] leading-none text-orange-500 md:text-[7rem]">
            {'“'}
          </Text>
          <Paragraph className="my-0 -mt-6 font-display text-2xl uppercase leading-heading text-ink-50 md:-mt-10 md:text-display-md md:leading-heading lg:text-display-lg lg:leading-heading">
            {copy.quote}
          </Paragraph>
        </Figure>
      </View>
    </Section>
  );
}

/** A full-bleed photograph between chapters: the city carrying on. */
function PhotoBand({ entry, id }: { entry: import('../home/art').ArtEntry; id: string }) {
  return (
    <PhotoFrame entry={entry} driftId={id} className="aspect-[4/3] sm:aspect-[21/9] lg:aspect-[3/1]" captionAt="bottom-0 right-0" />
  );
}

/** 03, daylight: Dr. Vale. Photograph left, the chapter right: the mirror of 01. */
function ValeChapter({ page }: PageProps) {
  const DEFAULT_STORY_COPY = storyCopy(page);
  const PHOTOS = storyPhotos(page);
  const copy = DEFAULT_STORY_COPY.vale;
  return (
    <Section aria-labelledby="story-vale-title" data-testid="story-vale" id="trg-vale" className="w-full bg-bg">
      <View id="story-vale" className={`${shell} gap-10 py-20 md:grid md:grid-cols-12 md:gap-x-10 md:py-28`}>
        <PhotoFrame
          entry={PHOTOS.vale}
          driftId="mpx-vale-drift"
          className="order-2 aspect-[4/5] border-2 border-ink-950 md:order-none md:col-span-5 md:aspect-auto md:min-h-[34rem]"
        />
        <View className="order-1 min-w-0 gap-6 md:order-none md:col-span-7 md:col-start-6 md:self-center">
          <View id="mfx-vale-num" className="md:items-end">
            <ChapterNumeral value={num('story-vale')} />
          </View>
          <View id="mfx-vale-head" className="items-start gap-5">
            <Eyebrow>{copy.eyebrow}</Eyebrow>
            <SignageHeadline title={copy.title} level={2} id="story-vale-title" tone="plate" />
          </View>
          <Paragraph id="mfx-vale-body" className={`${body} border-l-4 border-ink-950 pl-5 md:text-xl md:leading-9`}>
            {copy.body}
          </Paragraph>
        </View>
      </View>
    </Section>
  );
}

/**
 * 04, night, pinned: the false extinction. A full-screen frame over the
 * bridge at night. On desktop the scroll plays it (StoryMotionRoot.tsx); its
 * resting state, which phones and reduced motion get, is this markup.
 */
function ExtinctionChapter({ page }: PageProps) {
  const DEFAULT_STORY_COPY = storyCopy(page);
  const PHOTOS = storyPhotos(page);
  const copy = DEFAULT_STORY_COPY.extinction;
  return (
    <Section aria-labelledby="story-extinction-title" data-testid="story-extinction" className="w-full bg-ink-950">
      {/* The pinned element carries no position utility: utilities are !important (globals.css) and would beat the pin's inline position. */}
      <View id="mpx-extinction-frame" className="w-full md:h-svh md:min-h-[44rem]">
      <View className="relative h-full w-full overflow-hidden">
        <Figure className="absolute inset-0 m-0">
          <View id="mpx-extinction-art" className="absolute inset-0">
            <Image
        unoptimized
              src={PHOTOS.extinction.src as ImageProps['src']}
              alt={PHOTOS.extinction.alt}
              fill
              framed={false}
              sizes={PHOTOS.extinction.sizes}
              loading="lazy"
              placeholder={PHOTOS.extinction.blurDataURL ? 'blur' : undefined}
              blurDataURL={PHOTOS.extinction.blurDataURL}
              contentPosition={artPosition(PHOTOS.extinction)}
              className="h-full w-full"
            />
          </View>
          <View id="mpx-extinction-scrim" aria-hidden className="absolute inset-0 bg-ink-950/70" />
          <PlaceCaption entry={PHOTOS.extinction} className="bottom-0 right-0" />
        </Figure>
        <View id="story-extinction" className={`${shell} relative h-full justify-center gap-6 pb-20 pt-16 md:pb-12 md:pt-32`}>
          <ChapterNumeral id="mpx-extinction-num" value={num('story-extinction')} night size="md" />
          <Eyebrow night>{copy.eyebrow}</Eyebrow>
          <SignageHeadline
            title={copy.title}
            level={2}
            id="story-extinction-title"
            tone="plate"
            size="pin"
            lineIds={['mpx-extinction-line-0', 'mpx-extinction-line-1']}
          />
          <Paragraph
            id="mpx-extinction-body"
            className="my-0 max-w-content-measure border-l-4 border-orange-500 bg-ink-950/85 px-4 py-3 text-base leading-7 text-ink-50 md:text-lg md:leading-8"
          >
            {copy.body}
          </Paragraph>
        </View>
      </View>
      </View>
    </Section>
  );
}

/**
 * 05, the bento: the hidden decades. One night tile carries the chapter;
 * the five lineages sit around it as tiles of mixed size and tone, broken by
 * two photographs. Below `lg` it is one column in DOM order.
 */
const LINEAGE_TILES: readonly { tone: Tone | 'signage'; place: string }[] = [
  { tone: 'signage', place: 'lg:col-span-5 lg:col-start-8 lg:row-start-2' },
  { tone: 'leaf', place: 'lg:col-span-4 lg:row-start-3' },
  { tone: 'carolina', place: 'lg:col-span-4 lg:row-start-3' },
  { tone: 'royal', place: 'lg:col-span-5 lg:row-start-4' },
  { tone: 'orange', place: 'lg:col-span-7 lg:row-start-4' },
];

function CascadeChapter({ page }: PageProps) {
  const DEFAULT_STORY_COPY = storyCopy(page);
  const PHOTOS = storyPhotos(page);
  const copy = DEFAULT_STORY_COPY.cascade;
  return (
    <Section aria-labelledby="story-cascade-title" data-testid="story-cascade" id="trg-cascade" className="w-full bg-bg">
      <View id="story-cascade" className={`${shell} gap-4 py-20 md:py-28 lg:grid lg:grid-cols-12 lg:gap-4`}>
        <View
          id="mfx-cascade-head"
          className="min-w-0 justify-between gap-8 bg-ink-950 p-6 md:p-10 lg:col-span-7 lg:row-span-2 lg:row-start-1"
        >
          <ChapterNumeral value={num('story-cascade')} night />
          <View className="items-start gap-5">
            <Eyebrow night>{copy.eyebrow}</Eyebrow>
            <SignageHeadline title={copy.title} level={2} id="story-cascade-title" tone="night" />
            <Paragraph className={nightBody}>{copy.body}</Paragraph>
          </View>
        </View>
        <View id="mfx-cascade-photo" className="lg:col-span-5 lg:col-start-8 lg:row-start-1">
          <PhotoFrame entry={PHOTOS.rooftops} className="aspect-[3/2] lg:aspect-[16/10]" captionAt="bottom-0 left-0" />
        </View>

        <List aria-label={copy.title} className="contents m-0 list-none p-0">
          {copy.lineages.map((lineage, i) => {
            const tile = LINEAGE_TILES[i]!;
            const signage = tile.tone === 'signage';
            const face = signage ? 'bg-signage-black' : TONE_CLASSES[tile.tone as Tone].face;
            const on = signage ? 'text-signage-white' : TONE_CLASSES[tile.tone as Tone].on;
            return (
              <ListItem
                key={lineage.name}
                id={`mfx-cascade-tile-${i}`}
                className={`mt-4 min-h-56 justify-between gap-6 p-6 md:p-8 lg:mt-0 ${face} ${tile.place}`}
              >
                <Text aria-hidden className={`font-display text-display-md leading-none ${on}`}>
                  {`${num('story-cascade')}.${i + 1}`}
                </Text>
                <View className="gap-3">
                  <Heading level={3} className={`my-0 font-display text-2xl uppercase leading-heading md:text-3xl ${on}`}>
                    {lineage.name}
                  </Heading>
                  <Paragraph className={`my-0 max-w-content-measure text-base font-semibold leading-7 ${on}`}>{lineage.line}</Paragraph>
                </View>
              </ListItem>
            );
          })}
        </List>
        <View id="mfx-cascade-water" className="mt-4 lg:col-span-4 lg:row-start-3 lg:mt-0">
          <PhotoFrame entry={PHOTOS.water} className="aspect-[3/2] lg:aspect-auto lg:h-full lg:min-h-56" captionAt="bottom-0 left-0" />
        </View>
      </View>
    </Section>
  );
}

/** 06: the return. The headline at the page's largest size, the quote on an orange plate, then Times Square full bleed. */
function ReturnedChapter({ page }: PageProps) {
  const DEFAULT_STORY_COPY = storyCopy(page);
  const PHOTOS = storyPhotos(page);
  const copy = DEFAULT_STORY_COPY.returned;
  return (
    <Section aria-labelledby="story-returned-title" data-testid="story-returned" id="trg-returned" className="w-full bg-bg">
      <View id="story-returned" className={`${shell} gap-10 pb-16 pt-20 md:pb-20 md:pt-28`}>
        <View id="mfx-returned-head" className="gap-5">
          <View className="flex-row items-end gap-6">
            <ChapterNumeral value={num('story-returned')} />
          </View>
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <SignageHeadline title={copy.title} level={2} id="story-returned-title" tone="day" size="giant" />
        </View>
        <View className="gap-8 md:grid md:grid-cols-12 md:gap-x-10">
          <Paragraph id="mfx-returned-body" className={`${body} md:col-span-6 md:text-xl md:leading-9`}>
            {copy.body}
          </Paragraph>
          <Figure id="mfx-returned-quote" className="m-0 md:col-span-6 md:self-start">
            <View className="relative mb-2 mr-2">
              <View aria-hidden className="absolute -bottom-2 -right-2 left-2 top-2 bg-ink-950" />
              <View className="relative bg-orange-500 p-6 md:p-8">
              <Paragraph className="my-0 font-display text-xl uppercase leading-heading text-ink-950 md:text-2xl lg:text-3xl lg:leading-heading">
                {copy.quote}
              </Paragraph>
              </View>
            </View>
          </Figure>
        </View>
      </View>
      <PhotoBand entry={PHOTOS.returned} id="mpx-returned-drift" />
    </Section>
  );
}

/** 07, night: three eras of one company, as three giant numerals in a row. */
function EngineXChapter({ page }: PageProps) {
  const DEFAULT_STORY_COPY = storyCopy(page);
  const PHOTOS = storyPhotos(page);
  const copy = DEFAULT_STORY_COPY.enginex;
  // The closing sentence is the line the page lands on; the copy is unchanged, only set apart.
  const sentences = copy.body.split(/(?<=\.)\s+/);
  const closing = sentences.pop() ?? '';
  return (
    <Section aria-labelledby="story-enginex-title" data-testid="story-enginex" id="trg-enginex" className="w-full bg-ink-950">
      <View aria-hidden className="h-1 w-full bg-orange-500" />
      <View id="story-enginex" className={`${shell} gap-14 py-20 md:py-28`}>
        <View id="mfx-enginex-head" className="gap-6 md:flex-row md:items-end md:justify-between">
          <View className="items-start gap-5">
            <Eyebrow night>{copy.eyebrow}</Eyebrow>
            <SignageHeadline title={copy.title} level={2} id="story-enginex-title" tone="night" />
          </View>
          <ChapterNumeral value={num('story-enginex')} night className="md:text-right" />
        </View>
        <List className="m-0 list-none gap-0 p-0 md:grid md:grid-cols-3">
          {copy.eras.map((era, i) => {
            const numeral = era.era.split(':')[0]?.replace('Era ', '') ?? '';
            return (
              <ListItem
                key={era.era}
                id={`mfx-enginex-era-${i}`}
                className="gap-4 border-t-2 border-silver-500 py-8 md:border-l-2 md:border-t-0 md:px-8 md:py-2 md:first:border-l-0 md:first:pl-0"
              >
                <Text aria-hidden className="font-display text-[5rem] leading-none text-orange-500 md:text-[7rem]">
                  {numeral}
                </Text>
                <Heading level={3} className="my-0 text-sm font-bold uppercase tracking-widest text-silver-200">
                  {era.era}
                </Heading>
                <Paragraph className="my-0 font-display text-2xl uppercase leading-heading text-ink-50 md:text-3xl">
                  {era.line}
                </Paragraph>
              </ListItem>
            );
          })}
        </List>
        <View id="mfx-enginex-body" className="gap-6 md:ml-[33%]">
          <Paragraph className={nightBody}>{sentences.join(' ')}</Paragraph>
          <Paragraph className="my-0 font-display text-2xl uppercase leading-heading text-orange-500 md:text-3xl">{closing}</Paragraph>
        </View>
      </View>
    </Section>
  );
}

/** The close: the slogan on two plates over a Harlem skyline, and the one action. */
function StoryOutro({ page }: PageProps) {
  const DEFAULT_STORY_COPY = storyCopy(page);
  const PHOTOS = storyPhotos(page);
  const copy = DEFAULT_STORY_COPY.footer;
  return (
    <Section aria-labelledby="story-outro-title" data-testid="story-outro" id="trg-outro" className="w-full bg-ink-950">
      <SkylineDivider district="harlem" seed={7} size="lg" still />
      <View className={`${shell} items-start gap-8 py-20 md:py-28`}>
        <View id="mfx-outro-head" className="items-start gap-6">
          <SignageHeadline title={copy.title} level={2} id="story-outro-title" tone="night" size="giant" />
          <Paragraph className="my-0 text-lg leading-8 text-silver-200 md:text-xl">{copy.body}</Paragraph>
        </View>
        <View id="mfx-outro-cta">
          <LinkButton title={copy.cta.label} href={siteHref(copy.cta.href)} tone="royal" size="lg" testID="story-cta" />
        </View>
      </View>
    </Section>
  );
}

/**
 * The Story page: the Clean City Legacy through the return of the Mons, as a
 * chapter-by-chapter scroll. Daylight chapters alternate with night bands for
 * the dark ones; full-bleed photographs sit between them; the hidden decades
 * are a bento. Server HTML throughout; StoryMotion binds the Kinetrell beats.
 */
export function StoryPage({ page, embedOrigins, siteOrigin }: WebsitePageProps = {}) {
  const PHOTOS = storyPhotos(page);
  const sections = {
    hero: <StoryHero page={page} />,
    skyline: <SkylineDivider district="megacity" seed={3} size="md" still />,
    'clean-city': <CleanCityChapter page={page} />,
    'project-zero': <ProjectZeroChapter page={page} />,
    sunset: <PhotoBand entry={PHOTOS.sunset} id="mpx-sunset-drift" />,
    vale: <ValeChapter page={page} />,
    extinction: <ExtinctionChapter page={page} />,
    cascade: <CascadeChapter page={page} />,
    returned: <ReturnedChapter page={page} />,
    enginex: <EngineXChapter page={page} />,
    outro: <StoryOutro page={page} />,
  };
  return <>{originalLayout(page, Object.keys(sections)) ? <StoryMotion /> : null}<View className="w-full flex-1 bg-bg"><PageSections page={page} embedOrigins={embedOrigins} siteOrigin={siteOrigin} sections={sections} /></View></>;
}
