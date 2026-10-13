import { HOME_COPY } from '@acme/spatial/copy';
import { Image, LinkButton, type ImageProps } from '@acme/ui';
import { Figcaption, Figure, Heading, Link, Paragraph, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { art, artPosition, starterSlot } from '../../home/art';
import { W01_COPY } from '../../home/copy';
import { starterCards } from '../../home/StartersSection';
import { CANON_COPY } from './copy';
import { ConceptArtTag, HERO_GUTTERS, HERO_SURFACE, type HeadlineLevel } from './parts';

if (CANON_COPY.titleLines.flat().join(' ') !== HOME_COPY.tagline) {
  throw new Error('Direction A must spell HOME_COPY.tagline');
}

/**
 * Direction A, canon-first. The approved slogan as two signage plates, a
 * support line that says what a Mon is and what the visitor does, and the
 * proof beside it: Squeaklet (starter slot 1, concept art) on a Harlem stoop,
 * with the red H-Lynk Core render (Decision #16, PS-002) stamped over its
 * corner. The render's screen already reads "Squeaklet, Your Mon", so the two
 * pictures say the same thing. Daylit concrete, no city canvas, no picker.
 *
 * Grid from `lg`: copy in the left 7 columns, centred on the art, which spans
 * the right 5. DOM (= phone) order: headline, support line, art, actions.
 */
export function DirectionCanon({ level = 1 }: { level?: HeadlineLevel }) {
  const starter = starterCards()[0];
  if (!starter) throw new Error('@acme/content has no starter in slot 1');
  const baby = art(starterSlot(starter.slot));
  const hlynk = art('hlynk.static');
  const titleId = 'review-a-title';

  return (
    <View className={HERO_SURFACE} testID="review-hero-a">
      <View
        className={`${HERO_GUTTERS} gap-5 pb-10 pt-6 md:gap-6 md:py-12 lg:grid lg:grid-cols-12 lg:grid-rows-[1fr_auto_auto_auto_1fr] lg:gap-x-10 lg:gap-y-6 lg:py-14`}
      >
        <Heading
          level={level}
          id={titleId}
          className="my-0 flex flex-col items-start gap-2 font-display text-display-md uppercase leading-display text-signage-white sm:text-display-lg md:gap-3 lg:col-span-7 lg:row-start-2 lg:text-display-xl"
        >
          {CANON_COPY.titleLines.map((words, line) => (
            <Text
              key={words.join(' ')}
              className={`block w-fit bg-signage-black px-3 pb-1.5 pt-2.5 font-display md:px-5 md:pb-2 md:pt-3.5 ${line > 0 ? 'ml-6 md:ml-16' : ''}`}
            >
              {line === CANON_COPY.titleLines.length - 1 ? words.join(' ') : `${words.join(' ')} `}
            </Text>
          ))}
        </Heading>

        <Paragraph className="my-0 max-w-content-measure border-l-4 border-ink-950 bg-signage-white px-4 py-3 text-base leading-7 text-signage-black md:text-lg md:leading-8 lg:col-span-7 lg:row-start-3">
          {CANON_COPY.body}
        </Paragraph>

        <Figure className="relative m-0 min-w-0 lg:col-span-5 lg:col-start-8 lg:row-span-5 lg:row-start-1 lg:self-center">
          <View className="flex-row gap-3 lg:relative lg:block lg:pb-10 lg:pl-10">
            <View className="relative min-w-0 flex-[3] lg:w-full">
              <Image
                src={baby.src as ImageProps['src']}
                alt={baby.alt}
                fill
                priority
                loading="eager"
                sizes="(min-width: 1024px) 26rem, 58vw"
                placeholder="blur"
                blurDataURL={baby.blurDataURL}
                contentPosition={artPosition(baby)}
                className="h-48 w-full sm:h-64 lg:aspect-[4/5] lg:h-auto"
              />
              <ConceptArtTag className="left-2 top-2" />
            </View>
            <View className="relative min-w-0 flex-[2] lg:absolute lg:bottom-0 lg:left-0 lg:w-52 xl:w-60">
              <Image
                src={hlynk.src as ImageProps['src']}
                alt={CANON_COPY.hlynkAlt}
                fill
                sizes="(min-width: 1280px) 15rem, (min-width: 1024px) 13rem, 38vw"
                contentPosition={{ left: '50%', top: '45%' }}
                tone="apple"
                className="h-48 w-full sm:h-64 lg:aspect-[4/5] lg:h-auto"
              />
            </View>
          </View>
          <Figcaption className="m-0 mt-3 flex flex-col gap-0.5 lg:mt-4 lg:pl-10">
            <Text className="text-sm font-semibold text-signage-black">
              {CANON_COPY.babyCaption(starter.babyName, starter.bloodline)}
            </Text>
            <Text className="text-sm text-concrete-700">{CANON_COPY.hlynkCaption}</Text>
          </Figcaption>
        </Figure>

        <View className="w-full flex-row flex-wrap items-center gap-x-6 gap-y-3 lg:col-span-7 lg:row-start-4">
          <LinkButton title={W01_COPY.hero.cta} href={W01_COPY.hero.ctaHref} variant="cta" size="lg" />
          <Link
            href={CANON_COPY.secondary.href}
            className="inline-flex min-h-11 items-center text-base font-semibold text-signage-black underline underline-offset-4"
          >
            {CANON_COPY.secondary.label}
          </Link>
        </View>
      </View>
    </View>
  );
}
