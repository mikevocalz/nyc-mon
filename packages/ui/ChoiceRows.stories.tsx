import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChoiceRows, type ChoiceRow } from './hatch/ChoiceRows';
import { Text } from './Text';
import { View } from './tw';
import { useInstanceStore, useStore } from './use-instance-store';

/**
 * The accessibility-size form of a short single choice: full-width radio
 * rows, no default. M08 swaps its triptych for these at accessibility text
 * sizes (still + name + Bloodline), M10 swaps its ring (07-a11y.md in both).
 * Rows are at least 48 pt tall; arrows wrap, Home/End jump, only the checked
 * row is a Tab stop on web. Fixture copy.
 */
const meta = { title: 'Hatch/ChoiceRows' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const EGG_ROWS: ChoiceRow[] = [
  { key: 'F01', label: 'Metro Egg', detail: 'Fixture Bloodline A', accessibilityLabel: 'Metro Egg, 1 of 3', media: <View className="flex-1 bg-orange-300" /> },
  { key: 'F02', label: 'Corner Egg', detail: 'Fixture Bloodline B', accessibilityLabel: 'Corner Egg, 2 of 3', media: <View className="flex-1 bg-carolina-300" /> },
  { key: 'F12', label: 'Prism Egg', detail: 'Fixture Bloodline C', accessibilityLabel: 'Prism Egg, 3 of 3', media: <View className="flex-1 bg-leaf-300" /> },
];
const TIME_ROWS: ChoiceRow[] = [
  { key: '15', label: '15 minutes', accessibilityLabel: '15 minutes' },
  { key: '30', label: '30 minutes', accessibilityLabel: '30 minutes' },
  { key: '60', label: '1 hour', accessibilityLabel: '1 hour' },
];

function Demo({ rows, initial = null, night = false }: { rows: ChoiceRow[]; initial?: number | null; night?: boolean }) {
  const store = useInstanceStore(() => ({ value: initial as number | null }));
  const value = useStore(store, (s) => s.value);
  return (
    <View className={`gap-3 p-4 ${night ? 'scheme-dark bg-night' : 'scheme-light bg-bg'}`} style={{ width: 351 }}>
      <ChoiceRows
        rows={rows}
        value={value}
        onChange={(i) => store.setState({ value: i })}
        accessibilityLabel="Fixture choice"
        testID="choice-rows"
        rowTestID={(row) => `choice-row-${row.key}`}
      />
      <Text variant="caption">{value === null ? 'Nothing chosen' : `Chosen: ${rows[value]!.label}`}</Text>
    </View>
  );
}

/** No default: nothing is checked on mount. */
export const Eggs: Story = { render: () => <Demo rows={EGG_ROWS} /> };
export const EggChecked: Story = { render: () => <Demo rows={EGG_ROWS} initial={1} /> };
export const Times: Story = { render: () => <Demo rows={TIME_ROWS} /> };
export const NightPage: Story = { render: () => <Demo rows={EGG_ROWS} initial={0} night /> };
