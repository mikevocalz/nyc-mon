import type { Meta, StoryObj } from '@storybook/react-vite';
import { FormField } from './FormField';
import { TextField } from './TextField';
import { SegmentedControl } from './SegmentedControl';
import { View } from './tw';
import { CONTROL_TONES, DISTRICTS, DISTRICT_NAME } from './district';

const meta = {
  title: 'UI/FormField',
  component: FormField,
  args: { label: 'Field', children: null },
  argTypes: {
    district: { control: 'inline-radio', options: [undefined, ...DISTRICTS] },
    tone: { control: 'select', options: [undefined, ...CONTROL_TONES] },
  },
} satisfies Meta<typeof FormField>;
export default meta;
type Story = StoryObj<typeof meta>;

const VIEWS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
] as const;

/** FormField wraps any control in the neon nameplate + hint / error shell. */
export const WrappingCustomControls: Story = {
  render: () => (
    <View className="max-w-content-form gap-5 p-4">
      <FormField label="Default view" hint="FormField wraps anything.">
        <SegmentedControl options={VIEWS} value="week" onChange={() => {}} />
      </FormField>
      <FormField label="Calendar view" district="downtown" error="Pick a view to continue.">
        <SegmentedControl district="downtown" options={VIEWS} value="day" onChange={() => {}} />
      </FormField>
      <TextField label="Compare: TextField" placeholder="Composed variant" />
    </View>
  ),
};

/** District showcase. */
export const Districts: Story = {
  render: () => (
    <View className="max-w-content-form gap-5 p-4">
      {DISTRICTS.map((d) => (
        <FormField key={d} district={d} label={DISTRICT_NAME[d]} hint="The nameplate takes the district tone.">
          <SegmentedControl district={d} options={VIEWS} value="week" onChange={() => {}} />
        </FormField>
      ))}
    </View>
  ),
};
