import type { Meta, StoryObj } from '@storybook/react-vite';
import { Menu } from './Menu';
import { Text } from './Text';
import { View } from './tw';
import { DISTRICTS } from './district';

const ACTIONS = [
  { id: 'share', title: 'Share' },
  { id: 'duplicate', title: 'Duplicate' },
  { id: 'archive', title: 'Archive', disabled: true },
  { id: 'delete', title: 'Delete', destructive: true },
] as const;

const meta = {
  title: 'UI/Menu',
  component: Menu,
  args: {
    actions: ACTIONS,
    onAction: () => {},
    children: <Text className="text-lg text-text">⋯</Text>,
  },
} satisfies Meta<typeof Menu>;
export default meta;
type Story = StoryObj<typeof meta>;

// The panel opens over the canvas, so leave room below the trigger for it.
/** Click the trigger to open. Native renders the OS menu. */
export const Default: Story = {
  argTypes: { district: { control: 'inline-radio', options: DISTRICTS } },
  render: (args) => (
    <View className="h-72 items-end p-4">
      <Menu {...args} />
    </View>
  ),
};

export const WithTitle: Story = {
  ...Default,
  args: { title: 'Setlist' },
};
