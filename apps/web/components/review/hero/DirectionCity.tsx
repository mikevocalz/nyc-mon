import { LinkButton } from '@acme/ui';
import { Heading, Paragraph, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { W01_COPY } from '../../home/copy';
import { CityDistrictStage } from './CityDistrictStage';
import { CITY_COPY } from './copy';
import { HERO_GUTTERS, HERO_SURFACE, type HeadlineLevel } from './parts';

/**
 * Direction C, city-first (PROPOSED copy). The headline is the approved site
 * intro's first sentence, "Mons live on New York's blocks.", promoted to H1.
 * The district picker is the first control, set high and wide, and it swaps a
 * real daylit photograph of the picked district with its signage caption
 * (DISTRICT_COPY). No creature above the fold: this direction tests whether
 * the city alone carries the first five seconds.
 *
 * From `lg` the headline runs the full width like a station sign; below it the
 * support line, picker and CTA take 5 columns and the photograph 7.
 * DOM (= phone) order: headline, support line, picker, CTA, photograph.
 */
export function DirectionCity({ level = 1 }: { level?: HeadlineLevel }) {
  const titleId = 'review-c-title';
  return (
    <View className={HERO_SURFACE} testID="review-hero-c">
      <View
        className={`${HERO_GUTTERS} gap-5 pb-10 pt-6 md:gap-6 md:py-12 lg:grid lg:grid-cols-12 lg:grid-rows-[auto_auto_auto_auto_1fr] lg:gap-x-10 lg:gap-y-6 lg:py-12`}
      >
        <Heading
          level={level}
          id={titleId}
          className="my-0 flex flex-col items-start font-display text-display-md uppercase leading-display text-signage-black sm:text-display-lg lg:col-span-12 lg:row-start-1 lg:text-display-xl xl:text-display-2xl"
        >
          {CITY_COPY.titleLines.map((line, i) => (
            <Text key={line} className="block font-display">
              {i < CITY_COPY.titleLines.length - 1 ? `${line} ` : line}
            </Text>
          ))}
        </Heading>

        <Paragraph className="my-0 max-w-content-measure text-base leading-7 text-signage-black md:text-lg md:leading-8 lg:col-span-5 lg:row-start-2">
          {CITY_COPY.body}
        </Paragraph>

        <CityDistrictStage
          pickerClassName="lg:col-span-5 lg:row-start-3"
          figureClassName="lg:col-span-7 lg:col-start-6 lg:row-span-4 lg:row-start-2"
          cta={
            <View className="w-full items-start lg:col-span-5 lg:row-start-4">
              <LinkButton title={W01_COPY.hero.cta} href={W01_COPY.hero.ctaHref} variant="cta" size="lg" />
            </View>
          }
        />
      </View>
    </View>
  );
}
