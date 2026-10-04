import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { HLYNK_COPY } from './hlynk/copy';
import { HLynkShell, SHELL_HANDOFF_MS } from './hlynk/HLynkShell';
import type { HLynkPower, HLynkShellProps, HLynkStatus } from './hlynk/HLynkShell.types';
import { AnimatedView } from './progress/motion';
import { Text } from './Text';
import { View } from './tw';
import { useInstanceStore, useStore } from './use-instance-store';

/**
 * The H-Lynk Core around a companion screen (Decision #16): red body, black
 * head with the red emitter, 3:4 screen, home / menu / trackpad / back /
 * forward. The body is the same red by day and by night.
 */
const meta = {
  title: 'H-Lynk/HLynkShell',
  component: HLynkShell,
  parameters: { layout: 'fullscreen' },
  args: {
    reducedMotion: false,
    screen: null,
    trackpad: { label: HLYNK_COPY['hlynk.trackpad.label'] },
  },
} satisfies Meta<typeof HLynkShell>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => undefined;
const KEYS: HLynkShellProps['keys'] = {
  home: { onPress: noop },
  menu: { onPress: noop },
  back: { onPress: noop },
  forward: { onPress: noop },
};

/** Egg silhouette standing in for the three.js scene. */
const Scene = () => (
  <View className="flex-1 items-center justify-center">
    <View className="rounded-full bg-concrete-300" style={{ width: 120, height: 160 }} />
  </View>
);

/** A fixed device viewport with its safe-area insets. */
function Device({ w, h, top, bottom, children }: { w: number; h: number; top: number; bottom: number; children: (insets: { topPt: number; bottomPt: number }) => React.ReactNode }) {
  return (
    <View className="self-start border border-border" style={{ width: w, height: h }}>
      {children({ topPt: top, bottomPt: bottom })}
    </View>
  );
}

const shell = (p: Partial<HLynkShellProps> & { reducedMotion: boolean }) => (
  <HLynkShell
    screen={<Scene />}
    trackpad={{ label: 'Metro Egg, 1 of 3', onActivate: noop, onStep: noop, onCommit: noop, commitLabel: 'Choose this egg' }}
    keys={KEYS}
    status={{ led: 'incubating', label: HLYNK_COPY['hlynk.led.incubating'], progress: 0.5 }}
    {...p}
  />
);

/** Daylit page, incubating. Fills the story viewport (phone or tablet). */
export const Core: Story = {
  render: (args) => <View style={{ height: '100vh' } as object}>{shell({ reducedMotion: args.reducedMotion })}</View>,
};

/** Night page and screen; the red body does not change. */
export const CoreNight: Story = {
  render: (args) => (
    <View style={{ height: '100vh' } as object}>
      {shell({ reducedMotion: args.reducedMotion, scheme: 'night', status: { led: 'needsYou', label: HLYNK_COPY['hlynk.led.needs_you'] } })}
    </View>
  ),
};

/** A short window (landscape, slide-over): full-bleed screen, 24 pt head strip, 72 pt bar, pill trackpad. */
export const Compact: Story = {
  render: (args) => (
    <Device w={667} h={375} top={0} bottom={0}>
      {(insets) => shell({ reducedMotion: args.reducedMotion, insets, status: { led: 'ready', label: HLYNK_COPY['hlynk.led.ready'] } })}
    </Device>
  ),
};

