import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedControl } from './SegmentedControl';
import { useInstanceStore, useStore } from './use-instance-store';
import { View } from './tw';
import { CONTROL_TONES, DISTRICTS, DISTRICT_NAME, type ControlTone, type District } from './district';
import { Heading } from './Heading';

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

const DISTRICT_OPTIONS = DISTRICTS.map((value) => ({ value, label: DISTRICT_NAME[value] }));

function LiveDistricts({ label }: { label: string }) {
  const store = useInstanceStore<{ value: District }>(() => ({ value: 'megacity' }));
  const value = useStore(store, (s) => s.value);
  return (
    <SegmentedControl
      aria-label={label}
      options={DISTRICT_OPTIONS}
      value={value}
      onChange={(v) => store.setState({ value: v })}
      district={value}
    />
  );
}

/**
 * Narrow parents: the well wraps onto a second row instead of clipping, so
 * "Mega City" stays visible and tappable at a 280px phone panel. Keyboard:
 * Tab reaches only the checked radio; arrows move and select with wrap,
 * Home/End jump.
 */
export const Narrow: Story = {
  render: () => (
    <View className="gap-6 p-4">
      <View className="w-[280px] gap-2 border-2 border-dashed border-ink-700 p-2">
        <LiveDistricts label="District (280px)" />
      </View>
      <View className="w-[348px] gap-2 border-2 border-dashed border-ink-700 p-2">
        <LiveDistricts label="District (348px)" />
      </View>
    </View>
  ),
};

/** Named by a visible heading through aria-labelledby. */
export const LabelledBy: Story = {
  render: () => {
    const Example = () => {
      const store = useInstanceStore<{ value: Range }>(() => ({ value: 'month' }));
      const value = useStore(store, (s) => s.value);
      return (
        <View className="gap-2 p-4">
          <Heading level={3} id="range-heading">Range</Heading>
          <SegmentedControl aria-labelledby="range-heading" options={RANGE} value={value} onChange={(v) => store.setState({ value: v })} />
        </View>
      );
    };
    return <Example />;
  },
};
