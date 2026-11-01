import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { Text, View } from '../../tw';
import { ReservedRegionsOverride } from '../../reserved-regions-override';
import type { ReservedRegion } from '../../reserved-regions.types';
import { useReservedRegions } from '../../reserved-regions';
import type { HardwareFamily } from '../../hardware-family';
import { DEFAULT_CONTROLLER_PROFILE, type ControllerProfile } from '../contract';
import { AdaptiveControlLayout, type ControlSlot } from './AdaptiveControlLayout';
import type { ControllerRuntime } from './controller-layout-resolver';
import type { SavedControlLayouts } from './revalidate-positions';

/*
  The real measuring host at every §10 profile. Storybook runs on web, so each
  story names the runtime and hardware family it simulates; folds come through
  `ReservedRegionsOverride`, the same path the native module feeds on device
  (regions -> foldLayoutsFromRegions -> resolver). Everything after that is the
  shipped code path.

  The three slots show labelled boxes with their resolved rect and the layout
  profile. They are measurement markers for this story only, not controls:
  lane C1's AnalogStick, ArcadeSixButtons and StartStopPill are what the game
  mounts in these slots. The hatched stripe marks the simulated hinge so a
  screenshot shows whether anything straddles it.
*/

const VIEWPORTS = {
  phonePortrait: { name: 'Phone portrait 412', styles: { width: '412px', height: '915px' } },
  phoneLandscape: { name: 'Phone landscape 915', styles: { width: '915px', height: '412px' } },
  foldOuter: { name: 'Fold cover 360', styles: { width: '360px', height: '880px' } },
  bookFold: { name: 'Book fold 840', styles: { width: '840px', height: '700px' } },
  dualScreen: { name: 'Dual screen 1114', styles: { width: '1114px', height: '720px' } },
  tabletop: { name: 'Tabletop 840', styles: { width: '840px', height: '700px' } },
  trifold: { name: 'Trifold 1290', styles: { width: '1290px', height: '900px' } },
  tablet: { name: 'Tablet 1366', styles: { width: '1366px', height: '1024px' } },
  web: { name: 'Web 1280', styles: { width: '1280px', height: '720px' } },
} as const;

type ViewportKey = keyof typeof VIEWPORTS;

