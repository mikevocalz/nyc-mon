import { Image, type ImageProps } from '@acme/ui';
import { Figcaption, Figure, Heading, Paragraph, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { TEMP_WORLD_ART } from './art';
import { Eyebrow } from './Eyebrow';
import { W01_COPY } from './copy';

/**
 * WORLD (W01 §04.C): the city as the game's world, not a backdrop. Four
 * bundled NYC photographs in an asymmetric editorial composition — Harlem,
 * Midtown, Downtown — each captioned like a location, not a feature card.
 * The `mpx-world-*` markers hand each frame a different scroll-drift rate
 * in the Kinetrell layer (motion.ts); on mobile and under reduced motion
 * the section is a plain vertical stack.
 */

// Descending z: later frames overlap upward into earlier captions, so earlier
// figures must paint above — the caption reads over the next photo, editorially.
const SPANS = [
  'md:col-span-7 relative z-30',
  'md:col-span-5 md:mt-24 relative z-20',
  'md:col-span-4 md:col-start-2 md:-mt-10 relative z-10',
  'md:col-span-5 md:col-start-8 md:-mt-4 relative z-0',
] as const;

const SIZES = [
  '(min-width: 768px) 56vw, 92vw',
  '(min-width: 768px) 40vw, 92vw',
  '(min-width: 768px) 32vw, 92vw',
  '(min-width: 768px) 40vw, 92vw',
] as const;

export function WorldSection() {
  const copy = W01_COPY.world;
  return (
    <Section
      aria-labelledby="w01-world-title"
      data-testid="w01-world"
      id="trg-world"
      className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:gap-0 md:py-28 lg:px-8"
    >
      <View id="mfx-world-head" className="max-w-3xl gap-4 md:mb-14">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <Heading
          level={2}
          id="w01-world-title"
          className="my-0 font-display text-3xl uppercase leading-[1.02] tracking-tight text-text md:text-5xl"
        >
          {copy.title}
        </Heading>
        <Paragraph className="my-0 max-w-[38rem] text-base leading-7 text-text-secondary md:text-lg md:leading-8">
          {copy.body}
        </Paragraph>
      </View>
      <View className="gap-10 md:grid md:grid-cols-12 md:gap-x-8 md:gap-y-0">
        {TEMP_WORLD_ART.map((photo, i) => (
          <Figure key={photo.id} id={`mpx-world-${'abcd'[i]}`} className={`m-0 ${SPANS[i]}`}>
            <Image
              src={photo.source as ImageProps['src']}
              alt={photo.alt}
              fill
              sizes={SIZES[i]}
              loading="lazy"
              unoptimized
              placeholder="blur"
              blurDataURL={photo.blurDataURL}
              className="aspect-[3/2] w-full"
            />
            <Figcaption className="absolute bottom-3 left-3 z-10 m-0 bg-ink-900/85 px-2.5 py-1.5">
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-100">
                <Text className="font-display text-orange-400">{String(i + 1).padStart(2, '0')}</Text>
                {`  ${photo.title} — ${photo.place}`}
              </Text>
            </Figcaption>
          </Figure>
        ))}
      </View>
    </Section>
  );
}
