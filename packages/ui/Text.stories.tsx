import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text } from './Text';
import { DISTRICTS, DISTRICT_NAME } from './district';
import { View } from './tw';

const meta = {
  title: 'UI/Text',
  component: Text,
  args: { children: 'Every block has a legend', variant: 'body', tone: 'default', district: 'midtown' },
  argTypes: {
    variant: { control: 'select', options: ['display', 'title', 'heading', 'body', 'caption', 'label', 'glitch', 'neonGlow', 'outline', 'blur'] },
    tone: { control: 'select', options: ['default', 'muted', 'accent', 'primary', 'inverse', 'danger', 'district'] },
    district: { control: 'inline-radio', options: DISTRICTS },
  },
} satisfies Meta<typeof Text>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The scale. Display, title and heading set in the display face; body copy stays in the sans. */
export const Variants: Story = {
  render: () => (
    <View className="gap-2 p-4">
      <Text variant="display">Display</Text>
      <Text variant="title">Title</Text>
      <Text variant="heading">Heading</Text>
      <Text variant="body">Body: comfortable reading size for paragraphs.</Text>
      <Text variant="caption" tone="muted">Caption, muted</Text>
      <Text variant="label" tone="accent">Label, accent</Text>
    </View>
  ),
};

export const Playground: Story = {
  render: (args) => (
    <View className="bg-ink-950 p-4">
      <Text {...args} />
    </View>
  ),
};

/** tone="district" on night: each district's AA text step. */
export const Districts: Story = {
  render: () => (
    <View className="gap-3 bg-ink-950 p-4 md:flex-row md:flex-wrap">
      {DISTRICTS.map((d) => (
        <View key={d} className="gap-1 border-2 border-ink-800 bg-ink-900 p-4 md:w-64">
          <Text variant="heading" tone="district" district={d}>{DISTRICT_NAME[d]}</Text>
          <Text variant="body" className="text-silver-300">Tonight on the block: rooftop sets from 9.</Text>
          <Text variant="label" tone="district" district={d}>Get tickets</Text>
        </View>
      ))}
    </View>
  ),
};
