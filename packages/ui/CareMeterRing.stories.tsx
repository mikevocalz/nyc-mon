import type { Meta, StoryObj } from '@storybook/react-vite';
import { CareMeterRing } from './care/CareMeterRing';
import { CareMeterRingGroup } from './care/CareMeterRingGroup';
import { View } from './tw';

/**
 * One care meter as a ring with a word under it; no number is drawn. Below
 * the needs-you line a notch appears at 12 o'clock with the low word. A
 * progressbar to assistive tech: "Fullness, low", 22 percent. The group sits
 * on the `scrim-scene` plate. Fixture copy.
 */
const meta = {
  title: 'Care/CareMeterRing',
  component: CareMeterRing,
  args: { need: 'fullness', value: 0.62, label: 'Fullness', low: false, lowLabel: 'low', reducedMotion: false },
} satisfies Meta<typeof CareMeterRing>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Low: Story = { args: { value: 0.22, low: true } };
export const Small: Story = { args: { size: 'sm' } };
export const ReducedMotion: Story = { args: { reducedMotion: true, value: 0.4 } };

const Group = ({ night }: { night: boolean }) => (
  <View className={`p-6 ${night ? 'scheme-dark bg-night' : 'scheme-light bg-concrete-300'}`}>
    <CareMeterRingGroup accessibilityLabel="Care">
      <CareMeterRing need="energy" value={0.8} label="Energy" low={false} lowLabel="low" scheme={night ? 'night' : 'daylit'} reducedMotion={false} />
      <CareMeterRing need="fullness" value={0.22} label="Fullness" low lowLabel="low" scheme={night ? 'night' : 'daylit'} reducedMotion={false} />
      <CareMeterRing need="social" value={0.55} label="Social" low={false} lowLabel="low" scheme={night ? 'night' : 'daylit'} reducedMotion={false} />
    </CareMeterRingGroup>
  </View>
);
/** Three rings on the scene scrim, daylit. */
export const GroupDaylit: Story = { render: () => <Group night={false} /> };
export const GroupNight: Story = { render: () => <Group night /> };
