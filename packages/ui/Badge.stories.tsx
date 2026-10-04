import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import { View } from './tw';
import { DISTRICTS } from './district';

const meta = { title: 'UI/Badge', component: Badge, args: { label: 'Badge' } } satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No props renders the district chip; the legacy semantic tones map onto brand tones. */
export const Tones: Story = {
  args: { label: 'Booking' },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    tone: { control: 'select', options: [undefined, 'neutral', 'primary', 'accent', 'success', 'info', 'inverse', 'danger'] },
  },
  render: (args) => (
    <View className="gap-4 p-4">
      <Badge {...args} />
      <View className="flex-row flex-wrap gap-3">
        <Badge label="Neutral" tone="neutral" />
        <Badge label="Primary" tone="primary" />
        <Badge label="Accent" tone="accent" />
        <Badge label="Success" tone="success" />
        <Badge label="Info" tone="info" />
        <Badge label="Inverse" tone="inverse" />
        <Badge label="Danger" tone="danger" />
      </View>
    </View>
  ),
};

/** Every district, fill, size and status light. */
export const Neon: Story = {
  args: { label: 'Live', district: 'midtown', fill: 'solid', size: 'sm', shape: 'rectangle', dot: 'pulse', glow: false },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    fill: { control: 'inline-radio', options: ['solid', 'outline', 'ghost'] },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md'] },
    shape: { control: 'inline-radio', options: ['pill', 'rectangle'] },
    dot: { control: 'inline-radio', options: ['none', 'solid', 'pulse', 'flicker'] },
    color: { control: 'select', options: [undefined, 'orange', 'royal', 'carolina', 'leaf', 'apple', 'brick', 'white', 'cyan', 'pink'] },
  },
  render: (args) => (
    <View className="gap-5 p-4">
      <Badge {...args} />
      {DISTRICTS.map((district) => (
        <View key={district} className="flex-row flex-wrap items-center gap-3">
          <Badge district={district} label={district === 'megacity' ? 'Mega City' : district[0]!.toUpperCase() + district.slice(1)} size="md" />
          <Badge district={district} label="Outline" fill="outline" />
          <Badge district={district} label="Ghost" fill="ghost" />
          <Badge district={district} label="On air" dot="pulse" shape="rectangle" />
          <Badge district={district} label="New" size="xs" glow />
        </View>
      ))}
    </View>
  ),
};

/** Rounding is opt-in: `rounded` (or shape="pill") makes the chip a pill. */
export const Rounded: Story = {
  args: { label: 'Rounded' },
  render: () => (
    <View className="flex-row gap-3 bg-ink-950 p-6">
      <Badge label="Square (default)" />
      <Badge label="Pill" rounded />
    </View>
  ),
};