const meta = {
  title: 'Game controls/AdaptiveControlLayout',
  parameters: {
    layout: 'fullscreen',
    viewport: { options: VIEWPORTS },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function at(viewport: ViewportKey) {
  return { globals: { viewport: { value: viewport, isRotated: false } } };
}

/* ---------- simulated fold geometry (window-relative dp) ---------- */

const NO_MARGINS = { top: 0, left: 0, bottom: 0, right: 0 };

function verticalHinge(x: number, height: number, extra: Partial<ReservedRegion>): ReservedRegion {
  return {
    kind: 'division',
    x,
    y: 0,
    width: 0,
    height,
    margins: NO_MARGINS,
    active: true,
    orientation: 'vertical',
    state: 'halfOpened',
    occlusionType: 'none',
    separating: true,
    ...extra,
  };
}

const BOOK_FOLD: readonly ReservedRegion[] = [verticalHinge(420, 700, {})];
const DUAL_SCREEN: readonly ReservedRegion[] = [verticalHinge(540, 720, { width: 34, state: 'flat', occlusionType: 'full' })];
const TABLETOP: readonly ReservedRegion[] = [
  { kind: 'division', x: 0, y: 350, width: 840, height: 0, margins: NO_MARGINS, active: true, orientation: 'horizontal', state: 'halfOpened', occlusionType: 'none', separating: true },
];
const TRIFOLD: readonly ReservedRegion[] = [verticalHinge(430, 900, {}), verticalHinge(860, 900, {})];

/* ---------- slot markers ---------- */

function Marker({ name, slot, tone }: { name: string; slot: ControlSlot; tone: string }) {
  const { rect, layout } = slot;
  return (
    <View className={`flex-1 items-center justify-center border-2 ${tone}`}>
      <Text className="text-xs font-semibold text-text">{name}</Text>
      <Text className="text-xs text-text-muted">{`${Math.round(rect.width)} × ${Math.round(rect.height)} @ ${Math.round(rect.x)},${Math.round(rect.y)}`}</Text>
      <Text className="text-xs text-text-muted">{`${layout.profile} · scale ${layout.scale.toFixed(2)}${layout.mirrored ? ' · mirrored' : ''}`}</Text>
    </View>
  );
}

/** Hatched stripes at each simulated hinge, so screenshots show it. */
function HingeMarks() {
  const regions = useReservedRegions();
  return (
    <>
      {regions.map((region) =>
        region.orientation === 'horizontal' ? (
          <View key={`h-${region.y}`} pointerEvents="none" aria-hidden className="absolute left-0 right-0 bg-accent/60" style={{ top: region.y - 2, height: Math.max(4, region.height) }} />
        ) : (
          <View key={`v-${region.x}`} pointerEvents="none" aria-hidden className="absolute bottom-0 top-0 bg-accent/60" style={{ left: region.x - (region.width === 0 ? 2 : 0), width: Math.max(4, region.width) }} />
        ),
      )}
    </>
  );
}

interface DemoProps {
  runtime?: ControllerRuntime;
  family?: HardwareFamily;
  profile?: ControllerProfile;
  saved?: SavedControlLayouts;
  hideTouchControls?: boolean;
  insets?: { top: number; right: number; bottom: number; left: number };
}

function Demo({ runtime = 'native', family = 'phone', profile = DEFAULT_CONTROLLER_PROFILE, saved, hideTouchControls, insets }: DemoProps) {
  return (
    <View className="h-dvh w-full bg-surface">
      <AdaptiveControlLayout
        runtime={runtime}
        hardwareFamily={family}
        profile={profile}
        savedLayouts={saved}
        hideTouchControls={hideTouchControls}
        insets={insets ?? { top: 0, right: 0, bottom: 0, left: 0 }}
        stage={(slot) => <Marker name="Stage (sightline)" slot={slot} tone="border-dashed border-border" />}
        stick={(slot) => <Marker name="Stick slot" slot={slot} tone="border-accent bg-surface-raised" />}
        cluster={(slot) => <Marker name="Six-button slot" slot={slot} tone="border-accent bg-surface-raised" />}
        pill={(slot) => <Marker name="START/STOP slot" slot={slot} tone="border-primary bg-surface-raised" />}
      />
      <HingeMarks />
    </View>
  );
}

function Folded({ regions, children }: { regions: readonly ReservedRegion[]; children: ReactNode }) {
  return <ReservedRegionsOverride regions={regions}>{children}</ReservedRegionsOverride>;
}

/* ---------- §10 profiles ---------- */

/** Compact portrait: stick lower-left, cluster lower-right, pill in the upper safe band. */
export const PhonePortrait: Story = { ...at('phonePortrait'), render: () => <Demo insets={{ top: 59, right: 0, bottom: 34, left: 0 }} /> };

/** Landscape: both groups in the lower grip zones, the sightline clear across the centre. */
export const PhoneLandscape: Story = { ...at('phoneLandscape'), render: () => <Demo insets={{ top: 0, right: 47, bottom: 21, left: 47 }} /> };

/** A foldable's cover screen: no fold feature, still the compact layout. */
export const FoldOuter: Story = { ...at('foldOuter'), render: () => <Demo family="foldable" /> };

/** Book posture: each group in its own segment, the pill off the crease. */
export const BookPosture: Story = {
  ...at('bookFold'),
  render: () => (
    <Folded regions={BOOK_FOLD}>
      <Demo family="foldable" />
    </Folded>
  ),
};

/** Two screens around a 34 dp occluding hinge: nothing, including the stage, under the gap. */
export const DualScreenHinge: Story = {
  ...at('dualScreen'),
  render: () => (
    <Folded regions={DUAL_SCREEN}>
      <Demo family="foldable" />
    </Folded>
  ),
};

/** Tabletop: world above the crease, controller below, pill centred on the lower region's top edge. */
export const Tabletop: Story = {
  ...at('tabletop'),
  render: () => (
    <Folded regions={TABLETOP}>
      <Demo family="foldable" />
    </Folded>
  ),
};

/** Trifold: three segments; stick on the first, cluster on the last, pill on the middle one. */
export const Trifold: Story = {
  ...at('trifold'),
  render: () => (
    <Folded regions={TRIFOLD}>
      <Demo family="foldable" />
    </Folded>
  ),
};

/** Tablet: groups raised from the corners toward the thumbs, broad centre stage. */
export const Tablet: Story = { ...at('tablet'), render: () => <Demo family="tablet" /> };

/** Web: pointer runtime, same hinge-safe placement. */
export const Web: Story = { ...at('web'), render: () => <Demo runtime="web" family="unknown" /> };

/* ---------- profile and persistence variants ---------- */

/** Left-handed preset mirrors the groups; the pill keeps its band. */
export const LeftHanded: Story = {
  ...at('phoneLandscape'),
  render: () => <Demo profile={{ ...DEFAULT_CONTROLLER_PROFILE, handedness: 'left' }} />,
};

/** Scale 1.4 on a phone shrinks until both groups fit side by side. */
export const LargeScaleOnPhone: Story = {
  ...at('phonePortrait'),
  render: () => <Demo profile={{ ...DEFAULT_CONTROLLER_PROFILE, scale: 1.4 }} />,
};

/** A saved stick position dragged toward the hinge is revalidated: it stops at the crease-side margin. */
export const SavedPositionRevalidated: Story = {
  ...at('bookFold'),
  render: () => (
    <Folded regions={BOOK_FOLD}>
      <Demo family="foldable" saved={{ 'fold-book': { stick: { dx: 300, dy: -120 } } }} />
    </Folded>
  ),
};

/** A hardware source is active: touch slots unmount, the stage stays. */
export const HardwareSourceActive: Story = {
  ...at('tablet'),
  render: () => <Demo family="tablet" hideTouchControls />,
};
