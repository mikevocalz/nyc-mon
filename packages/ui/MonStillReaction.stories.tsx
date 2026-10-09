import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { MonStillReaction } from './hatch/MonStillReaction';
import { View } from './tw';
import { useInstanceStore, useStore } from './use-instance-store';

/**
 * A small authored move on a 2D creature still about a per-asset pivot
 * (M09 naming, M13 tap for attention). Each press restarts from the current
 * pose, so rapid presses never stack. Reduced motion: no movement. A
 * stand-in shape replaces the Baby still.
 */
const meta = { title: 'Hatch/MonStillReaction' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Demo({ reaction, reducedMotion = false }: { reaction: 'tilt' | 'lift'; reducedMotion?: boolean }) {
  const store = useInstanceStore(() => ({ key: 0 }));
  const key = useStore(store, (s) => s.key);
  return (
    <View className="scheme-dark items-center gap-4 bg-night p-8">
      <MonStillReaction playKey={key} reaction={reaction} reducedMotion={reducedMotion}>
        <View className="bg-royal-500" style={{ width: 120, height: 150 }} />
      </MonStillReaction>
      <Button title="Play" size="sm" variant="outline" onPress={() => store.setState({ key: key + 1 })} />
    </View>
  );
}

export const Tilt: Story = { render: () => <Demo reaction="tilt" /> };
export const Lift: Story = { render: () => <Demo reaction="lift" /> };
export const ReducedMotion: Story = { render: () => <Demo reaction="tilt" reducedMotion /> };
