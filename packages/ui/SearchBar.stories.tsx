import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchBar } from './SearchBar';
import { View } from './tw';
import { Text } from './Text';
import { create } from 'zustand';
import { CONTROL_TONES, DISTRICTS, DISTRICT_NAME } from './district';

const meta = {
  title: 'UI/SearchBar',
  component: SearchBar,
  args: { value: '', onChangeText: () => {}, placeholder: 'Search…' },
  argTypes: {
    district: { control: 'inline-radio', options: [undefined, ...DISTRICTS] },
    tone: { control: 'select', options: [undefined, ...CONTROL_TONES] },
  },
  decorators: [(S) => <View className="max-w-content-form p-4"><S /></View>],
} satisfies Meta<typeof SearchBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const WithQuery: Story = { args: { value: 'Design system' } };
export const Sized: Story = {
  render: (args) => (
    <View>
      <SearchBar {...args} value="Order My Steps" />
    </View>
  ),
};

// Story state — zustand always (repo rule).
const useDebounceStory = create<{
  query: string; deliveries: number; setQuery: (q: string) => void;
}>((set) => ({
  query: '', deliveries: 0,
  setQuery: (query) => set((s) => ({ query, deliveries: s.deliveries + 1 })),
}));

export const Debounced: Story = {
  render: function Render() {
    const { query, deliveries, setQuery } = useDebounceStory();
    return (
      <View className="gap-3">
        <SearchBar value={query} onChangeText={setQuery} debounceMs={400} placeholder="Type fast…" />
        <Text variant="caption" tone="muted">
          Upstream received: “{query}” ({deliveries} deliveries — 400ms debounce via @tanstack/react-pacer)
        </Text>
      </View>
    );
  },
};

/** District showcase. */
export const Districts: Story = {
  render: () => (
    <View className="gap-4">
      {DISTRICTS.map((d) => (
        <SearchBar key={d} district={d} value={d === 'harlem' ? 'Lenox Ave' : ''} onChangeText={() => {}} placeholder={`Search ${DISTRICT_NAME[d]}`} />
      ))}
    </View>
  ),
};
