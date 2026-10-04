import type { Meta, StoryObj } from '@storybook/react-vite';
import { NeonLineChart } from './charts/NeonLineChart';
import { StoryPage, StoryPanel } from './charts/StoryPanel';
import { DISTRICT_NAMES, DISTRICTS, SIGHTINGS, curveControl, districtControl, glowControl } from './charts/story-fixtures';
import { View } from './tw';

const meta = {
  title: 'Charts/Neon Line Chart',
  component: NeonLineChart,
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'NeonLineChart, the port of NeonBlade neon-line-chart (Neon Line Chart).' } },
  },
  args: {
    data: SIGHTINGS,
    series: [{ dataKey: 'sightings', label: 'Sightings' }, { dataKey: 'catches', label: 'Catches' }],
    district: 'midtown',
    height: 280,
    area: true,
    grid: true,
    keyline: true,
    dots: false,
    curve: 'smooth',
    strokeWidth: 3,
    glowIntensity: 'low',
    showXAxis: true,
    showYAxis: true,
    selectable: true,
    indicator: true,
    title: 'Sightings, 2026',
  },
  argTypes: { district: districtControl, glowIntensity: glowControl, curve: curveControl, color: { control: 'color' } },
} satisfies Meta<typeof NeonLineChart>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop as a control. Hover or drag across the plot to read a month. */
export const Playground: Story = {
  name: 'Neon Line Chart',
  render: (args) => (
    <StoryPage>
      <StoryPanel title="Sightings and catches" note="Hover or drag across the plot to read a month.">
        <NeonLineChart {...args} />
      </StoryPanel>
    </StoryPage>
  ),
};

/** NeonBlade's dots and curve options: markers on each point, straight and stepped lines. */
export const DotsAndCurves: Story = {
  name: 'Dots and curves',
  render: (args) => (
    <StoryPage>
      <View className="gap-4 md:flex-row">
        <View className="md:flex-1">
          <StoryPanel title="Linear with dots">
            <NeonLineChart data={SIGHTINGS} dataKey="sightings" label="Sightings" district={args.district} curve="linear" dots height={200} />
          </StoryPanel>
        </View>
        <View className="md:flex-1">
          <StoryPanel title="Step after">
            <NeonLineChart data={SIGHTINGS} dataKey="catches" label="Catches" district={args.district} curve="stepAfter" area={false} height={200} />
          </StoryPanel>
        </View>
      </View>
    </StoryPage>
  ),
};

/** One district per panel. */
export const Districts: Story = {
  render: () => (
    <StoryPage>
      <View className="gap-4 md:flex-row md:flex-wrap">
        {DISTRICTS.map((d) => (
          <View key={d} className="md:w-[calc(50%-0.5rem)]">
            <StoryPanel title={DISTRICT_NAMES[d]}>
              <NeonLineChart data={SIGHTINGS} dataKey="sightings" label="Sightings" district={d} height={160} />
            </StoryPanel>
          </View>
        ))}
      </View>
    </StoryPage>
  ),
};
