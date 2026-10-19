import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text, View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import { GameTransition } from './GameTransition';
import type { TransitionPhase } from './lobby-contract';

/*
  The cover without the `game-transition` artboard: a solid page face in
  every phase but `done`. The host writes the phase; the cover never
  advances it. `Live` steps through enter → hold → reveal → done on press.
*/

const meta = {
  title: 'Lobby/GameTransition',
  decorators: [
    (Story) => (
      <View className="relative h-64 w-80 items-center justify-center bg-concrete-900">
        <Text className="text-text">the lobby under the cover</Text>
        <Story />
      </View>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Enter: Story = { render: () => <GameTransition phase="enter" reducedMotion={false} /> };
export const Hold: Story = { render: () => <GameTransition phase="hold" reducedMotion={false} /> };
export const Reveal: Story = { render: () => <GameTransition phase="reveal" reducedMotion={false} /> };
export const Done: Story = { render: () => <GameTransition phase="done" reducedMotion={false} /> };
/** Authored sibling: plain fades, chosen by `a11y/reducedMotion`. */
export const ReducedMotion: Story = { render: () => <GameTransition phase="hold" reducedMotion /> };
export const Daylit: Story = { render: () => <GameTransition phase="hold" reducedMotion={false} scheme="daylit" /> };

const ORDER: readonly TransitionPhase[] = ['enter', 'hold', 'reveal', 'done'];

function LiveDemo() {
  const store = useInstanceStore<{ index: number }>(() => ({ index: 0 }));
  const index = useStore(store, (s) => s.index);
  const phase = ORDER[index % ORDER.length]!;
  return (
    <View className="absolute inset-0">
      <GameTransition phase={phase} reducedMotion={false} />
      <View className="absolute bottom-2 left-2">
        <Text className="text-xs text-text-muted" onPress={() => store.setState({ index: index + 1 })}>
          {`phase: ${phase} (press to advance)`}
        </Text>
      </View>
    </View>
  );
}

export const Live: Story = { render: () => <LiveDemo /> };
