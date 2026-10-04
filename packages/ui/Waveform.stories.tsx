import type { Meta, StoryObj } from '@storybook/react-vite';
import { Waveform } from './audio/Waveform.tsx';
import { CONTROL_TONES, DISTRICTS, DISTRICT_NAME } from './district';
import { Text, View } from './tw';

const LEVELS = Array.from({ length: 48 }, (_, i) => 0.1 + 0.9 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.21)));

const meta = {
  title: 'UI/Waveform',
  component: Waveform,
  args: { levels: LEVELS, progress: 0.4, height: 56, district: 'midtown' },
  argTypes: {
    progress: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    height: { control: { type: 'range', min: 24, max: 120, step: 4 } },
    district: { control: 'inline-radio', options: DISTRICTS },
    tone: { control: 'select', options: [undefined, ...CONTROL_TONES] },
    levels: { control: false },
  },
  decorators: [(Story) => <View className="bg-ink-900 p-4">{Story()}</View>],
} satisfies Meta<typeof Waveform>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Played bars in the tone face, the rest in its deep step. */
export const Default: Story = {};

/** No progress: a live recording, every bar lit. Short input grows from the right. */
export const Recording: Story = {
  args: { progress: undefined, levels: LEVELS.slice(0, 20) },
};

export const Districts: Story = {
  render: (args) => (
    <View className="gap-4">
      {DISTRICTS.map((d) => (
        <View key={d} className="gap-1">
          <Text className="font-display text-sm text-ink-50">{DISTRICT_NAME[d]}</Text>
          <Waveform levels={LEVELS} progress={args.progress} height={48} district={d} />
        </View>
      ))}
    </View>
  ),
};
