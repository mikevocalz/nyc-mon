import { Heading, List, ListItem, Paragraph, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { W01_COPY } from './copy';
import { sectionMarker } from './sections';

type CareItem = (typeof W01_COPY.care.items)[number];

/** Filled-lot colour per meter, at the 700 step so a lot holds 3:1 on the daylight surface. */
const METER_FILL = {
  orange: 'border-orange-700 bg-orange-700',
  royal: 'border-royal-700 bg-royal-700',
  leaf: 'border-leaf-700 bg-leaf-700',
} as const satisfies Record<CareItem['color'], string>;

const METER_LOTS = 10;

/**
 * A care meter as static markup: `role="meter"` with min/max/now and a
 * value text, ten lots filled solid up to the level and left hollow above
 * it, so filled versus empty never depends on colour. Server-rendered at its
 * value: nothing counts up, nothing pulses, and no animation library ships
 * for it (the kit's ProgressBar pulled Reanimated onto `/`).
 */
function CareMeter({ item }: { item: CareItem }) {
  const filled = Math.round((item.value / 100) * METER_LOTS);
  return (
    <View
      role="meter"
      aria-label={W01_COPY.care.meterLabel(item.meter)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={item.value}
      aria-valuetext={`${item.value}%`}
      className="h-5 w-full flex-row gap-1"
    >
      {Array.from({ length: METER_LOTS }, (_, i) => (
        <View
          key={i}
          aria-hidden
          className={`h-full flex-1 border-2 ${i < filled ? METER_FILL[item.color] : 'border-ink-950 bg-transparent'}`}
        />
      ))}
    </View>
  );
}

/**
 * One care row: the verb set large is the row's visual, then what your Mon
 * does and what you do, then the meter it moves. The meter is a small
 * illustration under the words; its accessible name carries the meter name
 * and "example level", its value the level.
 */
function CareRow({ item }: { item: CareItem }) {
  const copy = W01_COPY.care;
  return (
    <ListItem className="gap-4 border-t-2 border-ink-950 py-6 md:grid md:grid-cols-12 md:items-end md:gap-x-8 md:py-8">
      <Heading
        level={3}
        className="my-0 font-display text-display-lg uppercase leading-display text-text md:col-span-4 lg:col-span-5 lg:text-display-2xl lg:leading-display"
      >
        {item.verb}
      </Heading>
      <View className="gap-3 md:col-span-5 lg:col-span-4">
        <Paragraph className="my-0 text-base leading-6 text-text">
          <Text className="font-semibold">{copy.cueLabel}: </Text>
          {item.cue}
        </Paragraph>
        <Paragraph className="my-0 text-base leading-6 text-text-secondary">
          <Text className="font-semibold text-text">{copy.answerLabel}: </Text>
          {item.answer}
        </Paragraph>
      </View>
      <View className="gap-2 md:col-span-3">
        {/* The visible name only: the level is the skyline, never a percentage on screen. */}
        <Text aria-hidden className="text-sm font-semibold text-text">
          {item.meter}
        </Text>
        <CareMeter item={item} />
      </View>
    </ListItem>
  );
}

/**
 * CARE (PS-021): one care stage. Feed, Rest and Play are three rows led by
 * the verb in display type; each says what your Mon does and what you do,
 * and only then shows the meter the answer fills, at a small size and
 * labelled as an example. The meter is plain markup (`CareMeter`). No percentages on screen, no streak, no alarm
 * colour for a low level. The Mon reaction art (`care` slot) would make
 * this a bento; until it exists the section stays one composition.
 * `mfx-care-head` and `mfx-care-readout` are the entrance in ./motion.ts.
 */
export function CareSection() {
  const copy = W01_COPY.care;
  return (
    <Section
      {...sectionMarker('care')}
      aria-labelledby="w01-care-title"
      data-testid="w01-care"
      id="trg-care"
      className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:gap-12 md:py-24 lg:px-8"
    >
      <View id="mfx-care-head" className="gap-5 lg:max-w-4xl">
        <Heading
          level={2}
          id="w01-care-title"
          className="my-0 font-display text-display-md uppercase leading-heading text-text lg:text-display-lg lg:leading-heading xl:text-display-xl xl:leading-heading"
        >
          {copy.title}
        </Heading>
        <Paragraph className="my-0 max-w-content-measure text-base leading-7 text-text-secondary md:text-lg md:leading-8">
          {copy.body}
        </Paragraph>
      </View>
      <View id="mfx-care-readout" className="gap-6">
        <List className="m-0 list-none gap-0 border-b-2 border-ink-950 p-0">
          {copy.items.map((item) => (
            <CareRow key={item.verb} item={item} />
          ))}
        </List>
        <View className="gap-3 md:flex-row md:items-baseline md:justify-between md:gap-8">
          <Paragraph className="my-0 max-w-content-measure font-display text-lg uppercase leading-heading text-orange-700 md:text-xl">
            {copy.closing}
          </Paragraph>
          <Paragraph className="my-0 shrink-0 text-sm text-text-muted">{copy.example}</Paragraph>
        </View>
      </View>
    </Section>
  );
}
