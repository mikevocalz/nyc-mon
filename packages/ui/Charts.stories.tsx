import type { Meta, StoryObj } from '@storybook/react-vite';
import { NeonBarChart } from './charts/NeonBarChart';
import { NeonDonutChart } from './charts/NeonDonutChart';
import { NeonLineChart } from './charts/NeonLineChart';
import { NeonSparkline } from './charts/NeonSparkline';
import { StatCard } from './charts/StatCard';
import { DISTRICTS, DISTRICT_NAMES, type District } from './district';
import { Heading, Paragraph, Section } from './html';
import { View } from './tw';


const SIGHTINGS = [
  { name: 'Jan', sightings: 420, catches: 160 },
  { name: 'Feb', sightings: 380, catches: 190 },
  { name: 'Mar', sightings: 610, catches: 240 },
  { name: 'Apr', sightings: 540, catches: 310 },
  { name: 'May', sightings: 820, catches: 400 },
  { name: 'Jun', sightings: 940, catches: 470 },
  { name: 'Jul', sightings: 1180, catches: 520 },
  { name: 'Aug', sightings: 1090, catches: 610 },
  { name: 'Sep', sightings: 870, catches: 560 },
  { name: 'Oct', sightings: 990, catches: 640 },
  { name: 'Nov', sightings: 760, catches: 590 },
  { name: 'Dec', sightings: 1240, catches: 720 },
];

const BOROUGHS = [
  { name: 'Manhattan', catches: 1240, legends: 38 },
  { name: 'Brooklyn', catches: 980, legends: 31 },
  { name: 'Queens', catches: 760, legends: 22 },
  { name: 'Bronx', catches: 540, legends: 19 },
  { name: 'Staten Is.', catches: 210, legends: 7 },
];

const TYPES = [
  { name: 'Street', value: 42 },
  { name: 'Subway', value: 27 },
  { name: 'Rooftop', value: 18 },
  { name: 'Harbor', value: 9 },
  { name: 'Park', value: 4 },
];

const SPARK = [12, 18, 14, 22, 19, 27, 25, 31, 29, 36, 34, 41].map((value) => ({ value }));
const SPARK_DOWN = [41, 37, 39, 30, 32, 27, 24, 26, 20, 18, 21, 15].map((value) => ({ value }));

const meta: Meta = {
  title: 'Charts',
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
};
export default meta;

const districtControl = { control: 'inline-radio', options: DISTRICTS } as const;
const glowControl = { control: 'inline-radio', options: ['none', 'low', 'medium', 'high'] } as const;

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Section className="gap-4 border-2 border-ink-800 bg-ink-950 p-4 md:p-6">
      <Heading level={2} className="my-0 font-display text-xl text-white">{title}</Heading>
      {children}
    </Section>
  );
}

/**
 * Every chart on one page, themed by the district control. One district at a
 * time: each Skia surface on web holds a WebGL context and Chrome keeps about
 * sixteen, so four districts of everything would drop the oldest canvases.
 */
