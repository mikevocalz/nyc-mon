import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banner } from './Banner';
import { Button } from './Button';
import { View } from './tw';

const meta = { title: 'UI/Banner' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Masking notice, info tone. */
export const Info: Story = {
  render: () => (
    <View className="max-w-2xl p-4">
      <Banner tone="info" title="Emails are masked" description="Show a value only with a reason; every reveal is audited." />
    </View>
  ),
};

/** A block that failed to load, with a retry action. */
export const Danger: Story = {
  render: () => (
    <View className="max-w-2xl p-4">
      <Banner tone="danger" title="Couldn't load Callers" description="The read failed before any data left the server." />
    </View>
  ),
};

/** With an action. */
export const WithAction: Story = {
  render: () => (
    <View className="max-w-2xl p-4">
      <Banner
        tone="danger"
        title="Couldn't load Callers"
        action={<Button title="Try again" variant="outline" size="sm" onPress={() => {}} />}
      />
    </View>
  ),
};
