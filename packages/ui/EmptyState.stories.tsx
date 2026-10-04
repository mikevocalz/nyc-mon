import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from './EmptyState';
import { Button } from './Button';
import { View } from './tw';
import { Calendar, Users } from './icons';
import { DISTRICTS, DISTRICT_NAME } from './district';

const meta = {
  title: 'UI/EmptyState',
  component: EmptyState,
  args: {
    icon: <Calendar size={30} className="text-text-muted" />,
    title: 'Nothing here yet',
  },
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    tone: { control: 'select', options: [undefined, 'orange', 'royal', 'carolina', 'leaf', 'apple', 'brick'] },
  },
};
export const WithAction: Story = {
  args: {
    description: 'Content appears here once it has been added.',
    action: <Button title="Refresh" variant="outline" size="sm" onPress={() => {}} />,
  },
};

/** One per district, with the copy the schedule and staff panes use. */
export const Districts: Story = {
  render: () => (
    <View className="gap-2 md:flex-row md:flex-wrap">
      {DISTRICTS.map((d) => (
        <EmptyState
          key={d}
          district={d}
          icon={<Users size={30} className="text-text-muted" />}
          title={`${DISTRICT_NAME[d]}: no staff yet`}
          description="Add someone to the studio to see them here."
        />
      ))}
    </View>
  ),
};
