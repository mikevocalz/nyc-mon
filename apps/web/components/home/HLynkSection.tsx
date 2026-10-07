import { Heading, List, ListItem, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { DeviceStage } from '../DeviceStage';
import { Eyebrow } from './Eyebrow';
import { W01_COPY } from './copy';

/**
 * The H-Lynk Core as a hardware reveal (W01 §04.D): the device stands on its
 * own dark stage plate — a product pedestal, not a feature demo — while the
 * copy column reads beside it. `mfx-hlynk-*` marks the scroll-scrubbed beats
 * authored in ./motion.ts: the device settles, the scan line sweeps, and the
 * feature lines resolve in order.
 */
export function HLynkSection() {
  const copy = W01_COPY.hlynk;
  return (
    <Section
      aria-labelledby="w01-hlynk-title"
      data-testid="w01-hlynk"
      id="trg-hlynk"
      className="mx-auto w-full max-w-screen-xl items-center gap-10 px-4 py-16 sm:px-6 md:flex-row md:gap-14 md:py-28 lg:px-8"
    >
      <View id="mfx-hlynk-copy" className="w-full min-w-0 gap-5 md:flex-1">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <Heading
          level={2}
          id="w01-hlynk-title"
          className="my-0 font-display text-3xl uppercase leading-heading tracking-tight text-text md:text-5xl"
        >
          {copy.title}
        </Heading>
        <Paragraph className="my-0 max-w-content-measure text-base leading-7 text-text-secondary md:text-lg md:leading-8">
          {copy.body}
        </Paragraph>
        <List className="m-0 list-none gap-3 p-0">
          {copy.features.map((feature, i) => (
            <ListItem key={feature} id={`mfx-hlynk-feat-${i}`} className="flex-row items-center gap-3">
              <View className="h-2 w-2 bg-apple-500" aria-hidden />
              <Paragraph className="my-0 text-sm font-semibold text-text-secondary md:text-base">{feature}</Paragraph>
            </ListItem>
          ))}
        </List>
        <Paragraph className="my-0 max-w-content-measure text-sm leading-6 text-text-muted md:text-base">
          {copy.body2}
        </Paragraph>
      </View>
      <View className="w-full min-w-0 max-w-md md:flex-1">
        <View id="mfx-hlynk-device" className="scheme-dark bg-ink-950 px-6 py-10 md:px-10 md:py-12">
          <DeviceStage model="placeholder" caption={copy.caption} label={copy.stageLabel} />
        </View>
        <View
          id="mfx-hlynk-scan"
          className="h-0.5 w-full origin-left bg-apple-500"
          aria-hidden
        />
      </View>
    </Section>
  );
}
