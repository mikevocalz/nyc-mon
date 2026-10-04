import type { Meta, StoryObj } from '@storybook/react-vite';
import { Timeline, type TimelineItemData } from './elements/Timeline';
import { colorControl, DistrictGrid, districtControl } from './progress/story-kit';
import { View } from './tw';

const LINE: TimelineItemData[] = [
  { date: 'Mon 9:00', title: 'Bowling Green', description: 'Crew formed at the Charging Bull.' },
  { date: 'Mon 12:30', title: 'Union Square', description: 'First block claimed.', badge: 'New' },
  { date: 'Tue 18:00', title: 'Times Sq-42 St', description: 'Holding three blocks in Midtown.', active: true },
  { date: 'Thu', title: '125 St', description: 'Harlem opens after the next win.' },
  { title: 'Mega City', description: 'The last stop. Nobody has made it yet.', badge: 'Soon' },
];

const meta = {
  title: 'Elements/Timeline',
  component: Timeline,
  args: {
    items: LINE, district: 'midtown', variant: 'default', lineStyle: 'solid', dotStyle: 'square', dotAnim: 'ping',
    align: 'left', animate: true, accessibilityLabel: 'Route progress',
  },
  argTypes: {
    district: districtControl,
    color: colorControl,
    variant: { control: 'inline-radio', options: ['default', 'glow', 'minimal', 'stepped'] },
    lineStyle: { control: 'inline-radio', options: ['solid', 'dashed', 'glow', 'none'] },
    dotStyle: { control: 'inline-radio', options: ['circle', 'square', 'diamond'] },
    dotAnim: { control: 'inline-radio', options: ['none', 'pulse', 'ping'] },
    align: { control: 'inline-radio', options: ['left', 'right', 'alternate'] },
  },
  render: (args) => (
    <View className="mx-auto w-full max-w-3xl p-4">
      <Timeline {...args} />
    </View>
  ),
} satisfies Meta<typeof Timeline>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Alternates on wide screens, stacks left on phones. */
export const Alternate: Story = { args: { align: 'alternate', variant: 'stepped' } };

export const Districts: Story = {
  render: () => (
    <DistrictGrid>
      {(district) => (
        <Timeline
          district={district}
          items={LINE.slice(0, 4)}
          variant={district === 'downtown' ? 'minimal' : district === 'harlem' ? 'stepped' : district === 'megacity' ? 'glow' : 'default'}
          lineStyle={district === 'megacity' ? 'dashed' : 'solid'}
          dotStyle={district === 'harlem' ? 'diamond' : 'square'}
          dotAnim="pulse"
        />
      )}
    </DistrictGrid>
  ),
};
