import type { Meta, StoryObj } from '@storybook/react-vite';
import { Slider } from './Slider';
import { useInstanceStore, useStore } from './use-instance-store';
import { View } from './tw';
import { CONTROL_TONES, DISTRICTS, DISTRICT_NAME } from './district';

const meta = {
  title: 'UI/Slider',
  component: Slider,
  args: { value: 0.4, onValueChange: () => {}, label: 'Playback volume' },
  argTypes: {
    district: { control: 'inline-radio', options: [undefined, ...DISTRICTS] },
    tone: { control: 'select', options: [undefined, ...CONTROL_TONES] },
  },
  decorators: [(S) => <View className="max-w-content-form p-4"><S /></View>],
} satisfies Meta<typeof Slider>;
export default meta;
type Story = StoryObj<typeof meta>;

function LiveSlider(props: React.ComponentProps<typeof Slider>) {
  const store = useInstanceStore(() => ({ value: props.value }));
  const value = useStore(store, (s) => s.value);
  return <Slider {...props} value={value} onValueChange={(v) => store.setState({ value: v })} />;
}

/** No props: night track, Midtown orange fill, white slab thumb. Drag or use the arrow keys. */
export const Default: Story = { render: (args) => <LiveSlider {...args} /> };

export const States: Story = {
  render: () => (
    <View className="gap-5">
      <LiveSlider label="Playback volume" value={0.4} onValueChange={() => {}} />
      <LiveSlider label="Rehearsal length" value={45} min={15} max={120} step={15} onValueChange={() => {}} />
      <Slider label="Locked" value={0.8} onValueChange={() => {}} disabled />
    </View>
  ),
};

/** District showcase. */
export const Districts: Story = {
  render: () => (
    <View className="gap-5">
      {DISTRICTS.map((d, i) => (
        <LiveSlider key={d} district={d} label={`${DISTRICT_NAME[d]} volume`} value={0.25 + i * 0.2} onValueChange={() => {}} />
      ))}
    </View>
  ),
};
