import type { Meta, StoryObj } from '@storybook/react-vite';
import { HLYNK_COPY } from './hlynk/copy';
import { Trackpad } from './hlynk/Trackpad';
import { TrackpadActions } from './hlynk/TrackpadActions';
import { Text } from './Text';
import { View } from './tw';
import { useInstanceStore, useStore } from './use-instance-store';

/**
 * The square centre control: black face, red ring inset 4 pt. Tap activates,
 * flick steps, hold 600 ms commits; every gesture has a labelled, non-gesture
 * route. Arrow keys step on web.
 */
const meta = {
  title: 'H-Lynk/Trackpad',
  component: Trackpad,
  args: { label: HLYNK_COPY['hlynk.trackpad.label'], reducedMotion: false },
} satisfies Meta<typeof Trackpad>;
export default meta;
type Story = StoryObj<typeof meta>;

// Story fixture only: the three M08 eggs named in DIRECTION.md's trackpad example.
const EGGS = ['Metro Egg', 'Metro Egg', 'Metro Egg'] as const;

const Body = ({ children }: { children: React.ReactNode }) => (
  <View className="items-center self-start bg-hlynk-core-body p-4">{children}</View>
);

function Live({ reducedMotion, accent = 'ring' }: { reducedMotion: boolean; accent?: 'ring' | 'hatch' }) {
  const store = useInstanceStore(() => ({ index: 0, log: 'Tap, flick, or hold' }));
  const { index, log } = useStore(store);
  const step = (d: -1 | 1) => {
    const next = Math.min(EGGS.length - 1, Math.max(0, index + d));
    store.setState({ index: next, log: `Step ${d > 0 ? 'forward' : 'back'}` });
  };
  const label = `${EGGS[index]}, ${index + 1} of ${EGGS.length}`;
  return (
    <View className="scheme-light gap-3 bg-bg p-4">
      <Body>
        <Trackpad
          label={label}
          accent={accent}
          reducedMotion={reducedMotion}
          onActivate={() => store.setState({ log: 'Activate' })}
          onStep={step}
          onCommit={() => store.setState({ log: 'Commit' })}
          commitLabel="Choose this egg"
        />
      </Body>
      <Text variant="caption">{`${label}. Last: ${log}`}</Text>
    </View>
  );
}

/** Idle and interactive: tap, flick left/right, hold to commit. */
export const Idle: Story = { render: () => <Live reducedMotion={false} /> };

/** Reduced: no scale on press; the ring flashes white. */
export const PressedReduced: Story = { render: () => <Live reducedMotion /> };

/** Flicks and arrow keys step focus between peers (label shows "n of 3"). */
export const Stepping: Story = { render: () => <Live reducedMotion={false} /> };

/** Hold 600 ms to commit; VoiceOver/TalkBack get a named "Choose this egg" action instead. */
export const HoldCommit: Story = { render: () => <Live reducedMotion={false} /> };

/** The hatch only: an orange rim outside the red ring (Decision #7). */
export const HatchAccent: Story = { render: () => <Live reducedMotion={false} accent="hatch" /> };

/** Disabled during boot: ring at the unlit red, face black, still named. */
export const Disabled: Story = {
  render: () => (
    <View className="scheme-light gap-3 bg-bg p-4">
      <Body>
        <Trackpad label={HLYNK_COPY['hlynk.trackpad.label']} disabled reducedMotion={false} />
      </Body>
    </View>
  ),
};

/** The compact shell's wide pill. */
export const Pill: Story = {
  render: () => (
    <View className="scheme-light gap-3 bg-bg p-4">
      <Body>
        <Trackpad shape="pill" label={HLYNK_COPY['hlynk.trackpad.label']} onActivate={() => undefined} reducedMotion={false} />
      </Body>
    </View>
  ),
};

/** The labelled on-screen equivalents a screen places beside the trackpad (WCAG 2.5.1). */
export const VoiceOverActions: Story = {
  render: () => {
    const noop = () => undefined;
    return (
      <View className="scheme-light gap-3 bg-bg p-4">
        <Body>
          <Trackpad label="Metro Egg, 1 of 3" onActivate={noop} onStep={noop} onCommit={noop} commitLabel="Choose this egg" reducedMotion={false} />
        </Body>
        <TrackpadActions
          onStepBack={noop}
          stepBackLabel="Previous egg"
          onActivate={noop}
          activateLabel="Look closer"
          onStepForward={noop}
          stepForwardLabel="Next egg"
          onCommit={noop}
          commitLabel="Choose this egg"
        />
      </View>
    );
  },
};
