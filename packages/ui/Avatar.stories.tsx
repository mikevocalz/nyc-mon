import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './Avatar';
import { Text } from './Text';
import { View } from './tw';
import { DISTRICTS, DISTRICT_NAME } from './district';

const PHOTO = 'https://i.pravatar.cc/256?img=5';

const meta = { title: 'UI/Avatar', component: Avatar, args: { name: 'Maya Rodriguez' } } satisfies Meta<typeof Avatar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: () => (
    <View className="flex-row items-end gap-3 p-4">
      <Avatar name="Maya Rodriguez" size="sm" />
      <Avatar name="Maya Rodriguez" size="md" />
      <Avatar name="Maya Rodriguez" size="lg" />
      <Avatar name="Maya Rodriguez" size="xl" />
    </View>
  ),
};

export const WithImage: Story = {
  render: () => (
    <View className="flex-row items-end gap-3 p-4">
      <Avatar name="Maya Rodriguez" imageUri={PHOTO} size="sm" />
      <Avatar name="Maya Rodriguez" imageUri={PHOTO} size="md" />
      <Avatar name="Maya Rodriguez" imageUri={PHOTO} size="lg" />
      <Avatar name="Maya Rodriguez" imageUri={PHOTO} size="xl" />
      <Avatar name="Fallback Initials" size="xl" />
    </View>
  ),
};

/** Tile colour by district, and the `md:h-11 md:w-11` override the split layout passes to a small avatar. */
export const Districts: Story = {
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    tone: { control: 'select', options: [undefined, 'orange', 'royal', 'carolina', 'leaf', 'apple', 'brick'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'xl'] },
  },
  render: (args) => (
    <View className="gap-4 p-4">
      <Avatar {...args} />
      <View className="flex-row flex-wrap items-end gap-3">
        {DISTRICTS.map((d) => <Avatar key={d} name={DISTRICT_NAME[d]} district={d} size="lg" />)}
        <Avatar name="Apple Tone" tone="apple" size="lg" />
        <Avatar name="Leaf Tone" tone="leaf" size="lg" />
      </View>
      <View className="flex-row items-center gap-2">
        <Avatar size="sm" className="md:h-11 md:w-11" name="Row Override" />
        <Text>Row override: sm, md:h-11</Text>
      </View>
    </View>
  ),
};
