import type { Meta, StoryObj } from '@storybook/react-vite';
import { SignageBand } from './SignageBand';
import { Button } from './Button';
import { View } from './tw';

const meta = { title: 'UI/SignageBand' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The Overview integrity band, healthy. */
export const Healthy: Story = {
  render: () => (
    <View className="p-4">
      <SignageBand tone="signage" headline="Integrity" detail="Last run clean — 0 mismatches across eggs and Mons." />
    </View>
  ),
};

/** The same band failing, with the run action. */
export const Failing: Story = {
  render: () => (
    <View className="p-4">
      <SignageBand
        tone="danger"
        headline="Integrity failing"
        detail="3 egg records point at missing Mons."
        action={<Button title="Run check" variant="outline" size="sm" onPress={() => {}} />}
      />
    </View>
  ),
};

/** The 44 px global alert strip above the pane row. */
export const Strip: Story = {
  render: () => (
    <View className="p-4">
      <SignageBand tone="danger" size="strip" headline="Integrity failing" detail="Open Integrity" />
    </View>
  ),
};
