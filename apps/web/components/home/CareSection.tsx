import { ProgressBar } from '@acme/ui/progress';
import { Heading, List, ListItem, Paragraph, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { Eyebrow } from './Eyebrow';
import { W01_COPY } from './copy';

/**
 * Care as a relationship, not a dashboard (W01 §04.F): the verbs Feed / Rest /
 * Play carry the left column, and the three meters live inside a framed
 * "H-Lynk care readout" — the device showing you how your Mon is doing —
 * instead of floating as anonymous dashboard rows.
 */
export function CareSection() {
  const copy = W01_COPY.care;
  return (
    <Section
      aria-labelledby="w01-care-title"
      data-testid="w01-care"
      id="trg-care"
      className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:flex-row md:items-center md:gap-14 md:py-28 lg:px-8"
    >
      <View id="mfx-care-head" className="min-w-0 gap-5 md:flex-1">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <Heading
          level={2}
          id="w01-care-title"
          className="my-0 font-display text-3xl uppercase leading-[1.02] tracking-tight text-text md:text-5xl"
        >
          {copy.title}
        </Heading>
        <Paragraph className="my-0 max-w-[34rem] text-base leading-7 text-text-secondary md:text-lg md:leading-8">
          {copy.body}
        </Paragraph>
        <Paragraph className="my-0 font-display text-lg uppercase tracking-tight text-orange-600 md:text-xl">
          {copy.closing}
        </Paragraph>
      </View>
      <View id="mfx-care-readout" className="w-full min-w-0 md:flex-1">
        {/* Fixed night plate — the H-Lynk readout is dark in both schemes;
            scheme-dark rescopes the semantic tokens (text, meters) inside. */}
        <View className="scheme-dark gap-6 border-2 border-ink-950 bg-ink-950 px-5 py-6 md:px-7 md:py-8">
          <Text className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-ink-300">
            {copy.panelLabel}
          </Text>
          <List className="m-0 list-none gap-6 p-0">
            {copy.items.map((item) => (
              <ListItem key={item.verb} className="gap-2">
                <View className="flex-row items-baseline justify-between gap-4">
                  <Heading level={3} className="my-0 font-display text-xl uppercase text-ink-50">
                    {item.verb}
                  </Heading>
                  <Paragraph className="my-0 max-w-[16rem] text-right text-xs leading-5 text-silver-400">
                    {item.line}
                  </Paragraph>
                </View>
                <ProgressBar
                  value={item.value}
                  color={item.color}
                  variant="segmented"
                  size="sm"
                  showLabel
                  label={item.meter}
                  glow={false}
                  role="meter"
                  accessibilityLabel={item.meter}
                />
              </ListItem>
            ))}
          </List>
          <Paragraph className="my-0 text-[11px] uppercase tracking-[0.18em] text-ink-400">{copy.example}</Paragraph>
        </View>
      </View>
    </Section>
  );
}
