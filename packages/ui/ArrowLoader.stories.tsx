import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowLoader } from './progress/ArrowLoader';
import { colorControl, DistrictGrid, districtControl } from './progress/story-kit';
import { View } from './tw';

const meta = {
  title: 'Progress/Arrow loader',
  component: ArrowLoader,
  args: { height: 24, speed: 900, count: 10, direction: 'right', district: 'midtown', indeterminate: true },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    district: districtControl,
    color: colorControl,
    height: { control: { type: 'range', min: 10, max: 48, step: 2 } },
    count: { control: { type: 'range', min: 3, max: 24, step: 1 } },
    speed: { control: { type: 'range', min: 200, max: 3000, step: 50 } },
    direction: { control: 'inline-radio', options: ['right', 'left'] },
  },
  render: (args) => (
    <View className="max-w-xl p-4">
      <ArrowLoader {...args} />
    </View>
  ),
} satisfies Meta<typeof ArrowLoader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithValue: Story = { args: { indeterminate: false, value: 40 } };

export const Districts: Story = {
  render: () => (
    <DistrictGrid>
      {(district) => (
        <View className="gap-3">
          <ArrowLoader district={district} />
          <ArrowLoader district={district} height={14} count={16} direction="left" />
          <ArrowLoader district={district} height={28} value={70} />
        </View>
      )}
    </DistrictGrid>
  ),
};
