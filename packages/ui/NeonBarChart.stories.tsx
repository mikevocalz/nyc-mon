import type { Meta, StoryObj } from '@storybook/react-vite';
import { NeonBarChart } from './charts/NeonBarChart';
import { StoryPage, StoryPanel } from './charts/StoryPanel';
import { BOROUGHS, DISTRICT_NAMES, DISTRICTS, districtControl, glowControl } from './charts/story-fixtures';
import { View } from './tw';

const meta = {
  title: 'Charts/Neon Bar Chart',
  component: NeonBarChart,
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'NeonBarChart, the port of NeonBlade neon-bar-chart (Neon Bar Chart), drawn as a block of buildings.' } },
  },
  args: {
    data: BOROUGHS,
    series: [{ dataKey: 'catches', label: 'Catches' }],
    district: 'midtown',
    height: 280,
    layout: 'vertical',
    barGap: 0.35,
    radius: 0,
    grid: true,
    windows: true,
    crown: true,
    multiColor: false,
    glowIntensity: 'medium',
    showXAxis: true,
    showYAxis: true,
    title: 'Catches by borough',
  },
  argTypes: {
    district: districtControl,
    glowIntensity: glowControl,
    layout: { control: 'inline-radio', options: ['vertical', 'horizontal'] },
    barGap: { control: { type: 'range', min: 0, max: 0.9, step: 0.05 } },
    radius: { control: { type: 'range', min: 0, max: 12, step: 1 } },
  },
} satisfies Meta<typeof NeonBarChart>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop as a control. Hover a building (or tap it) to read its values. */
export const Playground: Story = {
  name: 'Neon Bar Chart',
  render: (args) => (
    <StoryPage>
      <StoryPanel title="Catches by borough" note="Hover or tap a building to read it.">
        <NeonBarChart {...args} />
      </StoryPanel>
    </StoryPage>
  ),
};

/** Two series side by side, horizontal, and the multi-colour single series. */
export const Layouts: Story = {
  render: (args) => (
    <StoryPage>
      <StoryPanel title="Catches and legends, horizontal">
        <NeonBarChart
          data={BOROUGHS}
          series={[{ dataKey: 'catches', label: 'Catches' }, { dataKey: 'legends', label: 'Legends' }]}
          layout="horizontal"
          district={args.district}
          height={260}
        />
      </StoryPanel>
      <StoryPanel title="Multi-colour, rounded">
        <NeonBarChart data={BOROUGHS} dataKey="catches" label="Catches" district={args.district} multiColor radius={4} height={220} />
      </StoryPanel>
    </StoryPage>
  ),
};

export const Districts: Story = {
  render: () => (
    <StoryPage>
      <View className="gap-4 md:flex-row md:flex-wrap">
        {DISTRICTS.map((d) => (
          <View key={d} className="md:w-[calc(50%-0.5rem)]">
            <StoryPanel title={DISTRICT_NAMES[d]}>
              <NeonBarChart data={BOROUGHS} dataKey="catches" label="Catches" district={d} height={180} />
            </StoryPanel>
          </View>
        ))}
      </View>
    </StoryPage>
  ),
};
