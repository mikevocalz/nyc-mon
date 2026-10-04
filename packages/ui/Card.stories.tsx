import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';
import { Text } from './Text';
import { View } from './tw';
import { DISTRICTS, DISTRICT_NAME } from './district';

const meta = { title: 'UI/Card', component: Card } satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

const SettingsBody = () => (
  <>
    <View className="gap-1">
      <Text variant="heading">Preferences</Text>
      <Text variant="caption" tone="muted">Notifications and visibility.</Text>
    </View>
    <Text>Cards hold whatever a screen drops in: headings, rows, controls.</Text>
  </>
);

/** No props: the corner-cut facade in the district tone (Midtown orange), glow off. */
export const Elevated: Story = {
  args: { className: 'gap-4' },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    elevation: { control: 'inline-radio', options: ['flat', 'card', 'raised'] },
    glow: { control: 'boolean' },
    padded: { control: 'boolean' },
  },
  render: (args) => (
    <View className="max-w-md">
      <Card {...args}><SettingsBody /></Card>
    </View>
  ),
};
/** elevation="flat" drops the depth plate. */
export const Flat: Story = {
  render: () => (
    <View className="max-w-md"><Card elevation="flat"><Text>Flat card: ring only, no plate.</Text></Card></View>
  ),
};
/** elevation="raised" steps the plate further out. */
export const Raised: Story = {
  render: () => (
    <View className="max-w-md"><Card elevation="raised"><Text>Raised card for overlays.</Text></Card></View>
  ),
};

/** The default card in each district, as screens use it (children only, className gap). */
export const Districts: Story = {
  render: () => (
    <View className="gap-6 md:flex-row md:flex-wrap">
      {DISTRICTS.map((d) => (
        <Card key={d} district={d} className="gap-3 md:w-80">
          <Text variant="heading">{DISTRICT_NAME[d]}</Text>
          <Text tone="muted">Sign out on this device only.</Text>
        </Card>
      ))}
    </View>
  ),
};

/** The facade keeps its own night scheme, so token text inside stays legible on a light page. */
export const OnLightPage: Story = {
  render: () => (
    <View className="scheme-light gap-4 bg-surface p-6">
      <Text>The page is light; the card is still night.</Text>
      <View className="max-w-md"><Card className="gap-4"><SettingsBody /></Card></View>
    </View>
  ),
};

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
