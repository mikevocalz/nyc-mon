import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadingSkeleton } from './LoadingSkeleton';
import { View } from './tw';
import { Text } from './Text';
import { DISTRICTS, DISTRICT_NAME } from './district';

const meta = {
  title: 'UI/LoadingSkeleton',
  component: LoadingSkeleton,
} satisfies Meta<typeof LoadingSkeleton>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No props is a line; the schedule uses `count={6} className="h-12 w-full"`. */
export const Variants: Story = {
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    variant: { control: 'inline-radio', options: ['line', 'card', 'avatar', 'custom'] },
  },
  render: (args) => (
    <View className="max-w-content-feed gap-4 p-4">
      <LoadingSkeleton {...args} />
      <LoadingSkeleton variant="line" count={3} />
      <LoadingSkeleton variant="card" />
      <LoadingSkeleton variant="avatar" />
    </View>
  ),
};

/** The schedule's loading list, and a card per district (window light follows the district). */
export const Districts: Story = {
  render: () => (
    <View className="max-w-content-feed gap-6 p-4">
      <LoadingSkeleton count={6} className="h-12 w-full" />
      {DISTRICTS.map((d) => (
        <View key={d} className="gap-2">
          <Text tone="muted">{DISTRICT_NAME[d]}</Text>
          <View className="flex-row items-center gap-3">
            <LoadingSkeleton variant="avatar" district={d} />
            <View className="flex-1"><LoadingSkeleton variant="card" district={d} /></View>
          </View>
        </View>
      ))}
    </View>
  ),
};
