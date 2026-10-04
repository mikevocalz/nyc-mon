import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from './Switch';
import { useInstanceStore, useStore } from './use-instance-store';
import { View } from './tw';
import { CONTROL_TONES, DISTRICTS, DISTRICT_NAME } from './district';

const meta = {
  title: 'UI/Switch',
  component: Switch,
  args: { value: false, onChange: () => {}, label: 'Rehearsal reminders' },
  argTypes: {
    district: { control: 'inline-radio', options: [undefined, ...DISTRICTS] },
    tone: { control: 'select', options: [undefined, ...CONTROL_TONES] },
  },
} satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No variant: the neon toggle, off, on and disabled. */
export const States: Story = {
  render: () => (
    <View className="max-w-content-form gap-4 p-4">
      <Switch value={false} onChange={() => {}} label="Off" />
      <Switch value onChange={() => {}} label="On" />
      <Switch value={false} onChange={() => {}} label="Disabled" disabled />
      <Switch value onChange={() => {}} label="On, disabled" disabled />
    </View>
  ),
};

function DistrictDemo() {
  const store = useInstanceStore(() => ({ downtown: true, midtown: false, harlem: true, megacity: false }));
  const values = useStore(store);
  return (
    <View className="max-w-content-form gap-4 p-4">
      {DISTRICTS.map((d) => (
        <Switch
          key={d}
          district={d}
          value={values[d]}
          onChange={(next) => store.setState({ [d]: next })}
          label={`${DISTRICT_NAME[d]} alerts`}
        />
      ))}
    </View>
  );
}

/** District showcase: the track fills with each district's tone; the thumb slides (instant under reduced motion). */
export const Neon: Story = { render: () => <DistrictDemo /> };
