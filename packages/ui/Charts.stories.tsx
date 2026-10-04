import type { Meta, StoryObj } from '@storybook/react-vite';
import { NeonBarChart } from './charts/NeonBarChart';
import { NeonDonutChart } from './charts/NeonDonutChart';
import { NeonLineChart } from './charts/NeonLineChart';
import { NeonSparkline } from './charts/NeonSparkline';
import { StatCard } from './charts/StatCard';
import type { District } from './charts/district-tones';
import { BOROUGHS, DISTRICT_NAMES, SIGHTINGS, SPARK, SPARK_DOWN, TYPES, districtControl } from './charts/story-fixtures';
import { Heading } from './html';
import { StoryPanel } from './charts/StoryPanel';
import { View } from './tw';

const meta: Meta = {
  title: 'Charts/All charts',
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
    docs: { description: { component: 'Every NeonBlade chart port on one page: Neon Line Chart, Neon Bar Chart, Neon Donut Chart, Neon Sparkline, Stat Card. Each also has its own story under Charts.' } },
  },
};
export default meta;

const Panel = StoryPanel;

/**
 * Every chart on one page, themed by the district control. One district at a
 * time: each Skia surface on web holds a WebGL context and Chrome keeps about
 * sixteen, so four districts of everything would drop the oldest canvases.
 */
export const All: StoryObj<{ district: District }> = {
  name: 'All charts',
  args: { district: 'midtown' },
  argTypes: { district: districtControl },
  render: ({ district }) => (
    <View className="min-h-screen gap-4 bg-ink-950 p-4 md:p-8">
      <Heading level={1} className="my-0 font-display text-3xl text-white md:text-4xl">{DISTRICT_NAMES[district]}</Heading>
      <View className="gap-4 md:flex-row md:flex-wrap">
        <View className="md:w-[calc(50%-0.5rem)]">
          <Panel title="Sightings and catches">
            <NeonLineChart
              data={SIGHTINGS}
              series={[{ dataKey: 'sightings', label: 'Sightings' }, { dataKey: 'catches', label: 'Catches' }]}
              district={district}
              height={220}
            />
          </Panel>
        </View>
        <View className="md:w-[calc(50%-0.5rem)]">
          <Panel title="Catches by borough">
            <NeonBarChart data={BOROUGHS} dataKey="catches" label="Catches" district={district} height={220} />
          </Panel>
        </View>
        <View className="md:w-[calc(50%-0.5rem)]">
          <Panel title="Where legends turn up">
            <NeonDonutChart data={TYPES} district={district} height={220} />
          </Panel>
        </View>
        <View className="md:w-[calc(50%-0.5rem)]">
          <Panel title="Catches and legends">
            <NeonBarChart
              data={BOROUGHS}
              series={[{ dataKey: 'catches', label: 'Catches' }, { dataKey: 'legends', label: 'Legends' }]}
              layout="horizontal"
              district={district}
              height={220}
            />
          </Panel>
        </View>
        <View className="gap-4 md:w-[calc(50%-0.5rem)] md:flex-row">
          <StatCard className="md:flex-1" label="Legends caught" value="1,284" trend="up" change="+12.4%" changeLabel="vs last week" sparkData={SPARK} district={district} />
          <StatCard className="md:flex-1" label="Avg. chase" value="38" unit="s" trend="down" change="-4.1%" changeLabel="vs last week" sparkData={SPARK_DOWN} color="royal" district={district} />
        </View>
        <View className="md:w-[calc(50%-0.5rem)]">
          <Panel title="Sparklines">
            <View className="flex-row flex-wrap items-center gap-6">
              <NeonSparkline data={SPARK} district={district} width={140} height={40} label="Sightings" />
              <NeonSparkline data={SPARK_DOWN} district={district} width={140} height={40} label="Chase time" keyline />
            </View>
          </Panel>
        </View>
      </View>
    </View>
  ),
};

