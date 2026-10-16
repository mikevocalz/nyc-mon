import type { Meta, StoryObj } from '@storybook/react-vite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text, View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import { ArcadeActionButton } from './ArcadeActionButton';
import { ArcadeSixButtons, type ButtonStates } from './ArcadeSixButtons';
import { BUTTON_IDS, type ActionBinding, type ButtonId, type ButtonVisualState } from './contract';
import { DEFAULT_CAMERA_BINDINGS as DEFAULT_BINDINGS, DEFAULT_CAMERA_SPOKEN_LABELS } from './default-bindings';

/*
  One cap and the six-cap cluster without the `right-six` artboard: what
  renders is the round touch target (the press disc lights on touch, the
  carolina ring marks `held`) over an empty artboard slot. Every visual
  state the Rive `buttons/<id>/state` enum names is a story, so the wrapper
  side of each state can be checked before the `.riv` lands. The default
  bindings are G01 05-copy.md § Six buttons.
*/

const STATES: readonly ButtonVisualState[] = ['idle', 'pressed', 'held', 'released', 'disabled', 'cooldown'];

const meta = {
  title: 'Game controls/ArcadeActionButton',
  decorators: [
    (Story) => (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="bg-concrete-900 p-6">
          <Story />
        </View>
      </GestureHandlerRootView>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

interface Log {
  lines: string[];
}

function useLog() {
  const store = useInstanceStore<Log>(() => ({ lines: [] }));
  const lines = useStore(store, (s) => s.lines);
  const push = (line: string) => store.setState({ lines: [line, ...store.getState().lines].slice(0, 6) });
  return { lines, push };
}

function OneCap({ state, binding = DEFAULT_BINDINGS.a, scale = 1, reducedMotion = false }: { state: ButtonVisualState; binding?: ActionBinding; scale?: number; reducedMotion?: boolean }) {
  const log = useLog();
  return (
    <View className="gap-3">
      <View className="relative" style={{ width: 56 * scale, height: 56 * scale }}>
        <ArcadeActionButton
          id="a"
          binding={binding}
          state={state}
          scale={scale}
          reducedMotion={reducedMotion}
          onDown={(id, t) => log.push(`down ${id} @${t}`)}
          onUp={(id, t) => log.push(`up ${id} @${t}`)}
          onAccessibilityActivate={(id) => log.push(`activate ${id}`)}
          testID={`cap-${state}`}
          style={{ left: 0, top: 0 }}
        />
      </View>
      <Text className="text-xs text-text-muted">{`state: ${state}`}</Text>
      {log.lines.map((line, i) => (
        <Text key={i} className="text-xs text-text-muted">{line}</Text>
      ))}
    </View>
  );
}

export const Idle: Story = { render: () => <OneCap state="idle" /> };
export const Pressed: Story = { render: () => <OneCap state="pressed" /> };
export const Held: Story = { render: () => <OneCap state="held" /> };
export const Released: Story = { render: () => <OneCap state="released" /> };
export const Disabled: Story = { render: () => <OneCap state="disabled" /> };
export const Cooldown: Story = { render: () => <OneCap state="cooldown" /> };
/** An icon in the binding; shown on the cap when `showIcons` is on (Rive `buttons/a/icon`). */
export const WithIcon: Story = { render: () => <OneCap state="idle" binding={{ action: 'rotateLeft', label: 'A', icon: 'rotate-ccw' }} /> };
/** A four-character label at the smallest scale (the artboard must still fit it). */
export const LongLabel: Story = { render: () => <OneCap state="idle" scale={0.8} binding={{ action: 'reset', label: 'VIEW' }} /> };
/** Reduced motion: the press disc appears in one frame. */
export const ReducedMotion: Story = { render: () => <OneCap state="idle" reducedMotion /> };

function AllStatesDemo() {
  const log = useLog();
  const states: ButtonStates = Object.fromEntries(BUTTON_IDS.map((id, i) => [id, STATES[i]])) as ButtonStates;
  return (
    <View className="gap-6">
      {(['right', 'left'] as const).map((handedness) => (
        <View key={handedness} className="gap-2">
          <Text className="text-xs text-text-muted">{`${handedness}-handed · scale 1.0`}</Text>
          <ArcadeSixButtons
            bindings={DEFAULT_BINDINGS}
            handedness={handedness}
            scale={1}
            states={states}
            reducedMotion={false}
            spokenLabels={DEFAULT_CAMERA_SPOKEN_LABELS}
            onDown={(id: ButtonId, t) => log.push(`down ${id} @${t}`)}
            onUp={(id: ButtonId, t) => log.push(`up ${id} @${t}`)}
            testID={`cluster-${handedness}`}
          />
        </View>
      ))}
      {log.lines.map((line, i) => (
        <Text key={i} className="text-xs text-text-muted">{line}</Text>
      ))}
    </View>
  );
}

/** Every state on the arch at once (idle, pressed, held, released, disabled, cooldown on X…C), both hands. */
export const AllStates: Story = { render: () => <AllStatesDemo /> };

/** The box at the two ends of the profile scale: 153.6 × 102.4 and 268.8 × 179.2. */
export const Scales: Story = {
  render: () => (
    <View className="flex-row flex-wrap items-end gap-8">
      {[0.8, 1, 1.4].map((scale) => (
        <View key={scale} className="gap-2">
          <Text className="text-xs text-text-muted">{`scale ${scale}`}</Text>
          <ArcadeSixButtons bindings={DEFAULT_BINDINGS} handedness="right" scale={scale} reducedMotion={false} onDown={() => {}} onUp={() => {}} />
        </View>
      ))}
    </View>
  ),
};
