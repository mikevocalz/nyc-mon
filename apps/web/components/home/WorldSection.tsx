import { pageMotion } from '@acme/theme';
import { Image, type ImageProps } from '@acme/ui';
import { Figure, Heading, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { art, artPosition, WORLD_SLOTS } from './art';
import { W01_COPY } from './copy';
import { PlaceCaption } from './PlaceCaption';
import { sectionMarker } from './sections';

/**
 * The drifting image layer overhangs its frame by the largest parallax step
 * on each side, so a drift never shows an edge (PREMIUM_SITE_MOTION §3).
 */
const OVERHANG = `-${pageMotion.parallax.max}%`;

/** Grid placement per frame, in WORLD_SLOTS order. DOM order is the mobile reading order. */
const FRAME_PLACEMENT = {
  'world.primary': 'aspect-[4/5] md:col-span-7 md:row-span-2 md:row-start-1 md:aspect-auto',
  'world.secondary': 'aspect-[3/2] md:col-span-5 md:col-start-8 md:row-start-2',
} as const satisfies Record<(typeof WORLD_SLOTS)[number], string>;

function WorldFrame({ slot, drift }: { slot: (typeof WORLD_SLOTS)[number]; drift: string }) {
  const photo = art(slot);
  return (
    <Figure className={`relative m-0 w-full overflow-hidden border-2 border-ink-950 bg-ink-900 ${FRAME_PLACEMENT[slot]}`}>
      <View id={drift} className="absolute inset-x-0" style={{ top: OVERHANG, bottom: OVERHANG }}>
        <Image
          src={photo.src as ImageProps['src']}
          alt={photo.alt}
          fill
          framed={false}
          sizes={photo.sizes}
          loading="lazy"
          unoptimized
          placeholder="blur"
          blurDataURL={photo.blurDataURL}
          contentPosition={artPosition(photo)}
          className="h-full w-full"
        />
      </View>
      <PlaceCaption entry={photo} className="bottom-0 left-0" />
    </Figure>
  );
}

/**
 * WORLD (PS-015): the page's first bento. One dominant street photograph
 * over two rows, the story beside it, a supporting photograph under the
 * story. Three modules, two of them photographs; hard edges, no rounding.
 * Each caption is a signage plate naming the district and the cross streets.
 * On phones the grid is a single column in DOM order: photo, story, photo.
 * `mpx-world-*` drift on desktop only (motion.ts); reduced motion is static.
 */
export function WorldSection() {
  const copy = W01_COPY.world;
  const [primary, secondary] = WORLD_SLOTS;
  return (
    <Section
      {...sectionMarker('world')}
      aria-labelledby="w01-world-title"
      data-testid="w01-world"
      id="trg-world"
      className="mx-auto w-full max-w-screen-xl px-4 py-16 sm:px-6 md:py-24 lg:px-8"
    >
      <View className="gap-8 md:grid md:grid-cols-12 md:gap-x-8 md:gap-y-8">
        <WorldFrame slot={primary} drift="mpx-world-a" />
        <View id="mfx-world-story" className="gap-5 md:col-span-5 md:col-start-8 md:row-start-1 md:self-end">
          <Heading
            level={2}
            id="w01-world-title"
            className="my-0 font-display text-display-md uppercase leading-heading text-text lg:text-display-lg lg:leading-heading xl:text-display-xl xl:leading-heading"
          >
            {copy.title}
          </Heading>
          <Paragraph className="my-0 max-w-content-measure text-base leading-7 text-text-secondary md:text-lg md:leading-8">
            {copy.body}
          </Paragraph>
          <Paragraph className="my-0 max-w-content-measure border-l-4 border-ink-950 pl-4 text-base font-semibold leading-7 text-text">
            {copy.body2}
          </Paragraph>
        </View>
        <WorldFrame slot={secondary} drift="mpx-world-b" />
      </View>
    </Section>
  );
}
