import type { Meta, StoryObj } from '@storybook/react-vite';
import { FilterBar, FilterChip } from './FilterBar';
import { View } from './tw';

const meta = { title: 'UI/FilterBar' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** No applied filters: just the affordances. */
export const Empty: Story = {
  render: () => (
    <View className="max-w-2xl p-4">
      <FilterBar onAddFilter={() => {}} />
    </View>
  ),
};

/** Two applied filters with remove buttons, plus Clear all. */
export const TwoFilters: Story = {
  render: () => (
    <View className="max-w-2xl p-4">
      <FilterBar onAddFilter={() => {}} onClearAll={() => {}}>
        <FilterChip label="Consent status" value="Pending" onRemove={() => {}} />
        <FilterChip label="Age" value="Under 13" onRemove={() => {}} />
      </FilterBar>
    </View>
  ),
};

/** Chips wrap onto new lines; the bar never scrolls sideways. */
export const Wrapping: Story = {
  render: () => (
    <View className="w-96 p-4">
      <FilterBar onAddFilter={() => {}} onClearAll={() => {}}>
        <FilterChip label="Consent status" value="Pending" onRemove={() => {}} />
        <FilterChip label="Age" value="13 and over" onRemove={() => {}} />
        <FilterChip label="Parent request" value="Review" onRemove={() => {}} />
        <FilterChip label="Joined" value="Last 30 days" onRemove={() => {}} />
      </FilterBar>
    </View>
  ),
};
