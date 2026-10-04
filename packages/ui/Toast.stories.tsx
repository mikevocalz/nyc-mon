import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toast } from './Toast';
import { View } from './tw';

const meta = {
  title: 'UI/Toast',
  component: Toast,
  args: { title: 'Downloaded', description: 'Total Praise · Alto part is available offline.' },
} satisfies Meta<typeof Toast>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <View className="max-w-content-form gap-3 p-4">
      <Toast variant="info" title="Update available" description="A new version is ready to install." />
      <Toast variant="success" title="RSVP saved" />
      <Toast variant="error" title="Upload failed" description="Check your connection and retry." />
    </View>
  ),
};

/** The neon storefront card: what `notify.*(title, { variant: 'neon', district })` shows. */
export const Neon: Story = {
  args: { appearance: 'neon', district: 'midtown', variant: 'info' },
  argTypes: {
    appearance: { control: 'inline-radio', options: ['default', 'neon'] },
    district: { control: 'inline-radio', options: ['downtown', 'midtown', 'harlem', 'megacity'] },
    variant: { control: 'inline-radio', options: ['info', 'success', 'error'] },
  },
  render: (args) => (
    <View className="max-w-content-form gap-4 p-4">
      <Toast {...args} />
      <Toast appearance="neon" district="downtown" variant="success" title="Ticket saved" description="Knicks at the Garden, Friday 7:30." />
      <Toast appearance="neon" district="harlem" variant="error" title="Upload failed" description="Check your connection and try again." />
      <Toast appearance="neon" district="megacity" title="New block unlocked" description="Hudson Yards is on the map." />
    </View>
  ),
};
