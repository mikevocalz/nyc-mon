import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text, View } from '../tw';
import { ReservedRegionsOverride } from '../reserved-regions-override';
import type { ReservedRegion } from '../reserved-regions.types';
import type { HardwareFamily } from '../hardware-family';
import { useInstanceStore, useStore } from '../use-instance-store';
import { ArcadeController, type ArcadeControllerProps } from './ArcadeController';
import { DEFAULT_CONTROLLER_PROFILE, type ButtonId, type ControllerProfile, type InputEvent } from './contract';
import { DEFAULT_CAMERA_BINDINGS as DEFAULT_BINDINGS, DEFAULT_CAMERA_SPOKEN_LABELS } from './default-bindings';
import { createGameInputRouter } from './create-game-input-router';
import type { ControllerRuntime } from './layout/controller-layout-resolver';
import type { StartStopPillState } from './StartStopPill';

/*
  The whole overlay through the real router and lane D's measuring host, at
  every §10 profile, without the three artboards (the Rive slots are empty;
  the touch targets, the floating housing, the pill housing and the
  accessibility tree are what renders). The readout at the top prints the
  router's accepted events and `heldButtons`, so holding two caps while
  dragging the stick can be checked by eye on web. Folds come through
  `ReservedRegionsOverride`, the same path the native module feeds.
*/

const VIEWPORTS = {
  phonePortrait: { name: 'Phone portrait 412', styles: { width: '412px', height: '915px' } },
  phoneLandscape: { name: 'Phone landscape 915', styles: { width: '915px', height: '412px' } },
  bookFold: { name: 'Book fold 840', styles: { width: '840px', height: '700px' } },
  tabletop: { name: 'Tabletop 840', styles: { width: '840px', height: '700px' } },
  tablet: { name: 'Tablet 1366', styles: { width: '1366px', height: '1024px' } },
  web: { name: 'Web 1280', styles: { width: '1280px', height: '720px' } },
} as const;
type ViewportKey = keyof typeof VIEWPORTS;

