import { Image, type ImageProps } from '@acme/ui';
import { Figure, Heading, Paragraph, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { art, artPosition } from './art';
import { Eyebrow } from './Eyebrow';
import { W01_COPY } from './copy';
import { PlaceCaption } from './PlaceCaption';
import { sectionMarker } from './sections';
import { sectionArt, sectionText, type CmsSectionProps } from './cms';

export function HatchBand({ cms }: CmsSectionProps = {}) {
  const copy = W01_COPY.hatch;
  const text = (key: string, fallback: string) => sectionText(cms, key, fallback);
  const hatchArt = sectionArt(cms, 'hatch', art('hatch'));
  return <Section {...sectionMarker('hatch')} aria-labelledby="w01-hatch-title" data-testid="w01-hatch" id="trg-hatch" className="w-full bg-ink-950">
    <View className="h-1 w-full bg-orange-500" aria-hidden />
    <View className="mx-auto w-full max-w-screen-xl gap-10 px-4 pb-24 pt-20 sm:px-6 md:gap-14 md:pb-32 md:pt-28 lg:px-8">
      <View id="mfx-hatch-copy" className="min-w-0 gap-6">
        <Eyebrow night>{text('eyebrow', copy.eyebrow)}</Eyebrow>
        <Heading level={2} id="w01-hatch-title" className="my-0 font-display text-display-lg uppercase leading-display text-ink-50 md:text-display-xl md:leading-display lg:text-display-2xl lg:leading-display">
          <Text className="block font-display">{text('title.0', copy.title[0])}</Text><Text className="block font-display text-orange-500">{text('title.1', copy.title[1])}</Text>
        </Heading>
      </View>
      <View id="mfx-hatch-art" className="w-full min-w-0"><Figure className="relative m-0 aspect-[4/5] w-full overflow-hidden bg-ink-900 sm:aspect-[3/2] md:aspect-[21/9]">
        <Image src={hatchArt.src as ImageProps['src']} alt={hatchArt.alt} fill framed={false} sizes={hatchArt.sizes} loading="lazy" unoptimized={typeof hatchArt.src === 'string' && hatchArt.src.startsWith('https:')} placeholder={hatchArt.blurDataURL ? 'blur' : 'empty'} blurDataURL={hatchArt.blurDataURL} contentPosition={artPosition(hatchArt)} className="h-full w-full" />
        <PlaceCaption entry={hatchArt} className="bottom-0 left-0" />
      </Figure></View>
      <View className="gap-8 md:flex-row-reverse md:items-start md:justify-between md:gap-14">
        <View className="min-w-0 gap-5 md:flex-[6_1_0%]"><Paragraph className="my-0 max-w-content-measure text-lg leading-8 text-ink-50">{text('body', copy.body)}</Paragraph><Paragraph className="my-0 max-w-content-measure text-lg leading-8 text-silver-300">{text('body2', copy.body2)}</Paragraph></View>
        <View id="mfx-hatch-cta" className="min-w-0 md:flex-[5_1_0%]"><Paragraph className="my-0 font-display text-2xl uppercase leading-heading text-ink-50 md:text-3xl lg:text-4xl">{text('closing', copy.closing)}</Paragraph></View>
      </View>
    </View>
  </Section>;
}
