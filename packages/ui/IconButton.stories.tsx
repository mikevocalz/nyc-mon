import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from './IconButton';
import { Text } from './Text';
import { View } from './tw';

const meta = {
  title: 'UI/IconButton',
  component: IconButton,
  args: { icon: <Text>＋</Text>, 'aria-label': 'Add' },
} satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <View className="flex-row gap-3 p-4">
      <IconButton icon={<Text className="text-on-primary">＋</Text>} aria-label="Primary" />
      <IconButton variant="ghost" icon={<Text>＋</Text>} aria-label="Ghost" />
      <IconButton variant="outline" icon={<Text>＋</Text>} aria-label="Outline" />
      <IconButton disabled icon={<Text className="text-on-primary">＋</Text>} aria-label="Disabled" />
    </View>
  ),
};

/** Corner-cut icon buttons per district; the last is disabled. */
export const CornerCut: Story = {
  render: () => (
    <View className="flex-row gap-4 bg-ink-950 p-6">
      <IconButton variant="cornerCut" district="downtown" icon={<Text className="font-display text-white">＋</Text>} aria-label="Add a Downtown block" />
      <IconButton variant="cornerCut" district="midtown" icon={<Text className="font-display text-ink-950">＋</Text>} aria-label="Add a Midtown block" />
      <IconButton variant="cornerCut" district="harlem" corner="top-left" icon={<Text className="font-display text-white">＋</Text>} aria-label="Add a Harlem block" />
      <IconButton variant="cornerCut" district="megacity" size="lg" icon={<Text className="font-display text-ink-950">＋</Text>} aria-label="Add a Mega City block" />
      <IconButton variant="cornerCut" disabled icon={<Text className="font-display text-ink-700">＋</Text>} aria-label="Add (disabled)" />
    </View>
  ),
};
