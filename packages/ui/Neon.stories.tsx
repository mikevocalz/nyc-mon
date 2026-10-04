import type { Meta, StoryObj } from '@storybook/react-vite';
import { Heading, Paragraph, Section } from './html';
import { CornerCutFrame } from './neon/CornerCutFrame';
import { shadeSteps } from './neon/shade';
import { SolidPanel, type SolidTone } from './neon/SolidPanel';
import { View } from './tw';

const meta = {
  title: 'Foundation/Neon primitives',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const TONES: SolidTone[] = ['orange', 'royal', 'carolina', 'leaf', 'apple', 'ink'];
const STEPS = ['highlight', 'top', 'face', 'side', 'deep', 'shadow'] as const;
// Royal, apple and ink faces are dark enough to need light text (see neonColor().on).
const LABEL: Record<SolidTone, string> = {
  orange: 'text-ink-950', carolina: 'text-ink-950', leaf: 'text-ink-950',
  royal: 'text-ink-50', apple: 'text-ink-50', ink: 'text-ink-50',
};

/** Shade steps, solid panels and corner-cut frames: the building blocks the NeonBlade ports reuse. */
export const Primitives: Story = {
  render: () => (
    <View className="min-h-screen gap-10 bg-ink-950 p-6 md:p-10">
      <Section className="gap-4">
        <Heading level={2} className="my-0 font-display text-xl text-ink-50">Shade steps</Heading>
        <Paragraph className="my-0 max-w-prose text-sm text-silver-300">
          Depth comes from stacking these steps of one family. shadeSteps() returns them for canvas and GPU code.
        </Paragraph>
        <View className="gap-2">
          {TONES.map((tone) => (
            <View key={tone} className="flex-row">
              {STEPS.map((step) => (
                // Computed: swatch colour read from shadeSteps(), the function under demonstration.
                <View key={step} className="h-8 flex-1" style={{ backgroundColor: shadeSteps(tone)[step] }} />
              ))}
            </View>
          ))}
        </View>
      </Section>

      <Section className="gap-4">
        <Heading level={2} className="my-0 font-display text-xl text-ink-50">Solid panels</Heading>
        <View className="flex-row flex-wrap gap-4">
          {TONES.map((tone) => (
            <SolidPanel key={tone} tone={tone} className="px-5 py-4">
              <Paragraph className={`my-0 font-display text-base ${LABEL[tone]}`}>{tone}</Paragraph>
            </SolidPanel>
          ))}
        </View>
      </Section>

      <Section className="gap-4">
        <Heading level={2} className="my-0 font-display text-xl text-ink-50">Corner-cut frames</Heading>
        <View className="flex-row flex-wrap items-start gap-6">
          <CornerCutFrame className="px-6 py-4">
            <Paragraph className="my-0 font-bold text-ink-950">Solid, bottom-right</Paragraph>
          </CornerCutFrame>
          <CornerCutFrame tone="cyan" variant="outline" corner="all" className="px-6 py-4">
            <Paragraph className="my-0 font-bold text-carolina-500">Outline, cyan preset</Paragraph>
          </CornerCutFrame>
          <CornerCutFrame tone="royal" corner="top-left" glow className="px-6 py-4">
            <Paragraph className="my-0 font-bold text-ink-50">Royal with glow accent</Paragraph>
          </CornerCutFrame>
        </View>
      </Section>
    </View>
  ),
};
