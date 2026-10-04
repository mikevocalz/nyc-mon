import type { Meta, StoryObj } from '@storybook/react-vite';
import { NeonDonutChart } from './charts/NeonDonutChart';
import { StoryPage, StoryPanel } from './charts/StoryPanel';
import { DISTRICT_NAMES, DISTRICTS, TYPES, districtControl, glowControl } from './charts/story-fixtures';
import { View } from './tw';

const STATUS = [
  { name: 'Online', value: 72, color: 'leaf' },
  { name: 'Idle', value: 18, color: 'orange' },
  { name: 'Offline', value: 10, color: 'apple' },
];

const meta = {
  title: 'Charts/Neon Donut Chart',
  component: NeonDonutChart,
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'NeonDonutChart, the port of NeonBlade neon-donut-chart (Neon Donut Chart): hover dimming, a centre label, a pointer tooltip and a legend.' } },
  },
  args: {
    data: TYPES,
    district: 'midtown',
    height: 280,
    innerRadius: '60%',
    outerRadius: '92%',
    paddingAngle: 2,
    cornerRadius: 3,
    centerLabel: true,
    totalLabel: 'Total',
    legend: true,
    tooltip: true,
    glowIntensity: 'medium',
    title: 'Where legends turn up',
  },
  argTypes: {
    district: districtControl,
    glowIntensity: glowControl,
    color: { control: 'inline-radio', options: [undefined, 'orange', 'royal', 'carolina', 'leaf', 'apple'] },
    paddingAngle: { control: { type: 'range', min: 0, max: 10, step: 0.5 } },
    cornerRadius: { control: { type: 'range', min: 0, max: 12, step: 1 } },
  },
} satisfies Meta<typeof NeonDonutChart>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Hover a segment: the others dim, the hole shows it, a tooltip follows the pointer. The legend selects too. */
export const Playground: Story = {
  name: 'Neon Donut Chart',
  render: (args) => (
    <StoryPage>
      <StoryPanel title="Where legends turn up" note="Hover a segment, or press a legend row.">
        <NeonDonutChart {...args} />
      </StoryPanel>
    </StoryPage>
  ),
};

/** NeonBlade's preset-colour demo: each segment names its own colour. */
export const PresetColors: Story = {
  name: 'Preset colours',
  render: (args) => (
    <StoryPage>
      <StoryPanel title="Crew status">
        <NeonDonutChart data={STATUS} district={args.district} totalLabel="Crew" height={240} innerRadius="70%" />
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
              <NeonDonutChart data={TYPES} district={d} height={200} legend={false} />
            </StoryPanel>
          </View>
        ))}
      </View>
    </StoryPage>
  ),
};