export const All: StoryObj<{ district: District }> = {
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

export const LineChart: StoryObj<typeof NeonLineChart> = {
  args: {
    data: SIGHTINGS,
    series: [{ dataKey: 'sightings', label: 'Sightings' }, { dataKey: 'catches', label: 'Catches' }],
    district: 'midtown',
    height: 280,
    area: true,
    grid: true,
    keyline: true,
    strokeWidth: 3,
    glowIntensity: 'low',
    showXAxis: true,
    showYAxis: true,
    selectable: true,
    indicator: true,
    title: 'Sightings, 2026',
  },
  argTypes: { district: districtControl, glowIntensity: glowControl, color: { control: 'color' } },
  render: (args) => (
    <View className="min-h-screen bg-ink-950 p-4 md:p-8">
      <Panel title="Sightings and catches">
        <NeonLineChart {...args} />
        <Paragraph className="my-0 text-sm text-silver-400">Hover or drag across the plot to read a month.</Paragraph>
      </Panel>
    </View>
  ),
};

export const Sparkline: StoryObj<typeof NeonSparkline> = {
  args: { data: SPARK, width: 160, height: 44, strokeWidth: 2, area: true, tooltip: true, district: 'midtown', glowIntensity: 'none', keyline: false },
  argTypes: { district: districtControl, glowIntensity: glowControl, color: { control: 'color' } },
  render: (args) => (
    <View className="min-h-screen gap-6 bg-ink-950 p-4 md:p-8">
      <NeonSparkline {...args} />
      <View className="gap-3">
        {DISTRICTS.map((d) => (
          <View key={d} className="flex-row items-center gap-4">
            <Paragraph className="my-0 w-24 text-sm text-silver-300">{DISTRICT_NAMES[d]}</Paragraph>
            <NeonSparkline data={SPARK} district={d} width={120} height={32} />
            <NeonSparkline data={SPARK_DOWN} district={d} width={120} height={32} />
          </View>
        ))}
      </View>
    </View>
  ),
};

export const BarChart: StoryObj<typeof NeonBarChart> = {
  args: {
    data: BOROUGHS,
    series: [{ dataKey: 'catches', label: 'Catches' }],
    district: 'midtown',
    height: 280,
    layout: 'vertical',
    barGap: 0.35,
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
  },
  render: (args) => (
    <View className="min-h-screen gap-6 bg-ink-950 p-4 md:p-8">
      <Panel title="Catches by borough">
        <NeonBarChart {...args} />
      </Panel>
      <Panel title="Catches and legends, horizontal">
        <NeonBarChart
          data={BOROUGHS}
          series={[{ dataKey: 'catches', label: 'Catches' }, { dataKey: 'legends', label: 'Legends' }]}
          layout="horizontal"
          district={args.district}
          height={260}
        />
      </Panel>
    </View>
  ),
};

export const DonutChart: StoryObj<typeof NeonDonutChart> = {
  args: {
    data: TYPES,
    district: 'midtown',
    height: 280,
    innerRadius: '60%',
    outerRadius: '92%',
    paddingAngle: 2,
    cornerRadius: 3,
    centerLabel: true,
    legend: true,
    glowIntensity: 'medium',
    title: 'Where legends turn up',
  },
  argTypes: {
    district: districtControl,
    glowIntensity: glowControl,
    paddingAngle: { control: { type: 'range', min: 0, max: 10, step: 0.5 } },
    cornerRadius: { control: { type: 'range', min: 0, max: 12, step: 1 } },
  },
  render: (args) => (
    <View className="min-h-screen bg-ink-950 p-4 md:p-8">
      <Panel title="Where legends turn up">
        <NeonDonutChart {...args} />
      </Panel>
    </View>
  ),
};

export const Stat: StoryObj<typeof StatCard> = {
  name: 'Stat card',
  args: {
    label: 'Legends caught',
    value: '1,284',
    trend: 'up',
    change: '+12.4%',
    changeLabel: 'vs last week',
    sparkData: SPARK,
    district: 'midtown',
  },
  argTypes: {
    district: districtControl,
    trend: { control: 'inline-radio', options: ['up', 'down', 'neutral'] },
    color: { control: 'inline-radio', options: ['orange', 'royal', 'carolina', 'leaf', 'apple'] },
  },
  render: (args) => (
    <View className="min-h-screen gap-6 bg-ink-950 p-4 md:p-8">
      <View className="max-w-sm">
        <StatCard {...args} />
      </View>
      <View className="gap-4 md:flex-row">
        {DISTRICTS.map((d) => (
          <StatCard key={d} className="md:flex-1" label={DISTRICT_NAMES[d]} value={d === 'harlem' ? '318' : '1,042'} trend={d === 'harlem' ? 'down' : 'up'} change={d === 'harlem' ? '-2.0%' : '+8.3%'} sparkData={d === 'harlem' ? SPARK_DOWN : SPARK} district={d} />
        ))}
      </View>
    </View>
  ),
};
