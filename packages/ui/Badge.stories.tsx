import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import { View } from './tw';
import { DISTRICTS } from './district';

const meta = { title: 'UI/Badge', component: Badge, args: { label: 'Badge' } } satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Tones: Story = {
  render: () => (
    <View className="flex-row flex-wrap gap-2 p-4">
      <Badge label="Neutral" />
      <Badge label="Primary" tone="primary" />
      <Badge label="Accent" tone="accent" />
      <Badge label="Success" tone="success" />
      <Badge label="Danger" tone="danger" />
    </View>
  ),
};


/** The neon variant: every district, fill, size and status light. */
export const Neon: Story = {
  args: { variant: 'neon', label: 'Live', district: 'midtown', fill: 'solid', size: 'sm', shape: 'pill', dot: 'pulse', glow: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'neon'] },
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
          <Badge variant="neon" district={district} label={district === 'megacity' ? 'Mega City' : district[0]!.toUpperCase() + district.slice(1)} size="md" />
          <Badge variant="neon" district={district} label="Outline" fill="outline" />
          <Badge variant="neon" district={district} label="Ghost" fill="ghost" />
          <Badge variant="neon" district={district} label="On air" dot="pulse" shape="rectangle" />
          <Badge variant="neon" district={district} label="New" size="xs" glow />
        </View>
      ))}
    </View>
  ),
};
