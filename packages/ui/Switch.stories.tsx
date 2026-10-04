import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from './Switch';
import { useInstanceStore, useStore } from './use-instance-store';
import { View } from './tw';
import { DISTRICTS } from './district';

const meta = {
  title: 'UI/Switch',
  component: Switch,
  args: { value: false, onChange: () => {}, label: 'Rehearsal reminders' },
} satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: () => (
    <View className="gap-3 p-4">
      <Switch value={false} onChange={() => {}} label="Off" />
      <Switch value onChange={() => {}} label="On" />
      <Switch value={false} onChange={() => {}} label="Disabled" disabled />
    </View>
  ),
};

function NeonDemo() {
  const store = useInstanceStore(() => ({ downtown: true, midtown: false, harlem: true, megacity: false }));
  const values = useStore(store);
  return (
    <View className="max-w-content-form gap-4 bg-ink-950 p-6">
      {DISTRICTS.map((d) => (
        <Switch
          key={d}
          variant="neon"
          district={d}
          value={values[d]}
          onChange={(next) => store.setState({ [d]: next })}
          label={`${d === 'megacity' ? 'Mega City' : d[0]!.toUpperCase() + d.slice(1)} alerts`}
        />
      ))}
      <Switch variant="neon" value onChange={() => {}} label="Locked" disabled />
    </View>
  );
}

/** Neon toggle: the track fills with the district tone, the thumb slides (instant under reduced motion). */
export const Neon: Story = { render: () => <NeonDemo /> };
