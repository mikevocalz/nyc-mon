import type { Meta, StoryObj } from '@storybook/react-vite';
import { Heading } from './Heading';
import { DISTRICTS, DISTRICT_NAME } from './district';
import { View } from './tw';

const meta = {
  title: 'UI/Heading',
  component: Heading,
  args: { children: 'Every block has a legend', size: 'display-md', tone: 'default', district: 'midtown' },
  argTypes: {
    size: { control: 'select', options: ['display-2xl', 'display-xl', 'display-lg', 'display-md', 'display-sm', 'title'] },
    tone: { control: 'select', options: ['default', 'muted', 'primary', 'accent', 'inverse', 'district'] },
    district: { control: 'inline-radio', options: DISTRICTS },
  },
} satisfies Meta<typeof Heading>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: () => (
    <View className="gap-3 p-4">
      <Heading level={1} size="display-xl">Display XL</Heading>
      <Heading level={2} size="display-lg">Display LG</Heading>
      <Heading level={2} size="display-md">Display MD</Heading>
      <Heading level={3} size="display-sm">Display SM</Heading>
      <Heading level={3} size="title" tone="accent">Title accent</Heading>
    </View>
  ),
};

export const Playground: Story = {
  render: (args) => (
    <View className="bg-ink-950 p-4">
      <Heading {...args} />
    </View>
  ),
};

/** tone="district" on night. */
export const Districts: Story = {
  render: () => (
    <View className="gap-2 bg-ink-950 p-4">
      {DISTRICTS.map((d) => (
        <Heading key={d} level={2} size="display-sm" tone="district" district={d}>{DISTRICT_NAME[d]}</Heading>
      ))}
    </View>
  ),
};
