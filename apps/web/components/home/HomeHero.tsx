import { BrandLogo, Image, LinkButton, type ImageProps } from '@acme/ui';
import { Figure, Heading, Paragraph, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { art, artHref, artPosition } from './art';
import { W01_COPY } from './copy';
import { HeroCity, HeroDistrictPicker } from './HeroDistrictIsland';
import { PlaceCaption } from './PlaceCaption';
import { sectionMarker } from './sections';

/** The seal renders once at its largest size; the wrapper scales it per breakpoint. */
const SEAL_SIZE = 240;

/**
 * W01 hero, server-rendered (PS-008, PS-013). The headline is set as two
 * signage plates over the live district city; the support line sits on a
 * concrete plate, because those are the only lines the city behind them
 * would make unreadable. On the right from `md`, the hero photograph is a
 * poster with the seal stamped across its corner. The city canvas and the
 * district control are the only client islands.
 *
 * The photograph is the LCP element: eager, high priority, preloaded, in a
 * box whose aspect is fixed before it loads.
 */
export function HomeHero() {
  const copy = W01_COPY.hero;
  const heroArt = art('hero');

  return (
    <View {...sectionMarker('hero')} className="w-full">
      {/* React hoists this into <head>; ReactDOM.preload() from a server component only reached the flight payload. */}
      <link rel="preload" as="image" href={artHref(heroArt)} fetchPriority="high" />
      <HeroCity id="trg-hero" labelledBy="mfx-hero-title" className="lg:min-h-hero-wide">
        <View
          data-testid="w01-hero"
          className="mx-auto w-full max-w-screen-xl flex-1 gap-10 px-4 pb-16 pt-8 sm:px-6 md:py-14 lg:grid lg:grid-cols-12 lg:content-center lg:items-center lg:gap-x-8 lg:gap-y-0 lg:px-8 lg:py-20 short:grid short:grid-cols-12 short:items-center short:gap-x-6 short:gap-y-0 short:pb-4 short:pt-3"
        >
          <View className="min-w-0 items-start gap-5 lg:col-span-8 short:col-span-7 short:gap-2.5">
            <Heading
              level={1}
              id="mfx-hero-title"
              className="my-0 flex flex-col items-start gap-2 font-display md:gap-4 text-display-hero uppercase leading-display text-signage-white md:text-display-2xl md:leading-display lg:text-display-xl lg:leading-display xl:text-display-2xl xl:leading-display short:gap-2 short:text-display-hero-short short:leading-display"
            >
              {copy.titleLines.map((segments, line) => (
                <Text
                  key={segments.join(' ')}
                  className={`flex flex-col items-start gap-2 font-display md:block md:w-fit md:bg-signage-black md:px-5 md:pb-2 md:pt-3.5 short:block short:w-fit short:bg-signage-black short:px-3 short:pb-1 short:pt-2 ${line > 0 ? 'md:ml-16 xl:ml-24 short:ml-8' : ''}`}
                >
                  {segments.map((segment, i) => (
                    <Text
                      key={segment}
                      className="block w-fit whitespace-normal bg-signage-black px-3 pb-1.5 pt-2.5 font-display md:inline md:bg-transparent md:p-0 short:inline short:bg-transparent short:p-0"
                    >
                      {/* The trailing space keeps the document text "Every block has a legend." */}
                      {line === copy.titleLines.length - 1 && i === segments.length - 1 ? segment : `${segment} `}
                    </Text>
                  ))}
                </Text>
              ))}
            </Heading>
            <Paragraph
              id="mfx-hero-body"
              className="my-0 max-w-content-measure border-l-4 border-ink-950 bg-surface-raised px-4 py-3 text-base leading-7 text-text md:text-lg md:leading-8 short:py-1.5 short:text-sm short:leading-6"
            >
              {copy.body}
            </Paragraph>
            <View id="mfx-hero-actions" className="w-full items-start gap-5 short:gap-3">
              <LinkButton title={copy.cta} href={copy.ctaHref} variant="cta" size="lg" testID="w01-cta" />
              <View className="w-full max-w-xl">
                <HeroDistrictPicker label={copy.districtLabel} />
              </View>
            </View>
          </View>

          <Figure id="mfx-hero-art" className="relative m-0 min-w-0 lg:col-span-4 short:col-span-5">
            <View className="relative w-full lg:ml-auto lg:max-w-content-hero-art short:ml-auto short:max-w-56">
              <Image
                src={heroArt.src as ImageProps['src']}
                alt={heroArt.alt}
                fill
                priority
                loading="eager"
                {...({ fetchPriority: 'high' } as object)}
                sizes={heroArt.sizes}
                unoptimized
                placeholder="blur"
                blurDataURL={heroArt.blurDataURL}
                contentPosition={artPosition(heroArt)}
                className="aspect-[4/3] w-full md:aspect-[16/9] lg:aspect-[4/5] short:aspect-[4/5]"
              />
              <View
                id="mfx-hero-seal"
                aria-hidden
                className="pointer-events-none absolute -bottom-8 -left-3 origin-bottom-left scale-50 md:scale-75 lg:-bottom-10 lg:-left-16 xl:-left-24 xl:scale-100 short:-bottom-3 short:-left-10 short:scale-40"
              >
                <BrandLogo size={SEAL_SIZE} />
              </View>
            </View>
            {/* A direct child of Figure so it captions the figure; pinned over the poster's top-right corner.
                Names the landmark, not a district, so it never reads as the picker's state (PS-026). */}
            <PlaceCaption entry={heroArt} landmark className="right-0 top-0 short:hidden" />
          </Figure>
        </View>
      </HeroCity>
    </View>
  );
}
