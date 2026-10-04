import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toolbar } from './Toolbar';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { ChevronLeft } from './icons';
import { CONTROL_TONES, DISTRICTS, DISTRICT_NAME } from './district';
import { View } from './tw';

const meta = {
  title: 'UI/Toolbar',
  component: Toolbar,
  args: { title: 'Repertoire', district: 'midtown' },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    tone: { control: 'select', options: [undefined, ...CONTROL_TONES] },
  },
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLeadingAndActions: Story = {
  render: (args) => (
    <Toolbar
      {...args}
      leading={<IconButton icon={<ChevronLeft size={20} className="text-ink-50" />} variant="ghost" aria-label="Back" onPress={() => {}} />}
      actions={
        <>
          <Button title="Filter" variant="ghost" size="sm" district={args.district} onPress={() => {}} />
          <Button title="Add" size="sm" district={args.district} onPress={() => {}} />
        </>
      }
    />
  ),
};

export const ActionsOnly: Story = {
  args: {
    title: undefined,
    actions: <Button title="Done" variant="ghost" size="sm" onPress={() => {}} />,
  },
};

export const Districts: Story = {
  render: () => (
    <View className="gap-4">
      {DISTRICTS.map((d) => (
        <Toolbar
          key={d}
          title={DISTRICT_NAME[d]}
          district={d}
          actions={<Button title="Add" size="sm" district={d} onPress={() => {}} />}
        />
      ))}
    </View>
  ),
};
