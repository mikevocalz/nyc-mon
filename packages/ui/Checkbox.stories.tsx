import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './Checkbox';
import { useInstanceStore, useStore } from './use-instance-store';
import { View } from './tw';
import { CONTROL_TONES, DISTRICTS, DISTRICT_NAME } from './district';

const meta = {
  title: 'UI/Checkbox',
  component: Checkbox,
  args: { checked: false, onChange: () => {}, label: 'Accept terms' },
  argTypes: {
    district: { control: 'inline-radio', options: [undefined, ...DISTRICTS] },
    tone: { control: 'select', options: [undefined, ...CONTROL_TONES] },
  },
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No variant: the neon tile. Unchecked, checked, disabled, and an error. */
export const States: Story = {
  render: () => (
    <View className="gap-3 p-4">
      <Checkbox checked={false} onChange={() => {}} label="Unchecked" />
      <Checkbox checked onChange={() => {}} label="Checked" />
      <Checkbox checked={false} onChange={() => {}} label="Disabled" disabled />
      <Checkbox checked onChange={() => {}} label="Checked disabled" disabled />
      <Checkbox checked={false} onChange={() => {}} label="Accept the house rules" error="Tick this to join the crew." />
    </View>
  ),
};

function DistrictDemo() {
  const store = useInstanceStore(() => ({ downtown: true, midtown: false, harlem: true, megacity: false }));
  const values = useStore(store);
  return (
    <View className="gap-2 p-4">
      {DISTRICTS.map((d) => (
        <Checkbox
          key={d}
          district={d}
          checked={values[d]}
          onChange={(next) => store.setState({ [d]: next })}
          label={`Follow ${DISTRICT_NAME[d]}`}
        />
      ))}
    </View>
  );
}

/** District showcase: the tile fills with each district's tone. Click to toggle. */
export const Neon: Story = { render: () => <DistrictDemo /> };
