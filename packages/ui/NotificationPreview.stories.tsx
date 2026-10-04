import type { Meta, StoryObj } from '@storybook/react-vite';
import { NotificationPreview } from './NotificationPreview';
import { View } from './tw';

const meta = {
  title: 'UI/NotificationPreview',
  component: NotificationPreview,
  args: {
    appName: 'NYC-MON',
    title: 'Someone is at the hatch',
    body: 'Tap to answer.',
    time: 'Now',
  },
} satisfies Meta<typeof NotificationPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A typical OS notification banner preview. */
export const Default: Story = {
  render: (args) => (
    <View className="p-4">
      <NotificationPreview {...args} />
    </View>
  ),
};

/** The body clamps to two lines to preserve the banner shape. */
export const LongBody: Story = {
  args: {
    body:
      'Your Mon has been waiting at the 14th Street hatch for a while. Tap here to open the hatch and let them in before they get rained on.',
  },
  render: (args) => (
    <View className="p-4">
      <NotificationPreview {...args} />
    </View>
  ),
};

/** The white banner stays legible against a dark surface. */
export const Dark: Story = {
  render: (args) => (
    <View className="bg-ink-950 p-4">
      <NotificationPreview {...args} />
    </View>
  ),
};
