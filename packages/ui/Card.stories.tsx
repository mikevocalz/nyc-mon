import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';
import { Text } from './Text';
import { View } from './tw';

const meta = { title: 'UI/Card', component: Card } satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Elevated: Story = {
  render: () => (
    <Card><Text>Cards group related content on a raised surface.</Text></Card>
  ),
};
export const Flat: Story = {
  render: () => (
    <Card elevation="flat"><Text>Flat card with border.</Text></Card>
  ),
};
export const Raised: Story = {
  render: () => (
    <Card elevation="raised"><Text>Raised card for overlays.</Text></Card>
  ),
};

const DISTRICTS = ['downtown', 'midtown', 'harlem', 'megacity'] as const;
const TONES = [undefined, 'orange', 'royal', 'carolina', 'leaf', 'apple', 'brick'] as const;
const night = (S: React.ComponentType) => <View className="max-w-md bg-ink-950 p-6"><S /></View>;

const neonArgTypes = {
  district: { control: 'inline-radio', options: DISTRICTS },
  tone: { control: 'select', options: TONES },
  size: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'xl'] },
  corner: { control: 'inline-radio', options: ['top-left', 'top-right', 'bottom-right', 'bottom-left', 'all'] },
  beamVariant: { control: 'inline-radio', options: ['single', 'dual', 'pulse'] },
  notchSides: { control: 'check', options: ['top', 'right', 'bottom', 'left'] },
  notchSize: { control: { type: 'range', min: 0, max: 24, step: 1 } },
  notchWidth: { control: { type: 'range', min: 24, max: 160, step: 4 } },
  notchSkew: { control: { type: 'range', min: 0, max: 24, step: 1 } },
  cornerSize: { control: { type: 'range', min: 0, max: 40, step: 2 } },
  duration: { control: { type: 'range', min: 1, max: 12, step: 0.5 } },
} as const;

/** NeonBlade notch card: a solid tone face with notches bitten out of its sides. */
export const Notch: Story = {
  args: {
    variant: 'notch', district: 'midtown', title: 'Empire block',
    description: 'Deco crown, water towers on every other roof, and a line around the block at noon.',
    notchSides: ['top'],
  },
  argTypes: neonArgTypes,
  decorators: [night],
};

/** NeonBlade neon-glow corner-cut card: night face in a heavy tone ring, glow as the accent. */
export const CornerCut: Story = {
  args: {
    variant: 'cornerCut', district: 'downtown', title: 'Wall Street',
    description: 'Twelve narrow blocks of glass and one spire. The tightest streets in the city.',
  },
  argTypes: neonArgTypes,
  decorators: [night],
};

/** NeonBlade border-beam card: a light runs the ring, a Reanimated CSS animation on web. */
export const Beam: Story = {
  args: {
    variant: 'beam', district: 'megacity', title: 'Level 90 bridge',
    description: 'The east sky bridge links four megastructures. Traffic never stops up here.',
    beamVariant: 'single', duration: 4,
  },
  argTypes: neonArgTypes,
  decorators: [night],
};
