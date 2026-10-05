import { Heading, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { Eyebrow } from './Eyebrow';
import { W01_COPY } from './copy';

/**
 * The page's one dark band: the hatch (Decision #4). Night in both schemes,
 * with fixed night palette steps (a themed class would resolve for the
 * page's scheme, not this plate). Orange is the hatch accent (Decision #7).
 */
export function HatchBand() {
  const copy = W01_COPY.hatch;
  return (
    <Section aria-labelledby="w01-hatch-title" data-testid="w01-hatch" className="w-full bg-ink-950">
      <View className="h-1 w-full bg-orange-500" aria-hidden />
      <View className="mx-auto w-full max-w-screen-xl gap-5 px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <Eyebrow night>{copy.eyebrow}</Eyebrow>
        <Heading level={2} id="w01-hatch-title" className="my-0 max-w-3xl font-display text-4xl leading-tight text-orange-500 md:text-5xl">
          {copy.title}
        </Heading>
        <Paragraph className="my-0 max-w-2xl text-lg leading-8 text-ink-50">{copy.body}</Paragraph>
        <Paragraph className="my-0 max-w-2xl text-lg leading-8 text-silver-300">{copy.body2}</Paragraph>
      </View>
    </Section>
  );
}
