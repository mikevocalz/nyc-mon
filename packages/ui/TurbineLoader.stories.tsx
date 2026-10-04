import type { Meta, StoryObj } from '@storybook/react-vite';
import { colorControl, DistrictGrid, districtControl } from './progress/story-kit';
import { TurbineLoader } from './progress/TurbineLoader';
import { View } from './tw';

const meta = {
  title: 'Progress/Rooftop loader',
  component: TurbineLoader,
  args: { size: 'lg', bladeCount: 5, speed: 1400, direction: 'clockwise', hubSize: 0.26, bladeWidth: 0.34, glowIntensity: 'medium', district: 'midtown', indeterminate: true },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    district: districtControl,
    color: colorControl,
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    bladeCount: { control: { type: 'range', min: 3, max: 8, step: 1 } },
    speed: { control: { type: 'range', min: 300, max: 4000, step: 100 } },
    direction: { control: 'inline-radio', options: ['clockwise', 'counter-clockwise'] },
    hubSize: { control: { type: 'range', min: 0.1, max: 0.5, step: 0.02 } },
    bladeWidth: { control: { type: 'range', min: 0.15, max: 0.6, step: 0.02 } },
    glowIntensity: { control: 'inline-radio', options: ['none', 'low', 'medium', 'high'] },
  },
  render: (args) => (
    <View className="p-4">
      <TurbineLoader {...args} />
    </View>
  ),
} satisfies Meta<typeof TurbineLoader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithValue: Story = { args: { indeterminate: false, value: 60 } };

export const Districts: Story = {
  render: () => (
    <DistrictGrid>
      {(district) => (
        <View className="flex-row flex-wrap items-end gap-6">
          <TurbineLoader district={district} size="xs" />
          <TurbineLoader district={district} size="md" />
          <TurbineLoader district={district} size="lg" value={70} />
        </View>
      )}
    </DistrictGrid>
  ),
};
