import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { ChoiceTriptych, type ChoiceTriptychItem } from './hatch/ChoiceTriptych';
import { Trackpad } from './hlynk/Trackpad';
import type { TrackpadCommit } from './hlynk/Trackpad.types';
import { Text } from './Text';
import { View } from './tw';
import { useInstanceStore, useStore } from './use-instance-store';

/**
 * M08's three eggs: equal tiles, no default, radio semantics. Focusing a tile
 * fills the container from its slot and raises the card; the other choices
 * step aside into labelled radios. Holding the trackpad (onHoldStart /
 * onHoldEnd) fills the hold bar over the 600 ms commit; the button path asks
 * to confirm (D-16d). Stand-in tiles and fixture copy.
 */
const meta = { title: 'Hatch/ChoiceTriptych' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const TONES = ['bg-orange-300', 'bg-carolina-300', 'bg-leaf-300'] as const;
const NAMES = ['Metro Egg', 'Corner Egg', 'Prism Egg'] as const;
const ITEMS: ChoiceTriptychItem[] = NAMES.map((name, i) => ({
  key: ['F01', 'F02', 'F12'][i]!,
  label: name,
  accessibilityLabel: `${name}, egg ${i + 1} of 3`,
  media: <View className={`flex-1 ${TONES[i]}`} />,
}));

function Demo({ initial = null, reducedMotion = false, night = false, placement = 'bottom' as 'bottom' | 'trailing', large = false }: {
  initial?: number | null; reducedMotion?: boolean; night?: boolean; placement?: 'bottom' | 'trailing'; large?: boolean;
}) {
  const store = useInstanceStore(() => ({ focused: initial as number | null, holding: false, log: 'Nothing chosen' }));
  const { focused, holding, log } = useStore(store);
  const step = (d: -1 | 1) => {
    const n = ITEMS.length;
    store.setState({ focused: focused === null ? 0 : (focused + d + n) % n });
  };
  const commit: TrackpadCommit = focused === null
    ? {}
    : { onCommit: () => store.setState({ log: `Chosen by hold: ${NAMES[focused]}` }), commitLabel: 'Choose this egg' };
  return (
    <View className={`gap-4 p-4 ${night ? 'scheme-dark bg-night' : 'scheme-light bg-bg'}`} style={{ width: placement === 'trailing' ? 900 : 351 }}>
      <View style={{ height: placement === 'trailing' ? 420 : 440 }}>
        <ChoiceTriptych
          items={ITEMS}
          focusedIndex={focused}
          onFocusChange={(i) => store.setState({ focused: i })}
          accessibilityLabel="Choose your egg"
          overlayPlacement={placement}
          holding={holding}
          reducedMotion={reducedMotion}
          testID="m08-triptych"
          itemTestID={(item) => `m08-egg-${item.key}`}
          focusedOverlay={focused === null ? null : (
            <View className="gap-2 bg-surface-raised p-3">
              <Text className={large ? 'text-2xl text-text' : 'text-type-title text-text'}>{NAMES[focused]}</Text>
              <Button title="Choose this egg" variant="cta" fullWidth onPress={() => store.setState({ log: 'Confirm step (button path)' })} />
            </View>
          )}
        />
      </View>
      <View className="flex-row items-center gap-4 self-start bg-hlynk-core-body p-3">
        <Trackpad
          label={focused === null ? 'Eggs' : `${NAMES[focused]}, ${focused + 1} of 3`}
          reducedMotion={reducedMotion}
          onActivate={() => step(1)}
          onStep={step}
          {...commit}
          onHoldStart={() => store.setState({ holding: true })}
          onHoldEnd={() => store.setState({ holding: false })}
        />
      </View>
      <Text variant="caption">{log}</Text>
    </View>
  );
}

export const Browsing: Story = { render: () => <Demo /> };
export const Focused: Story = { render: () => <Demo initial={1} /> };
export const ReducedMotion: Story = { render: () => <Demo initial={0} reducedMotion /> };
export const LargeText: Story = { render: () => <Demo initial={2} large /> };
export const NightPage: Story = { render: () => <Demo night /> };
/** Compact shell and the Quest 2D window: the card docks beside the stage. */
export const Trailing: Story = { render: () => <Demo initial={0} placement="trailing" /> };
