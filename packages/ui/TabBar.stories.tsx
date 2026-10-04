import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabBar, type TabBarTab } from './TabBar';
import { DISTRICTS, DISTRICT_NAME, CONTROL_TONES } from './district';
import { Calendar, Home, Play, Users, MoreHorizontal } from './icons';
import { Text, View } from './tw';

const TABS: TabBarTab[] = [
  { key: 'home', label: 'Home', icon: ({ colorClass }) => <Home size={20} className={colorClass} /> },
  { key: 'events', label: 'Events', icon: ({ colorClass }) => <Calendar size={20} className={colorClass} /> },
  { key: 'listen', label: 'Listen', icon: ({ colorClass }) => <Play size={22} className={colorClass} /> },
  { key: 'people', label: 'People', icon: ({ colorClass }) => <Users size={20} className={colorClass} /> },
  { key: 'more', label: 'More', icon: ({ colorClass }) => <MoreHorizontal size={20} className={colorClass} /> },
];
const tabs = (activeKey: string): TabBarTab[] => TABS.map((t) => ({ ...t, active: t.key === activeKey }));

const meta = {
  title: 'UI/TabBar',
  component: TabBar,
  args: { tabs: tabs('home'), district: 'midtown' },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    tone: { control: 'select', options: [undefined, ...CONTROL_TONES] },
    emphasizedKey: { control: 'select', options: [undefined, 'home', 'events', 'listen', 'people', 'more'] },
  },
} satisfies Meta<typeof TabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EmphasizedCenter: Story = {
  args: { emphasizedKey: 'listen' },
};

export const SecondTabActive: Story = {
  args: { tabs: tabs('events').slice(0, 3) },
};

/** One bar per district, the center tab emphasized and the second tab active. */
export const Districts: Story = {
  render: () => (
    <View className="gap-6">
      {DISTRICTS.map((d) => (
        <View key={d} className="gap-2">
          <Text className="font-display text-sm text-text">{DISTRICT_NAME[d]}</Text>
          <TabBar tabs={tabs('events')} emphasizedKey="listen" district={d} />
        </View>
      ))}
    </View>
  ),
};

/** G15: navigation mode — links with aria-current="page", no tablist/tab roles. */
export const Navigation: Story = {
  args: {
    semantics: 'navigation',
    tabs: tabs('home').map((t) => ({ ...t, href: `/admin/${t.key}` })),
  },
};
