import type { Meta, StoryObj } from '@storybook/react-vite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text, View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import { AnalogStick, type AnalogStickProps } from './AnalogStick';
import { DigitalDPad } from './DigitalDPad';
import { DEFAULT_CONTROLLER_PROFILE, type Phase, type StickReading, type StickTuning } from './contract';
import { NEUTRAL_STICK } from './stick-math';

/*
  The stick without the `left-stick` artboard: the touch surface, the
  floating housing (it follows the finger on the UI thread), and the reading
  the router would receive, printed under the control. Drag inside the
  housing to see the normalized x/y, the engaged flag and the eight-way
  direction change; lift to see `end` and the neutral reading.
*/

const meta = {
  title: 'Game controls/AnalogStick',
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

interface Readout {
  reading: StickReading;
  phase: Phase | 'none';
  count: number;
}

function Demo(props: Partial<AnalogStickProps> & { dpad?: boolean; surface?: number }) {
  const { dpad = false, surface = 200, ...rest } = props;
  const store = useInstanceStore<Readout>(() => ({ reading: NEUTRAL_STICK, phase: 'none', count: 0 }));
  const readout = useStore(store);
  const common = {
    placement: 'fixed' as const,
    tuning: DEFAULT_CONTROLLER_PROFILE.stick,
    scale: 1,
    disabled: false,
    reducedMotion: false,
    onMove: (reading: StickReading, phase: Phase) => store.setState({ reading, phase, count: store.getState().count + 1 }),
    a11yActions: [
      { name: 'moveForward', label: 'Move forward', perform: () => store.setState({ phase: 'update', reading: { x: 0, y: 1, engaged: true, direction: 'n' } }) },
      { name: 'moveBack', label: 'Move back', perform: () => store.setState({ phase: 'update', reading: { x: 0, y: -1, engaged: true, direction: 's' } }) },
    ],
    testID: 'stick',
    ...rest,
  };
  return (
    <View className="gap-3">
      <View className="border border-dashed border-border" style={{ width: surface, height: surface }}>
        {dpad ? <DigitalDPad {...common} /> : <AnalogStick mode="analog" {...common} />}
      </View>
      <Text className="text-xs text-text-muted">
        {`${readout.phase} · x ${readout.reading.x.toFixed(2)} y ${readout.reading.y.toFixed(2)} · ${readout.reading.engaged ? 'engaged' : 'neutral'} · ${readout.reading.direction} · ${readout.count} readings`}
      </Text>
    </View>
  );
}

export const Idle: Story = { render: () => <Demo /> };
/** A story cannot hold a finger down; drag to about (0.7, −0.7) and watch the readout. */
export const Deflected: Story = { render: () => <Demo tuning={{ ...DEFAULT_CONTROLLER_PROFILE.stick, sensitivity: 1.5 }} /> };
/** Dead zone 0.5 of the clamp radius: the first 28 dp of travel read as neutral. */
export const DeadZone: Story = { render: () => <Demo tuning={{ deadZone: 0.5, sensitivity: 1, clampRadiusDp: 56 } satisfies StickTuning} /> };
/** Same gesture, eight-way reading; diagonals stay at (0.71, 0.71). */
export const DPadMode: Story = { render: () => <Demo dpad /> };
/** Floating placement on a larger surface: the housing moves to where the finger lands. */
export const Floating: Story = { render: () => <Demo placement="floating" surface={320} /> };
/** Reduced motion: one-frame return, no engage scale. */
export const ReducedMotion: Story = { render: () => <Demo reducedMotion /> };
export const Disabled: Story = { render: () => <Demo disabled /> };
/** Profile scale 1.4: housing Ø179, clamp 78 dp. */
export const Scale14: Story = { render: () => <Demo scale={1.4} surface={260} /> };
