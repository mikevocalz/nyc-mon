import type { Meta, StoryObj } from '@storybook/react-vite';
import { Timestamp } from './Timestamp';
import { View } from './tw';

const meta = {
  title: 'UI/Timestamp',
  component: Timestamp,
  args: { at: Date.now() - 2 * 60_000, format: 'relative' },
} satisfies Meta<typeof Timestamp>;
export default meta;
type Story = StoryObj<typeof meta>;

/** "2 min ago"; the absolute value is in the accessible name. */
export const Relative: Story = {
  render: (args) => (
    <View className="gap-2 p-4">
      <Timestamp {...args} at={Date.now() - 2 * 60_000} />
      <Timestamp {...args} at={Date.now() - 5 * 3600_000} />
      <Timestamp {...args} at={Date.now() - 40 * 24 * 3600_000} />
    </View>
  ),
};

/** The formatted absolute value. */
export const Absolute: Story = { args: { format: 'absolute' } };

/** Relative with the absolute value alongside. */
export const Both: Story = { args: { format: 'both' } };
