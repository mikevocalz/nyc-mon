import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusRow } from './StatusRow';
import { View } from './tw';

const meta = { title: 'UI/StatusRow', component: StatusRow } satisfies Meta<typeof StatusRow>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A single pending-consent chip, mapped to the neutral status tone. */
export const Pending: Story = {
  args: {
    items: [{ id: 'pending', label: 'Waiting for a grown-up', tone: 'pending' }],
  },
  render: (args) => (
    <View className="p-4">
      <StatusRow {...args} />
    </View>
  ),
};

/** An offline chip, mapped onto the danger tone so it reads as an error state. */
export const Offline: Story = {
  args: {
    items: [{ id: 'offline', label: 'Offline', tone: 'offline' }],
  },
  render: (args) => (
    <View className="p-4">
      <StatusRow {...args} />
    </View>
  ),
};

/** Both onboarding statuses in one row. */
export const Both: Story = {
  args: {
    items: [
      { id: 'pending', label: 'Waiting for a grown-up', tone: 'pending' },
      { id: 'offline', label: 'Offline', tone: 'offline' },
    ],
  },
  render: (args) => (
    <View className="p-4">
      <StatusRow {...args} />
    </View>
  ),
};

/** `request`: a Mon's need (M13–M16). Neutral text with a filled dot, never the danger tone. Story fixture copy. */
export const Request: Story = {
  args: {
    items: [{ id: 'request-food', label: 'Hungry', tone: 'request' }],
  },
  render: (args) => (
    <View className="p-4">
      <StatusRow {...args} />
    </View>
  ),
};
