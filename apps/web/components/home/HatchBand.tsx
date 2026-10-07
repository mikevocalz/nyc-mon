import { Image, LinkButton, type ImageProps } from '@acme/ui';
import { Figure, Heading, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { TEMP_HATCH_ART } from './art';
import { Eyebrow } from './Eyebrow';
import { W01_COPY } from './copy';

/**
 * The page's one dark band: the hatch (Decision #4), the emotional climax.
 * Night in both schemes, with fixed night palette steps. The darkest bundled
 * city frame (TEMP_HATCH_ART — the lit bridge) sits opposite the copy like a
 * window into the district at night; the waitlist CTA closes the page.
 * `mfx-hatch-*` marks the quiet reveal authored in ./motion.ts.
 */
export function HatchBand() {
  const copy = W01_COPY.hatch;
  return (
    <Section aria-labelledby="w01-hatch-title" data-testid="w01-hatch" id="trg-hatch" className="w-full bg-ink-950">
      <View className="h-1 w-full bg-orange-500" aria-hidden />
      <View className="mx-auto w-full max-w-screen-xl items-center gap-10 px-4 py-20 sm:px-6 md:flex-row md:gap-14 md:py-32 lg:px-8">
        <View id="mfx-hatch-copy" className="w-full min-w-0 gap-5 md:flex-[6_1_0%]">
          <Eyebrow night>{copy.eyebrow}</Eyebrow>
          <Heading
            level={2}
            id="w01-hatch-title"
            className="my-0 max-w-2xl font-display text-4xl uppercase leading-[0.98] tracking-tight text-orange-500 md:text-6xl"
          >
            {copy.title}
          </Heading>
          <Paragraph className="my-0 max-w-2xl text-lg leading-8 text-ink-50">{copy.body}</Paragraph>
          <Paragraph className="my-0 max-w-2xl text-lg leading-8 text-silver-300">{copy.body2}</Paragraph>
          <Paragraph className="my-0 font-display text-lg uppercase tracking-tight text-ink-50 md:text-xl">
            {copy.closing}
          </Paragraph>
          <View id="mfx-hatch-cta" className="pt-2">
            <LinkButton title={copy.cta} href={copy.ctaHref} variant="cta" size="lg" />
          </View>
        </View>
        <View id="mfx-hatch-art" className="w-full min-w-0 md:flex-[5_1_0%]">
          <Figure className="m-0">
            <Image
              src={TEMP_HATCH_ART.source as ImageProps['src']}
              alt={TEMP_HATCH_ART.alt}
              fill
              district="megacity"
              sizes="(min-width: 768px) 40vw, 92vw"
              loading="lazy"
              unoptimized
              placeholder="blur"
              blurDataURL={TEMP_HATCH_ART.blurDataURL}
              className="aspect-[4/3] w-full md:aspect-[5/4]"
            />
          </Figure>
        </View>
      </View>
    </Section>
  );
}
