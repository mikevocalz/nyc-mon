import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text } from './Text';
import { Heading, Paragraph, Section } from './html';
import { View } from './tw';

const meta: Meta<typeof Text> = {
  title: 'Text',
  component: Text,
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
};
export default meta;
type Story = StoryObj<typeof Text>;

const colorControl = { control: 'inline-radio', options: ['orange', 'royal', 'carolina', 'leaf', 'apple', 'white'] } as const;
const glowControl = { control: 'inline-radio', options: ['none', 'subtle', 'normal', 'strong', 'intense'] } as const;

function Row({ name, note, children }: { name: string; note: string; children: React.ReactNode }) {
  return (
    <Section className="gap-3 border-b-2 border-ink-800 pb-8">
      <Heading level={2} className="my-0 text-sm font-semibold text-silver-400">{name}</Heading>
      {children}
      <Paragraph className="my-0 max-w-xl text-sm text-silver-500">{note}</Paragraph>
    </Section>
  );
}

/** The four NeonBlade effects as variants of the kit Text. */
export const All: Story = {
  render: () => (
    <View className="min-h-screen gap-8 bg-ink-950 p-4 md:p-10">
      <Row name='variant="glitch"' note="Solid misprint layers that jump in bursts. Hover (or hold a finger on) the first; the second runs on its own. Reduced motion keeps the still misprint.">
        <Text variant="glitch">Every block</Text>
        <Text variant="glitch" mode="active" intensity="heavy" colorA="royal" colorB="orange">has a legend</Text>
      </Row>
      <Row name='variant="neonGlow"' note="Solid letters on a drop stack, glow as the accent. The second pulses its glow.">
        <Text variant="neonGlow" colors={['orange', 'royal', '#00041C']} glowIntensity="none">Harlem</Text>
        <Text variant="neonGlow" colors="carolina" glowIntensity="strong" animate>Mega City</Text>
      </Row>
      <Row name='variant="outline"' note="Badge lettering: orange on a royal outline, like the wordmark. Hover to light it; the second is outline only.">
        <Text variant="outline" hoverFillColor="white" glowColor="carolina">NYC-MON</Text>
        <Text variant="outline" fillColor="transparent" strokeColor="orange" strokeWidth={2}>Midtown</Text>
      </Row>
      <Row name='variant="blur"' note="Soft until the pointer reaches it on web. Touch screens get it sharp; native plays a short focus-in.">
        <Text variant="blur">Look closer to read the block.</Text>
      </Row>
    </View>
  ),
};

export const Glitch: Story = {
  args: { variant: 'glitch', children: 'Every block', mode: 'active', intensity: 'normal', speed: 'normal', colorA: 'pink', colorB: 'cyan', colors: 'white', glowIntensity: 'none' },
  argTypes: {
    mode: { control: 'inline-radio', options: ['hover', 'active'] },
    intensity: { control: 'inline-radio', options: ['subtle', 'normal', 'heavy', 'chaos'] },
    speed: { control: 'inline-radio', options: ['slow', 'normal', 'fast', 'frenzy'] },
    colorA: { control: 'color' },
    colorB: { control: 'color' },
    glowIntensity: glowControl,
  },
  render: (args) => (
    <View className="min-h-screen bg-ink-950 p-4 md:p-10">
      <Text {...args} />
    </View>
  ),
};

export const NeonGlow: Story = {
  args: { variant: 'neonGlow', children: 'Mega City', colors: ['orange', 'royal'], glowIntensity: 'normal', animate: false },
  argTypes: { glowIntensity: glowControl, glowColor: colorControl },
  render: (args) => (
    <View className="min-h-screen bg-ink-950 p-4 md:p-10">
      <Text {...args} />
    </View>
  ),
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'NYC-MON', fillColor: 'orange', strokeColor: 'royal', strokeWidth: 3, hoverFillColor: 'white', glowIntensity: 'normal' },
  argTypes: {
    fillColor: { control: 'inline-radio', options: ['orange', 'white', 'carolina', 'transparent'] },
    strokeColor: colorControl,
    strokeWidth: { control: { type: 'range', min: 1, max: 6, step: 1 } },
    glowIntensity: glowControl,
  },
  render: (args) => (
    <View className="min-h-screen bg-ink-950 p-4 md:p-10">
      <Text {...args} />
    </View>
  ),
};

export const Blur: Story = {
  args: { variant: 'blur', children: 'Look closer to read the block.', colors: 'white' },
  argTypes: { colors: colorControl },
  render: (args) => (
    <View className="min-h-screen bg-ink-950 p-4 md:p-10">
      <Text {...args} />
    </View>
  ),
};
