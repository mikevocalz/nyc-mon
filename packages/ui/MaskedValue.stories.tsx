import type { Meta, StoryObj } from '@storybook/react-vite';
import { MaskedValue } from './MaskedValue';
import { View } from './tw';

const meta = { title: 'UI/MaskedValue' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The server mask plus the Show affordance. */
export const Masked: Story = {
  render: () => (
    <View className="w-96 p-4">
      <MaskedValue state="masked" mask="d•••@g•••.com" onRevealRequest={() => {}} />
      <MaskedValue state="masked" mask="Hidden" onRevealRequest={() => {}} />
    </View>
  ),
};

/** The revealed value plus Hide. */
export const Revealed: Story = {
  render: () => (
    <View className="w-96 p-4">
      <MaskedValue state="revealed" value="dana@example.com" onHide={() => {}} />
    </View>
  ),
};

/** A long revealed value wraps instead of pushing the Hide button out. */
export const LongValue: Story = {
  render: () => (
    <View className="w-80 p-4">
      <MaskedValue state="revealed" value="a.guardian.with.a.very.long.address@guardian.example.org" onHide={() => {}} />
    </View>
  ),
};
