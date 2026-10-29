import type { Meta, StoryObj } from '@storybook/react-vite';
import { HeartRow } from './care/HeartRow';
import { lcdColors } from './care/lcd-model';
import { View } from './tw';

/**
 * Four hearts for one care meter, replacing the percent ring (Mon Space,
 * Home, the glass). Full hearts then outlines, one tint, no number, no red.
 * One text element to assistive tech. Fixture copy.
 */
const meta = {
  title: 'Care/HeartRow',
  component: HeartRow,
  args: { filled: 3, label: 'Hunger', accessibilityLabel: 'Hunger, 3 of 4 hearts', scheme: 'daylit' },
} satisfies Meta<typeof HeartRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { filled: 0, accessibilityLabel: 'Hunger, 0 of 4 hearts' } };
export const Full: Story = { args: { filled: 4, accessibilityLabel: 'Hunger, 4 of 4 hearts' } };

const Rows = ({ night }: { night: boolean }) => (
  <View className={`gap-2 p-6 ${night ? 'scheme-dark bg-night' : 'scheme-light bg-concrete-300'}`}>
    <HeartRow filled={4} label="Hunger" accessibilityLabel="Hunger, 4 of 4 hearts" scheme={night ? 'night' : 'daylit'} />
    <HeartRow filled={1} label="Happy" accessibilityLabel="Happy, 1 of 4 hearts" scheme={night ? 'night' : 'daylit'} />
    <HeartRow filled={2} label="Energy" accessibilityLabel="Energy, 2 of 4 hearts" scheme={night ? 'night' : 'daylit'} />
  </View>
);
/** Three rows on the scene scrim, daylit. */
export const RowsDaylit: Story = { render: () => <Rows night={false} /> };
export const RowsNight: Story = { render: () => <Rows night /> };

/** On the LCD: ink hearts, unlit outlines, the label printed by the LCD itself. */
export const OnLcd: Story = {
  render: () => {
    const c = lcdColors('daylit', false);
    return (
      <View className="p-6" style={{ backgroundColor: c.ground }}>
        <HeartRow filled={2} label="Hunger" accessibilityLabel="Hunger, 2 of 4 hearts" color={c.ink} emptyColor={c.ink} cell={4} labelClassName="text-type-body" />
      </View>
    );
  },
};
