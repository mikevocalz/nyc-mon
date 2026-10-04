import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedControl } from './SegmentedControl';
import { useInstanceStore, useStore } from './use-instance-store';
import { View } from './tw';
import { CONTROL_TONES, DISTRICTS, type ControlTone, type District } from './district';

const RANGE = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
] as const;
type Range = (typeof RANGE)[number]['value'];

// Generic component: a bare Meta, as with DataTable — `typeof SegmentedControl`
// cannot be pinned to one option type.
const meta: Meta<{ district?: District; tone?: ControlTone }> = {
  title: 'UI/SegmentedControl',
  argTypes: {
    district: { control: 'inline-radio', options: [undefined, ...DISTRICTS] },
    tone: { control: 'select', options: [undefined, ...CONTROL_TONES] },
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

function Live({ district, tone }: { district?: District; tone?: ControlTone }) {
  const store = useInstanceStore<{ value: Range }>(() => ({ value: 'week' }));
  const value = useStore(store, (s) => s.value);
  return <SegmentedControl options={RANGE} value={value} onChange={(v) => store.setState({ value: v })} district={district} tone={tone} />;
}

/** No props: night well, active segment a solid Midtown orange face. Click to switch. */
export const Selection: Story = {
  render: (args) => (
    <View className="max-w-content-form gap-4 p-4">
      <Live {...args} />
      <SegmentedControl options={RANGE} value="year" onChange={() => {}} />
      <SegmentedControl
        options={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread' },
        ]}
        value="unread"
        onChange={() => {}}
      />
    </View>
  ),
};

/** District showcase. */
export const Districts: Story = {
  render: () => (
    <View className="gap-4 p-4">
      {DISTRICTS.map((d) => (
        <SegmentedControl key={d} district={d} options={RANGE} value="month" onChange={() => {}} />
      ))}
    </View>
  ),
};
