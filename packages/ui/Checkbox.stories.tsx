import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './Checkbox';
import { useInstanceStore, useStore } from './use-instance-store';
import { View } from './tw';

const meta = {
  title: 'UI/Checkbox',
  component: Checkbox,
  args: { checked: false, onChange: () => {}, label: 'Accept terms' },
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: () => (
    <View className="gap-3 p-4">
      <Checkbox checked={false} onChange={() => {}} label="Unchecked" />
      <Checkbox checked onChange={() => {}} label="Checked" />
      <Checkbox checked={false} onChange={() => {}} label="Disabled" disabled />
      <Checkbox checked onChange={() => {}} label="Checked disabled" disabled />
    </View>
  ),
};

function NeonDemo() {
  const store = useInstanceStore(() => ({ downtown: true, midtown: false, harlem: true, megacity: false }));
  const values = useStore(store);
  return (
    <View className="gap-2 bg-ink-950 p-6">
      {(['downtown', 'midtown', 'harlem', 'megacity'] as const).map((d) => (
        <Checkbox
          key={d}
          variant="neon"
          district={d}
          checked={values[d]}
          onChange={(next) => store.setState({ [d]: next })}
          label={`Follow ${d === 'megacity' ? 'Mega City' : d[0]!.toUpperCase() + d.slice(1)}`}
        />
      ))}
      <Checkbox variant="neon" checked onChange={() => {}} label="Locked" disabled />
    </View>
  );
}

/** Neon checkbox: a solid tile that fills with the district tone. Click to toggle. */
export const Neon: Story = { render: () => <NeonDemo /> };
