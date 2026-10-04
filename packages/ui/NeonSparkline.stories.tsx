import type { Meta, StoryObj } from '@storybook/react-vite';
import { NeonSparkline } from './charts/NeonSparkline';
import { StoryPage, StoryPanel } from './charts/StoryPanel';
import { DISTRICT_NAMES, DISTRICTS, SPARK, SPARK_DOWN, curveControl, districtControl, glowControl } from './charts/story-fixtures';
import { Paragraph } from './html';
import { View } from './tw';

const meta = {
  title: 'Charts/Neon Sparkline',
  component: NeonSparkline,
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'NeonSparkline, the port of NeonBlade neon-sparkline (Neon Sparkline).' } },
  },
  args: { data: SPARK, width: 160, height: 44, strokeWidth: 2, area: true, tooltip: true, curve: 'smooth', district: 'midtown', glowIntensity: 'none', keyline: false, label: 'Sightings' },
  argTypes: { district: districtControl, glowIntensity: glowControl, curve: curveControl, color: { control: 'color' } },
} satisfies Meta<typeof NeonSparkline>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Hover to read a value in the corner. */
export const Playground: Story = {
  name: 'Neon Sparkline',
  render: (args) => (
    <StoryPage>
      <StoryPanel title="Sightings this year" note="Hover to read a value.">
        <NeonSparkline {...args} />
      </StoryPanel>
    </StoryPage>
  ),
};

export const Districts: Story = {
  render: () => (
    <StoryPage>
      <View className="gap-3">
        {DISTRICTS.map((d) => (
          <View key={d} className="flex-row items-center gap-4">
            <Paragraph className="my-0 w-24 text-sm text-silver-300">{DISTRICT_NAMES[d]}</Paragraph>
            <NeonSparkline data={SPARK} district={d} width={120} height={32} />
            <NeonSparkline data={SPARK_DOWN} district={d} width={120} height={32} curve="step" />
          </View>
        ))}
      </View>
    </StoryPage>
  ),
};
