import type { Meta, StoryObj } from '@storybook/react-vite';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { Button } from './Button';
import { CaptureCase } from './hatch/CaptureCase';
import { EggCase } from './hatch/EggCase';
import { useLedBreathPhase } from './hlynk/use-led-breath-phase';
import { padGlowAt } from './hlynk/breath-clock';
import { Text } from './Text';
import { View } from './tw';
import { useInstanceStore, useStore } from './use-instance-store';

/**
 * The single-egg case. `EggCase` (M10) closes it by state; `CaptureCase`
 * (M11, M12) holds it closed with the pad breathing on the LED's clock, lights
 * the seam when ready, and opens it from M12's phase clock. One drawing, so
 * the case is the same object on every screen. Square, brushed metal, pad
 * right of centre; never round, never a centre button.
 */
const meta = {
  title: 'Hatch/EggCase',
  component: EggCase,
  args: { state: 'open', padLit: false, reducedMotion: false },
} satisfies Meta<typeof EggCase>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A stand-in egg: the screen passes the real still. */
const Egg = () => <View className="bg-concrete-50" style={{ width: 56, height: 72 }} />;

const Floor = ({ night = false, children }: { night?: boolean; children: React.ReactNode }) => (
  <View className={`items-center gap-3 p-8 ${night ? 'scheme-dark bg-night' : 'scheme-light bg-concrete-100'}`}>{children}</View>
);

export const Open: Story = { render: () => <Floor><EggCase state="open" padLit={false} reducedMotion={false}><Egg /></EggCase></Floor> };
export const Closed: Story = { render: () => <Floor><EggCase state="closed" padLit={false} reducedMotion={false} accessibilityLabel="Egg in its case" /></Floor> };
export const PadLit: Story = { render: () => <Floor><EggCase state="closed" padLit padRhythm="breath" reducedMotion={false} accessibilityLabel="Egg in its case" /></Floor> };
export const NightPage: Story = { render: () => <Floor night><EggCase state="closed" padLit scheme="night" reducedMotion={false} accessibilityLabel="Egg in its case" /></Floor> };

function ClosingDemo({ reducedMotion }: { reducedMotion: boolean }) {
  const store = useInstanceStore(() => ({ state: 'open' as 'open' | 'closing' | 'closed' | 'opening', log: '' }));
  const { state, log } = useStore(store);
  return (
    <Floor>
      <EggCase
        state={state}
        padLit={state !== 'open' && state !== 'opening'}
        reducedMotion={reducedMotion}
        onTransitionEnd={(end) => store.setState({ state: end, log: `onTransitionEnd(${end})` })}
        accessibilityLabel={state === 'closed' ? 'Egg in its case' : undefined}
      >
        <Egg />
      </EggCase>
      <Button title={state === 'closed' ? 'Open' : 'Close'} variant="outline" size="sm" onPress={() => store.setState({ state: state === 'closed' ? 'opening' : 'closing' })} />
      <Text variant="caption">{log || 'Press to close: 700 ms, pad lights at 90%'}</Text>
    </Floor>
  );
}
/** Close and open; `onTransitionEnd` fires from the animation's end callback. */
export const Closing: Story = { render: () => <ClosingDemo reducedMotion={false} /> };
/** Reduced: a 200 ms cross-fade to the end frame, no hinge swing. */
export const ClosingReduced: Story = { render: () => <ClosingDemo reducedMotion /> };

function Capture({ lid = 'closed', seam = 'off', warm = false, night = false, reducedMotion = false }: {
  lid?: 'closed' | 'opening' | 'open'; seam?: 'off' | 'lit'; warm?: boolean; night?: boolean; reducedMotion?: boolean;
}) {
  const phase = useLedBreathPhase(warm && !reducedMotion);
  const padGlow = useDerivedValue(() => (warm ? padGlowAt(phase.get(), reducedMotion) : 0.35));
  const lidProgress = useSharedValue(lid === 'opening' ? 0.5 : 0);
  return (
    <Floor night={night}>
      <CaptureCase
        lid={lid}
        lidProgress={lid === 'opening' ? lidProgress : undefined}
        padGlow={padGlow}
        seam={seam}
        scheme={night ? 'night' : 'daylit'}
        reducedMotion={reducedMotion}
        accessibilityLabel="Metro Egg in its case"
        testID="m11-case"
      >
        <Egg />
      </CaptureCase>
    </Floor>
  );
}
export const CaptureClosed: Story = { render: () => <Capture /> };
/** Warming: the pad glow follows the LED breath (0.25 → 1). */
export const CaptureClosedWarm: Story = { render: () => <Capture warm /> };
export const CaptureReadySeam: Story = { render: () => <Capture seam="lit" /> };
export const CaptureOpening: Story = { render: () => <Capture lid="opening" seam="lit" /> };
export const CaptureOpen: Story = { render: () => <Capture lid="open" seam="lit" /> };
export const CaptureNight: Story = { render: () => <Capture night warm /> };
/** Reduced: the pad holds steady while warmed; an opening lid cross-fades instead of swinging. */
export const CaptureReducedMotion: Story = { render: () => <Capture warm lid="opening" reducedMotion /> };