/** Drives `power` off → booting → on (240 ms) like M01 and replays on demand. */
function PowerOnDemo({ reducedMotion }: { reducedMotion: boolean }) {
  const store = useInstanceStore(() => ({ power: 'off' as HLynkPower, run: 0 }));
  const { power, run } = useStore(store);
  useEffect(() => {
    store.setState({ power: 'off' });
    const a = setTimeout(() => store.setState({ power: 'booting' }), 300);
    const b = setTimeout(() => store.setState({ power: 'on' }), 300 + 240);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [run, store]);
  const status: HLynkStatus = power === 'on' ? { led: 'incubating', label: HLYNK_COPY['hlynk.led.incubating'], progress: 0.5 } : power === 'booting' ? { led: 'boot' } : { led: 'off' };
  return (
    <View className="scheme-light gap-3 bg-bg p-3">
      <Button title="Replay power-on" size="sm" variant="outline" onPress={() => store.setState({ run: run + 1 })} />
      <Device w={375} h={667} top={20} bottom={0}>
        {(insets) => (
          <HLynkShell
            insets={insets}
            power={power}
            status={status}
            reducedMotion={reducedMotion}
            screen={<Scene />}
            trackpad={{ label: HLYNK_COPY['hlynk.trackpad.label'] }}
            testIDPrefix="m01"
          />
        )}
      </Device>
    </View>
  );
}

/** M01 power-on, full motion: emitter ramp, one fan sweep, body scale, screen fades up by 600 ms. */
export const PowerOn: Story = { render: () => <PowerOnDemo reducedMotion={false} /> };

/** M01 power-on, reduced: emitter steps on, no fan, no scale, screen cuts on at 240 ms. */
export const PowerOnReduced: Story = { render: () => <PowerOnDemo reducedMotion /> };

/** First run: after power-on the shell lowers away (300 ms `motion-enter` reversed; reduced: 200 ms fade) and M02 stands alone. Hidden from assistive tech throughout. */
function HandOffDemo({ reducedMotion }: { reducedMotion: boolean }) {
  const store = useInstanceStore(() => ({ gone: false, run: 0 }));
  const { gone, run } = useStore(store);
  useEffect(() => {
    store.setState({ gone: false });
    const t = setTimeout(() => store.setState({ gone: true }), 900);
    return () => clearTimeout(t);
  }, [run, store]);
  const ms = reducedMotion ? SHELL_HANDOFF_MS.reduced : SHELL_HANDOFF_MS.full;
  return (
    <View className="scheme-light gap-3 bg-bg p-3">
      <Button title="Replay hand-off" size="sm" variant="outline" onPress={() => store.setState({ run: run + 1 })} />
      <Device w={375} h={667} top={20} bottom={0}>
        {(insets) => (
          <View className="flex-1 bg-bg">
            <View className="absolute inset-0 items-center justify-center p-6">
              <Text variant="caption">M02 stands here once the shell is gone.</Text>
            </View>
            <AnimatedView
              className="flex-1"
              style={{
                opacity: gone ? 0 : 1,
                transform: [{ translateY: gone && !reducedMotion ? 120 : 0 }],
                transitionProperty: ['opacity', 'transform'],
                transitionDuration: `${ms}ms`,
                transitionTimingFunction: 'ease-in',
              } as object}
            >
              <HLynkShell insets={insets} accessibilityHidden status={{ led: 'off' }} reducedMotion={reducedMotion} screen={null} trackpad={{ label: HLYNK_COPY['hlynk.trackpad.label'] }} />
            </AnimatedView>
          </View>
        )}
      </Device>
    </View>
  );
}

export const FirstRunHandOff: Story = { render: () => <HandOffDemo reducedMotion={false} /> };

/** Every LED state at once, each with its chip in the screen's status row. */
export const AllLedStates: Story = {
  render: (args) => {
    const states: HLynkStatus[] = [
      { led: 'off' },
      { led: 'boot' },
      { led: 'incubating', label: HLYNK_COPY['hlynk.led.incubating'], progress: 0.3 },
      { led: 'ready', label: HLYNK_COPY['hlynk.led.ready'] },
      { led: 'needsYou', label: HLYNK_COPY['hlynk.led.needs_you'] },
    ];
    return (
      <View className="scheme-light flex-row flex-wrap gap-3 bg-bg p-3">
        {states.map((status) => (
          <Device key={status.led} w={320} h={600} top={0} bottom={0}>
            {(insets) => shell({ reducedMotion: args.reducedMotion, insets, status })}
          </Device>
        ))}
      </View>
    );
  },
};

/** The same five states with reduced motion: steady light plus the static cues. */
export const AllLedStatesReduced: Story = { args: { reducedMotion: true }, render: AllLedStates.render };

/** iPhone SE 3, 375 × 667, 20 pt top inset: the tight case. The row gets 139 pt and uses 136. */
export const SE3Viewport: Story = {
  render: (args) => (
    <Device w={375} h={667} top={20} bottom={0}>
      {(insets) => shell({ reducedMotion: args.reducedMotion, insets })}
    </Device>
  ),
};

/** iPhone 16 Pro Max, 440 × 956, 62 / 34 pt insets. */
export const ProMaxViewport: Story = {
  render: (args) => (
    <Device w={440} h={956} top={62} bottom={34}>
      {(insets) => shell({ reducedMotion: args.reducedMotion, insets })}
    </Device>
  ),
};

/** `standard` and `pro` are typed now and draw the Core look with a labelled development placeholder. */
export const TierPlaceholders: Story = {
  render: (args) => (
    <View className="scheme-light flex-row flex-wrap gap-3 bg-bg p-3">
      {(['core', 'standard', 'pro'] as const).map((tier) => (
        <Device key={tier} w={320} h={600} top={0} bottom={0}>
          {(insets) => shell({ reducedMotion: args.reducedMotion, insets, tier })}
        </Device>
      ))}
    </View>
  ),
};
