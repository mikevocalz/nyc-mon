import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabBarAccessory } from './TabBarAccessory';
import { CONTROL_TONES, DISTRICTS, DISTRICT_NAME, DISTRICT_TONE, TONE_CLASSES } from './district';
import { View, Text } from './tw';

const meta = {
  title: 'UI/TabBarAccessory',
  component: TabBarAccessory,
  args: {
    district: 'midtown',
    children: <Text className="text-sm text-ink-50">Your download is ready to view</Text>,
  },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    color: { control: 'select', options: [undefined, ...CONTROL_TONES] },
    tone: { control: 'inline-radio', options: ['default', 'accent'] },
  },
} satisfies Meta<typeof TabBarAccessory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Pressable: Story = {
  args: {
    onPress: () => {},
    'aria-label': 'Open the mini player',
    children: (
      <View className="flex-row items-center gap-3">
        <Text className="font-display text-sm text-ink-50">Now playing</Text>
        <Text className="text-sm text-silver-300">Ride On, King Jesus</Text>
      </View>
    ),
  },
};

export const AccentTone: Story = {
  args: {
    tone: 'accent',
    children: (
      <Text className={`font-display text-sm ${TONE_CLASSES.orange.onFace}`}>
        Download in progress: 3 of 12 tracks
      </Text>
    ),
  },
};

export const Districts: Story = {
  render: () => (
    <View className="gap-4">
      {DISTRICTS.map((d) => (
        <View key={d} className="gap-2">
          <TabBarAccessory district={d}>
            <Text className="font-display text-sm text-ink-50">{DISTRICT_NAME[d]}</Text>
            <Text className="text-sm text-silver-300">Rooftop set starts at 9</Text>
          </TabBarAccessory>
          <TabBarAccessory district={d} tone="accent">
            <Text className={`font-display text-sm ${TONE_CLASSES[DISTRICT_TONE[d]].onFace}`}>{DISTRICT_NAME[d]}: 3 of 12 tracks</Text>
          </TabBarAccessory>
        </View>
      ))}
    </View>
  ),
};
