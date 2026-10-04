import type { Meta, StoryObj } from '@storybook/react-vite';
import { HLYNK_COPY } from './hlynk/copy';
import { ScannerLed } from './hlynk/ScannerLed';
import { Text } from './Text';
import { View } from './tw';

/**
 * The H-Lynk scanner head: black band, red emitter lens, fan at boot. Each
 * meaningful state differs by rhythm, never by colour alone, and carries its
 * text label. Reduced motion swaps every rhythm for steady light plus a cue.
 */
const meta = {
  title: 'H-Lynk/ScannerLed',
  component: ScannerLed,
  args: { state: 'off', reducedMotion: false },
} satisfies Meta<typeof ScannerLed>;
export default meta;
type Story = StoryObj<typeof meta>;

function Row({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <View className="gap-1">
      <Text variant="caption">{caption}</Text>
      <View className="bg-hlynk-core-body px-3">{children}</View>
    </View>
  );
}

const AllStates = ({ reducedMotion }: { reducedMotion: boolean }) => (
  <View className="scheme-light max-w-[440px] gap-4 bg-bg p-4">
    <Row caption="off"><ScannerLed state="off" reducedMotion={reducedMotion} /></Row>
    <Row caption="boot"><ScannerLed state="boot" reducedMotion={reducedMotion} /></Row>
    <Row caption={`incubating, 60% (${HLYNK_COPY['hlynk.led.incubating']})`}>
      <ScannerLed state="incubating" label={HLYNK_COPY['hlynk.led.incubating']} progress={0.6} reducedMotion={reducedMotion} />
    </Row>
    <Row caption={`ready (${HLYNK_COPY['hlynk.led.ready']})`}>
      <ScannerLed state="ready" label={HLYNK_COPY['hlynk.led.ready']} reducedMotion={reducedMotion} />
    </Row>
    <Row caption={`needsYou (${HLYNK_COPY['hlynk.led.needs_you']})`}>
      <ScannerLed state="needsYou" label={HLYNK_COPY['hlynk.led.needs_you']} reducedMotion={reducedMotion} />
    </Row>
  </View>
);

/** Full motion: dark lens, boot ramp, 4 s breath, two blinks every 6 s, three blinks every 10 s. */
export const States: Story = { render: () => <AllStates reducedMotion={false} /> };

/** The authored reduced siblings: steady light with a tick row, a filled dot, an exclamation dot. */
export const ReducedMotionStates: Story = { render: () => <AllStates reducedMotion /> };

/** M01 boot: the emitter ramps on and throws one red fan upward inside the head. */
export const BootFan: Story = {
  render: () => (
    <View className="scheme-light max-w-[440px] bg-bg p-4">
      <Row caption="boot with fan (one 400 ms sweep on mount)">
        <ScannerLed state="boot" fan reducedMotion={false} />
      </Row>
      <Row caption="reduced motion: no fan, emitter steps on">
        <ScannerLed state="boot" fan reducedMotion />
      </Row>
    </View>
  ),
};

/** The 24 pt strip the compact shell uses. */
export const InCompactStrip: Story = {
  render: () => (
    <View className="scheme-light max-w-[700px] gap-4 bg-bg p-4">
      <Row caption="compact, needsYou">
        <ScannerLed size="compact" state="needsYou" label={HLYNK_COPY['hlynk.led.needs_you']} reducedMotion={false} />
      </Row>
      <Row caption="compact, reduced, incubating">
        <ScannerLed size="compact" state="incubating" label={HLYNK_COPY['hlynk.led.incubating']} progress={0.4} reducedMotion />
      </Row>
    </View>
  ),
};
