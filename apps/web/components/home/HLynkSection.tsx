import { HLynkHudStage, Image, type ImageProps } from '@acme/ui';
import { Heading, List, ListItem, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { art } from './art';
import { W01_COPY } from './copy';
import { hudContent } from './hlynk-hud-content';
import { sectionMarker } from './sections';
import { sectionArt, sectionText, type CmsSectionProps } from './cms';

/** Keep the actual H-Lynk stage and its controls; only marketing copy and image relationships change. */
export function HLynkSection({ cms }: CmsSectionProps = {}) {
  const copy = W01_COPY.hlynk;
  const text = (key: string, fallback: string) => sectionText(cms, key, fallback);
  const capture = sectionArt(cms, 'hlynk.static', art('hlynk.static'));
  return <Section {...sectionMarker('hlynk')} aria-labelledby="w01-hlynk-title" data-testid="w01-hlynk" id="trg-hlynk" className="mx-auto w-full max-w-screen-xl px-4 py-16 sm:px-6 md:py-24 short:py-8 lg:px-8">
    <View className="gap-10 lg:grid lg:grid-cols-12 lg:gap-x-12 lg:gap-y-10">
      <View className="scheme-dark items-center justify-center bg-ink-950 px-4 py-8 sm:px-8 md:py-12 short:py-4 lg:col-span-7 lg:row-span-2 lg:row-start-1">
        <HLynkHudStage hud={hudContent()} controls={{ tabs: text('screen.controlLabel', copy.screen.controlLabel), sideKey: text('screen.sideKey', copy.screen.sideKey), sound: text('screen.sound', copy.screen.sound) }} capture={{ src: String(capture.src), width: capture.width, height: capture.height, sizes: capture.sizes }} caption={text('caption', copy.caption)} label={text('stageLabel', copy.stageLabel)} className="max-w-sm md:max-w-sm short:max-w-44 lg:max-w-[28rem] xl:max-w-[32rem]" />
      </View>
      <View id="mfx-hlynk-head" className="gap-5 lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:self-end">
        <Heading level={2} id="w01-hlynk-title" className="my-0 font-display text-display-lg uppercase leading-heading text-text xl:text-display-xl xl:leading-heading">{text('title', copy.title)}</Heading>
        <Paragraph className="my-0 text-xl font-semibold leading-8 text-text">{text('lede', copy.lede)}</Paragraph>
        <Paragraph className="my-0 max-w-content-measure text-base leading-7 text-text-secondary md:text-lg md:leading-8">{text('body', copy.body)}</Paragraph>
        <Paragraph className="my-0 max-w-content-measure border-l-4 border-ink-950 pl-4 text-base font-semibold leading-7 text-text">{text('bond', copy.bond)}</Paragraph>
      </View>
      <List className="m-0 list-none gap-6 p-0 lg:col-span-5 lg:col-start-8 lg:row-start-2 lg:self-start">
        {copy.proof.map((item, i) => {
          const crop = sectionArt(cms, item.slot, art(item.slot));
          return <ListItem key={item.slot} id={`mfx-hlynk-proof-${i}`} className="flex-row items-start gap-4 border-t-2 border-ink-950 pt-4">
            <View className="relative aspect-[4/3] w-36 shrink-0 overflow-hidden bg-ink-950 lg:w-48"><Image src={crop.src as ImageProps['src']} alt={crop.alt} fill framed={false} sizes={crop.sizes} loading="lazy" unoptimized={typeof crop.src === 'string' && crop.src.startsWith('https:')} className="h-full w-full" /></View>
            <View className="min-w-0 flex-1 gap-1">
              <Heading level={3} className="my-0 text-lg font-bold leading-7 text-text">{text(`proof.${i}.title`, item.title)}</Heading>
              <Paragraph className="my-0 text-sm leading-6 text-text-secondary md:text-base md:leading-7">{text(`proof.${i}.line`, item.line)}</Paragraph>
            </View>
          </ListItem>;
        })}
      </List>
    </View>
  </Section>;
}
