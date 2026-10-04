import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select } from './Select';
import { View } from './tw';
import { CONTROL_TONES, DISTRICTS } from './district';

const meta = {
  title: 'UI/Select',
  component: Select,
  args: { label: 'Role' },
  argTypes: {
    district: { control: 'inline-radio', options: [undefined, ...DISTRICTS] },
    tone: { control: 'select', options: [undefined, ...CONTROL_TONES] },
  },
} satisfies Meta<typeof Select>;
export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: () => (
    <View className="max-w-content-form gap-4 p-4">
      <Select label="Role" value="editor">
        <option value="viewer">Viewer</option>
        <option value="editor">Editor</option>
        <option value="admin">Admin</option>
        <option value="owner">Owner</option>
      </Select>
      <Select label="Team" error="Choose a team." value="">
        <option value="">—</option>
        <option value="design">Design</option>
      </Select>
      <Select label="Locked" disabled value="editor">
        <option value="editor">Editor</option>
      </Select>
    </View>
  ),
};

const DISTRICT_OPTIONS = [
  { value: 'downtown', label: 'Downtown' },
  { value: 'midtown', label: 'Midtown' },
  { value: 'harlem', label: 'Harlem' },
  { value: 'megacity', label: 'Mega City' },
];

/** District showcase, options passed as data (NeonBlade's API). */
export const Neon: Story = {
  render: () => (
    <View className="max-w-content-form gap-5 p-4">
      <Select district="downtown" label="Home district" value="downtown" options={DISTRICT_OPTIONS} />
      <Select district="midtown" label="Rival district" value="harlem" options={DISTRICT_OPTIONS} />
      <Select district="harlem" label="Missing" value="" error="Choose a district." options={[{ value: '', label: 'Choose one' }, ...DISTRICT_OPTIONS]} />
      <Select district="megacity" label="Locked" disabled value="megacity" options={DISTRICT_OPTIONS} />
    </View>
  ),
};

/** Rounding is opt-in: `rounded` softens the well and the open list together. */
export const Rounded: Story = {
  render: () => (
    <View className="max-w-content-form gap-4 p-4">
      <Select rounded district="megacity" label="Rounded" value="midtown" options={DISTRICT_OPTIONS} />
    </View>
  ),
};
