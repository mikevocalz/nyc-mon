import type { Meta, StoryObj } from '@storybook/react-vite';
import { AccentFrame } from './elements/AccentFrame';
import { Heading, Paragraph } from './html';
import { colorControl, DistrictGrid, districtControl } from './progress/story-kit';
import { View } from './tw';

const Copy = () => (
  <View className="gap-1">
    <Heading level={3} className="my-0 font-display text-lg text-ink-50">Madison Square</Heading>
    <Paragraph className="my-0 text-sm text-silver-300">Every block has a legend.</Paragraph>
  </View>
);

const meta = {
  title: 'Elements/Accent frame',
  component: AccentFrame,
  args: {
    district: 'midtown', cornerStyle: 'setback', mode: 'duo', cornerLength: 28, cornerThickness: 5, hoverLength: 48,
    transitionDuration: 300, hoverEffect: 'expand', glowIntensity: 'medium', animated: false, bgVariant: 'subtle',
  },
  argTypes: {
    district: districtControl,
    color: colorControl,
    colorB: colorControl,
    cornerStyle: { control: 'inline-radio', options: ['setback', 'cornice', 'square'] },
    mode: { control: 'inline-radio', options: ['duo', 'quad'] },
    hoverEffect: { control: 'inline-radio', options: ['expand', 'glow', 'pulse', 'flicker', 'none'] },
    glowIntensity: { control: 'inline-radio', options: ['low', 'medium', 'high'] },
    bgVariant: { control: 'inline-radio', options: ['none', 'subtle', 'solid'] },
    cornerLength: { control: { type: 'range', min: 8, max: 64, step: 1 } },
    cornerThickness: { control: { type: 'range', min: 2, max: 12, step: 1 } },
    hoverLength: { control: { type: 'range', min: 8, max: 96, step: 1 } },
  },
  render: (args) => (
    <View className="max-w-md p-8">
      <AccentFrame {...args}><Copy /></AccentFrame>
    </View>
  ),
} satisfies Meta<typeof AccentFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Hover the frame (pointer) to see the effect. */
export const Playground: Story = {};

export const Districts: Story = {
  render: () => (
    <DistrictGrid>
      {(district) => (
        <View className="gap-8 p-3">
          <AccentFrame district={district} cornerStyle="setback" bgVariant="subtle"><Copy /></AccentFrame>
          <AccentFrame district={district} cornerStyle="cornice" mode="quad" bgVariant="solid" cornerLength={36}><Copy /></AccentFrame>
          <AccentFrame district={district} cornerStyle="square" hoverEffect="pulse" animated><Copy /></AccentFrame>
        </View>
      )}
    </DistrictGrid>
  ),
};