const meta = {
  title: 'Game controls/ArcadeController',
  parameters: { layout: 'fullscreen', viewport: { options: VIEWPORTS } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function at(viewport: ViewportKey) {
  return { globals: { viewport: { value: viewport, isRotated: false } } };
}

const NO_MARGINS = { top: 0, left: 0, bottom: 0, right: 0 };
const BOOK_FOLD: readonly ReservedRegion[] = [
  { kind: 'division', x: 420, y: 0, width: 0, height: 700, margins: NO_MARGINS, active: true, orientation: 'vertical', state: 'halfOpened', occlusionType: 'none', separating: true },
];
const TABLETOP: readonly ReservedRegion[] = [
  { kind: 'division', x: 0, y: 350, width: 840, height: 0, margins: NO_MARGINS, active: true, orientation: 'horizontal', state: 'halfOpened', occlusionType: 'none', separating: true },
];

interface Readout {
  lines: string[];
  held: ButtonId[];
}

interface DemoProps extends Partial<Omit<ArcadeControllerProps, 'router' | 'bindings' | 'reducedMotion' | 'profile' | 'pill'>> {
  profile?: Partial<ControllerProfile>;
  pill?: StartStopPillState;
  reducedMotion?: boolean;
  family?: HardwareFamily;
  runtime?: ControllerRuntime;
  regions?: readonly ReservedRegion[];
}

function Demo({ profile, pill = 'playing', reducedMotion = false, family = 'phone', runtime = 'native', regions, insets, ...rest }: DemoProps) {
  const router = useMemo(() => createGameInputRouter({ bindings: DEFAULT_BINDINGS }), []);
  const readout = useInstanceStore<Readout>(() => ({ lines: [], held: [] }));
  const { lines, held } = useStore(readout);
  useMemo(() => {
    router.addListener((event: InputEvent) => {
      const line =
        event.kind === 'move'
          ? `move ${event.phase} ${event.reading.x.toFixed(2)},${event.reading.y.toFixed(2)} ${event.reading.direction}`
          : event.kind === 'cancel-all'
            ? `cancel-all ${event.reason}`
            : 'button' in event
              ? `${event.kind} ${event.button}`
              : event.kind;
      readout.setState({ lines: [line, ...readout.getState().lines].slice(0, 4), held: [...router.heldButtons] });
    });
  }, [router, readout]);

  const body = (
    <View className="h-dvh w-full bg-surface">
      <ArcadeController
        profile={{ ...DEFAULT_CONTROLLER_PROFILE, ...profile }}
        bindings={DEFAULT_BINDINGS}
        router={router}
        pill={pill}
        reducedMotion={reducedMotion}
        hardwareFamily={family}
        runtime={runtime}
        insets={insets ?? { top: 0, right: 0, bottom: 0, left: 0 }}
        spokenLabels={DEFAULT_CAMERA_SPOKEN_LABELS}
        stickA11yActions={[
          { name: 'moveForward', label: 'Move forward', perform: () => readout.setState({ lines: ['a11y moveForward', ...readout.getState().lines].slice(0, 4) }) },
        ]}
        testID="g01-controller"
        {...rest}
      />
      <View pointerEvents="none" className="absolute left-2 top-2 gap-0.5">
        <Text className="text-xs text-text-muted">{`held: ${held.join(' ') || 'none'} · accepted ${router.diagnostics.accepted} · rejected ${router.diagnostics.rejected}`}</Text>
        {lines.map((line, i) => (
          <Text key={i} className="text-xs text-text-muted">{line}</Text>
        ))}
      </View>
    </View>
  );
  return <GestureHandlerRootView style={{ flex: 1 }}>{regions ? <ReservedRegionsOverride regions={regions}>{body}</ReservedRegionsOverride> : body}</GestureHandlerRootView>;
}

function Folded({ regions, children }: { regions: readonly ReservedRegion[]; children: ReactNode }) {
  return <ReservedRegionsOverride regions={regions}>{children}</ReservedRegionsOverride>;
}

export const PhonePortrait: Story = { ...at('phonePortrait'), render: () => <Demo insets={{ top: 59, right: 0, bottom: 34, left: 0 }} /> };
export const PhoneLandscape: Story = { ...at('phoneLandscape'), render: () => <Demo insets={{ top: 0, right: 47, bottom: 21, left: 47 }} /> };
export const FoldTabletop: Story = { ...at('tabletop'), render: () => <Folded regions={TABLETOP}><Demo family="foldable" /></Folded> };
export const FoldBook: Story = { ...at('bookFold'), render: () => <Folded regions={BOOK_FOLD}><Demo family="foldable" /></Folded> };
export const Tablet: Story = { ...at('tablet'), render: () => <Demo family="tablet" /> };
export const Web: Story = { ...at('web'), render: () => <Demo runtime="web" family="unknown" /> };
export const LeftHanded: Story = { ...at('phoneLandscape'), render: () => <Demo profile={{ handedness: 'left' }} /> };
export const Scale08: Story = { ...at('phoneLandscape'), render: () => <Demo profile={{ scale: 0.8 }} /> };
export const Scale14: Story = { ...at('tablet'), render: () => <Demo family="tablet" profile={{ scale: 1.4 }} /> };
export const Opacity30: Story = { ...at('phoneLandscape'), render: () => <Demo profile={{ opacity: 0.3 }} /> };
/** Every cap state at once through `buttonOverrides` and a disabled binding. */
export const AllButtonStates: Story = {
  ...at('phoneLandscape'),
  render: () => <Demo buttonOverrides={{ y: 'cooldown', z: 'disabled' }} />,
};
/** Each pill state as the session would set it. */
export const AllPillStates: Story = {
  ...at('tablet'),
  render: () => (
    <View className="flex-row flex-wrap">
      {(['start', 'playing', 'paused', 'stopConfirm', 'disabled'] as const).map((pill) => (
        <View key={pill} style={{ width: 640, height: 360 }}>
          <Demo family="tablet" pill={pill} stopProgress={pill === 'stopConfirm' ? 0.5 : 0} />
        </View>
      ))}
    </View>
  ),
};
/** Reduced motion on: no sink, one-frame stick return, four-step hold ring. */
export const ReducedMotion: Story = { ...at('phoneLandscape'), render: () => <Demo reducedMotion /> };
/** `preview` mode for G03: renders and animates, never reaches the router or haptics. */
export const Preview: Story = { ...at('phoneLandscape'), render: () => <Demo mode="preview" /> };
export const DPadMode: Story = { ...at('phoneLandscape'), render: () => <Demo profile={{ stickMode: 'dpad' }} /> };
export const FloatingStick: Story = { ...at('phoneLandscape'), render: () => <Demo profile={{ stickPlacement: 'floating' }} /> };
export const Disabled: Story = { ...at('phoneLandscape'), render: () => <Demo disabled /> };
/** The session is at START: orange pill, caps live. */
export const StartState: Story = { ...at('phoneLandscape'), render: () => <Demo pill="start" /> };
