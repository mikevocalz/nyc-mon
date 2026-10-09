import type { Meta, StoryObj } from '@storybook/react-vite';
import { FoodTile } from './care/FoodTile';
import { LifecycleTrack } from './care/LifecycleTrack';
import { lifecycleSlots } from './care/lifecycle-model';
import { RoundDots } from './care/RoundDots';
import { View } from './tw';

/**
 * Small care primitives. `LifecycleTrack` (M17): Egg ✓, Baby ●, then three
 * unnamed ○, never a stage name ahead of the Mon. `RoundDots` (M16): discrete
 * rounds that never read as a score. `FoodTile` (M14): renders whatever the
 * screen passes; no food data exists yet (D-15e). Fixture copy.
 */
const meta = { title: 'Care/Track and tiles' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const LifecycleBaby: Story = {
  render: () => (
    <View className="scheme-light max-w-[420px] bg-bg p-6">
      <LifecycleTrack
        slots={lifecycleSlots(['Metro Egg', 'Squeaklet'], 3)}
        accessibilityLabel="Life stages"
        stateWords={{ done: 'done', current: 'now', later: 'Later stage' }}
        testID="m17-lifecycle"
      />
    </View>
  ),
};
export const LifecycleNight: Story = {
  render: () => (
    <View className="scheme-dark max-w-[420px] bg-night p-6">
      <LifecycleTrack slots={lifecycleSlots(['Corner Egg', 'Kittee-Cee'], 3)} accessibilityLabel="Life stages" />
    </View>
  ),
};

export const Rounds: Story = {
  render: () => (
    <View className="scheme-light gap-4 bg-bg p-6">
      <RoundDots total={6} current={1} accessibilityLabel="Round 1 of 6" reducedMotion={false} />
      <RoundDots total={6} current={3} accessibilityLabel="Round 3 of 6" reducedMotion={false} />
      <RoundDots total={6} current={6} accessibilityLabel="Round 6 of 6" reducedMotion={false} />
    </View>
  ),
};
export const RoundsReduced: Story = {
  render: () => (
    <View className="scheme-light bg-bg p-6">
      <RoundDots total={6} current={3} accessibilityLabel="Round 3 of 6" reducedMotion />
    </View>
  ),
};

const Plate = () => <View className="flex-1 self-stretch bg-concrete-300" />;
export const FoodTiles: Story = {
  render: () => (
    <View className="scheme-light flex-row gap-3 bg-bg p-6">
      <FoodTile name="Food one" image={<Plate />} focused={false} onSelect={() => {}} reducedMotion={false} />
      <FoodTile name="Food two" note="Favourite" image={<Plate />} focused onSelect={() => {}} reducedMotion={false} />
      <FoodTile name="Food three" image={<Plate />} focused={false} disabled onSelect={() => {}} reducedMotion />
    </View>
  ),
};
