import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select } from './Select';
import { View } from './tw';

const meta = {
  title: 'UI/Select',
  component: Select,
  args: { label: 'Role' },
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

/** Neon select, options passed as data (NeonBlade's API). */
export const Neon: Story = {
  render: () => (
    <View className="max-w-content-form gap-5 bg-ink-950 p-6">
      <Select variant="neon" district="downtown" label="Home district" value="downtown" options={DISTRICT_OPTIONS} />
      <Select variant="neon" district="midtown" label="Rival district" value="harlem" options={DISTRICT_OPTIONS} />
      <Select variant="neon" district="harlem" label="Missing" value="" error="Choose a district." options={[{ value: '', label: 'Choose one' }, ...DISTRICT_OPTIONS]} />
      <Select variant="neon" district="megacity" label="Locked" disabled value="megacity" options={DISTRICT_OPTIONS} />
    </View>
  ),
};
