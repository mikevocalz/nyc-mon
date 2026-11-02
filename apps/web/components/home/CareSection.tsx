import { Heading, List, ListItem, Paragraph, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { W01_COPY } from './copy';
import { sectionMarker } from './sections';
import { sectionText, type CmsSectionProps } from './cms';

type CareItem = { verb: string; meter: string; cue: string; answer: string; value: number; color: (typeof W01_COPY.care.items)[number]['color'] };
const METER_FILL = {
  orange: 'border-orange-700 bg-orange-700',
  royal: 'border-royal-700 bg-royal-700',
  leaf: 'border-leaf-700 bg-leaf-700',
} as const;
const METER_LOTS = 10;
function CareMeter({ item, cms }: { item: CareItem } & CmsSectionProps) {
  const filled = Math.round((item.value / 100) * METER_LOTS);
  return <View role="meter" aria-label={sectionText(cms, 'meterLabel', '{meter}, example level').replaceAll('{meter}', item.meter)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.value} aria-valuetext={`${item.value}%`} className="h-5 w-full flex-row gap-1">
    {Array.from({ length: METER_LOTS }, (_, i) => <View key={i} aria-hidden className={`h-full flex-1 border-2 ${i < filled ? METER_FILL[item.color] : 'border-ink-950 bg-transparent'}`} />)}
  </View>;
}
function CareRow({ item, cms }: { item: CareItem } & CmsSectionProps) {
  const copy = W01_COPY.care;
  return <ListItem className="gap-4 border-t-2 border-ink-950 py-6 md:grid md:grid-cols-12 md:items-end md:gap-x-8 md:py-8">
    <Heading level={3} className="my-0 font-display text-display-lg uppercase leading-display text-text md:col-span-4 lg:col-span-5 lg:text-display-2xl lg:leading-display">{item.verb}</Heading>
    <View className="gap-3 md:col-span-5 lg:col-span-4">
      <Paragraph className="my-0 text-base leading-6 text-text"><Text className="font-semibold">{sectionText(cms, 'cueLabel', copy.cueLabel)}: </Text>{item.cue}</Paragraph>
      <Paragraph className="my-0 text-base leading-6 text-text-secondary"><Text className="font-semibold text-text">{sectionText(cms, 'answerLabel', copy.answerLabel)}: </Text>{item.answer}</Paragraph>
    </View>
    <View className="gap-2 md:col-span-3"><Text aria-hidden className="text-sm font-semibold text-text">{item.meter}</Text><CareMeter item={item} cms={cms} /></View>
  </ListItem>;
}
export function CareSection({ cms }: CmsSectionProps = {}) {
  const copy = W01_COPY.care;
  const text = (key: string, fallback: string) => sectionText(cms, key, fallback);
  const items = copy.items.map((item, i): CareItem => ({ ...item, verb: text(`items.${i}.verb`, item.verb), meter: text(`items.${i}.meter`, item.meter), cue: text(`items.${i}.cue`, item.cue), answer: text(`items.${i}.answer`, item.answer) }));
  return <Section {...sectionMarker('care')} aria-labelledby="w01-care-title" data-testid="w01-care" id="trg-care" className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:gap-12 md:py-24 lg:px-8">
    <View id="mfx-care-head" className="gap-5 lg:max-w-4xl">
      <Heading level={2} id="w01-care-title" className="my-0 font-display text-display-md uppercase leading-heading text-text lg:text-display-lg lg:leading-heading xl:text-display-xl xl:leading-heading">{text('title', copy.title)}</Heading>
      <Paragraph className="my-0 max-w-content-measure text-base leading-7 text-text-secondary md:text-lg md:leading-8">{text('body', copy.body)}</Paragraph>
    </View>
    <View id="mfx-care-readout" className="gap-6">
      <List className="m-0 list-none gap-0 border-b-2 border-ink-950 p-0">{items.map((item, i) => <CareRow key={i} item={item} cms={cms} />)}</List>
      <View className="gap-3 md:flex-row md:items-baseline md:justify-between md:gap-8">
        <Paragraph className="my-0 max-w-content-measure font-display text-lg uppercase leading-heading text-orange-700 md:text-xl">{text('closing', copy.closing)}</Paragraph>
        <Paragraph className="my-0 shrink-0 text-sm text-text-muted">{text('example', copy.example)}</Paragraph>
      </View>
    </View>
  </Section>;
}
