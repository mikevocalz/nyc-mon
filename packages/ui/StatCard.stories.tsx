import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatCard } from './charts/StatCard';
import { StoryPage } from './charts/StoryPanel';
import { DISTRICT_NAMES, DISTRICTS, SPARK, SPARK_DOWN, districtControl, glowControl } from './charts/story-fixtures';
import { View } from './tw';

const meta = {
  title: 'Charts/Stat Card',
  component: StatCard,
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'StatCard, the port of NeonBlade stat-card (Stat Card).' } },
  },
  args: {
    label: 'Legends caught',
    value: '1,284',
    trend: 'up',
    change: '+12.4%',
    changeLabel: 'vs last week',
    sparkData: SPARK,
    district: 'midtown',
    glowIntensity: 'none',
  },
  argTypes: {
    district: districtControl,
    glowIntensity: glowControl,
    trend: { control: 'inline-radio', options: ['up', 'down', 'neutral'] },
    color: { control: 'inline-radio', options: [undefined, 'orange', 'royal', 'carolina', 'leaf', 'apple'] },
    background: { control: 'color' },
  },
} satisfies Meta<typeof StatCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  name: 'Stat Card',
  render: (args) => (
    <StoryPage>
      <View className="max-w-sm">
        <StatCard {...args} />
      </View>
    </StoryPage>
  ),
};

export const Districts: Story = {
  render: () => (
    <StoryPage>
      <View className="gap-4 md:flex-row">
        {DISTRICTS.map((d) => (
          <StatCard
            key={d}
            className="md:flex-1"
            label={DISTRICT_NAMES[d]}
            value={d === 'harlem' ? '318' : '1,042'}
            trend={d === 'harlem' ? 'down' : 'up'}
            change={d === 'harlem' ? '-2.0%' : '+8.3%'}
            sparkData={d === 'harlem' ? SPARK_DOWN : SPARK}
            district={d}
            glowIntensity={d === 'megacity' ? 'medium' : 'none'}
          />
        ))}
      </View>
    </StoryPage>
  ),
};
