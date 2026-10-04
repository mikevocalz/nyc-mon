import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { Pressable, Text, View } from './tw';
import { Heading } from './Heading';
import { DISTRICTS, DISTRICT_NAME, type District } from './district';
import { useInstanceStore, useStore } from './use-instance-store';
import { ReservedRegionsOverride } from './reserved-regions-override';
import type { ReservedRegion } from './reserved-regions.types';
import { resolveAdaptiveNavigationPlacement } from './adaptive-navigation';
import {
  PANE_WIDTH_DP,
  SplitView,
  foldLayoutsFromRegions,
  paneVisibility,
  useReservedRegions,
  useWindowSizeClass,
} from './adaptive-panes';

/*
  The real host — `SplitView` from ./adaptive-panes, the component Android and
  web render — at every window width class and fold posture.

  WIDTH comes from the viewport: the host reads `useWindowDimensions`, so each
  story pins a viewport whose width sits inside one Material width band.

  FOLDS are simulated through `ReservedRegionsOverride`, which feeds window-
  relative regions to the same `useReservedRegions` the native module feeds on
  device. Everything after that (foldLayoutsFromRegions, the pane planner, the
  inspector cap, the navigation placement) is the shipped code path. The
  hatched stripe marks where the simulated hinge sits so a screenshot shows
  whether a pane straddles it.
*/

const VIEWPORTS = {
  compact: { name: 'Compact 412', styles: { width: '412px', height: '915px' } },
  medium: { name: 'Medium 700', styles: { width: '700px', height: '1000px' } },
  expanded: { name: 'Expanded 1000', styles: { width: '1000px', height: '800px' } },
  large: { name: 'Large 1366', styles: { width: '1366px', height: '1024px' } },
  extraLarge: { name: 'Extra large 1920', styles: { width: '1920px', height: '1080px' } },
  bookFold: { name: 'Book fold 840', styles: { width: '840px', height: '700px' } },
  dualScreen: { name: 'Dual screen 1114', styles: { width: '1114px', height: '720px' } },
  tabletop: { name: 'Tabletop 840', styles: { width: '840px', height: '700px' } },
  trifold: { name: 'Trifold 1290', styles: { width: '1290px', height: '900px' } },
} as const;

type ViewportKey = keyof typeof VIEWPORTS;

const meta = {
  title: 'Layout/SplitView',
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

/** A book-style foldable's inner display, half open: one crease, no gap. */
const BOOK_FOLD: readonly ReservedRegion[] = [verticalHinge(420, 700, {})];

/** Two physical screens around a 34 dp hinge that hides content. */
const DUAL_SCREEN: readonly ReservedRegion[] = [
  verticalHinge(540, 720, { width: 34, state: 'flat', occlusionType: 'full' }),
];

/** The same inner display turned on its side and half open like a laptop. */
const TABLETOP: readonly ReservedRegion[] = [
  {
    kind: 'division',
    x: 0,
    y: 350,
    width: 840,
    height: 0,
    margins: NO_MARGINS,
    active: true,
    orientation: 'horizontal',
    state: 'halfOpened',
    occlusionType: 'none',
    separating: true,
  },
];

/** Three panels, two creases, both half open. */
const TRIFOLD: readonly ReservedRegion[] = [
  verticalHinge(430, 900, {}),
  verticalHinge(860, 900, {}),
];

/* ---------- story content: district list, facts list, detail ---------- */

interface DemoState {
  district: District;
  inspector: boolean;
}

function useDemo(initialInspector: boolean) {
  const store = useInstanceStore<DemoState>(() => ({ district: 'midtown', inspector: initialInspector }));
  return {
    district: useStore(store, (state) => state.district),
    inspector: useStore(store, (state) => state.inspector),
    select: (district: District) => store.setState({ district }),
    setInspector: (inspector: boolean) => store.setState({ inspector }),
  };
}

function PaneTitle({ children }: { children: ReactNode }) {
  return (
    <View className="border-b-2 border-border px-4 py-3">
      <Text className="text-base font-semibold text-text">{children}</Text>
    </View>
  );
}

function Row({ label, detail, selected, onPress }: {
  label: string;
  detail?: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      role="button"
      aria-pressed={selected}
      onPress={onPress}
      className={`min-h-11 justify-center border-b border-border px-4 py-2 ${selected ? 'bg-surface-sunken' : ''}`}
    >
      <Text numberOfLines={1} className="text-sm font-semibold text-text">{label}</Text>
      {detail ? <Text numberOfLines={1} className="text-xs text-text-muted">{detail}</Text> : null}
    </Pressable>
  );
}

function Facts() {
  const { width, height } = useWindowDimensions();
  const sizeClass = useWindowSizeClass();
  const regions = useReservedRegions();
  const folds = foldLayoutsFromRegions(regions);
  const android = resolveAdaptiveNavigationPlacement({
    platform: 'android',
    sizeClass,
    heightDp: height,
    folds,
    hardwareEdge: null,
    isRTL: false,
  });
  return (
    <View>
      <Row label={`Window ${Math.round(width)} × ${Math.round(height)} dp`} detail={`Width class: ${sizeClass}`} />
      <Row
        label={`Folds: ${folds.length}`}
        detail={folds.length === 0 ? 'No hinge reported' : folds.map((fold) => `${fold.orientation} ${fold.posture} at ${fold.orientation === 'vertical' ? `x ${fold.x}` : `y ${fold.y}`}`).join(' · ')}
      />
      <Row label={`Android navigation: ${android.kind}`} detail={`Position ${android.position}`} />
      <Row label={`Pane tokens ${PANE_WIDTH_DP.primary} / ${PANE_WIDTH_DP.supplementary} dp`} detail={`Inspector ${PANE_WIDTH_DP.inspector} dp`} />
    </View>
  );
}

function Detail({ district, onInspect }: { district: District; onInspect: () => void }) {
  // The inspector exists only where the three-column policy allows it, so the
  // control is drawn only there rather than as a button that does nothing.
  const canInspect = paneVisibility(useWindowSizeClass(), 2).inspector;
  return (
    <View className="flex-1 gap-3 p-4">
      <Heading level={2}>{DISTRICT_NAME[district]}</Heading>
      <Text className="text-sm text-text-muted">
        The detail pane absorbs whatever width the leading panes leave. On a foldable its leading
        edge lands on the hinge instead of straddling it.
      </Text>
      {canInspect ? (
      <Pressable role="button" onPress={onInspect} className="min-h-11 self-start justify-center border-2 border-border bg-surface-raised px-4">
        <Text className="text-sm font-semibold text-text">Open inspector</Text>
      </Pressable>
      ) : null}
    </View>
  );
}

/** Hatched stripes at each simulated vertical hinge, so screenshots show it. */
function HingeMarks() {
  const regions = useReservedRegions();
  return (
    <>
      {regions.map((region) =>
        region.orientation === 'horizontal' ? (
          <View
            key={`h-${region.y}`}
            pointerEvents="none"
            aria-hidden
            className="absolute left-0 right-0 bg-accent/60"
            style={{ top: region.y - 2, height: Math.max(4, region.height) }}
          />
        ) : (
          <View
            key={`v-${region.x}`}
            pointerEvents="none"
            aria-hidden
            className="absolute bottom-0 top-0 bg-accent/60"
            style={{ left: region.x - (region.width === 0 ? 2 : 0), width: Math.max(4, region.width) }}
          />
        ),
      )}
    </>
  );
}

function Demo({ inspector = false }: { inspector?: boolean }) {
  const demo = useDemo(inspector);
  return (
    <View className="h-dvh w-full bg-surface">
      <SplitView
        topColumnForCollapsing="secondary"
        showInspector={demo.inspector}
        detail={<Detail district={demo.district} onInspect={() => demo.setInspector(true)} />}
      >
        <SplitView.Column>
          <PaneTitle>Districts</PaneTitle>
          {DISTRICTS.map((district) => (
            <Row
              key={district}
              label={DISTRICT_NAME[district]}
              selected={district === demo.district}
              onPress={() => demo.select(district)}
            />
          ))}
        </SplitView.Column>
        <SplitView.Column>
          <PaneTitle>Layout</PaneTitle>
          <Facts />
        </SplitView.Column>
        <SplitView.Inspector>
          <PaneTitle>Inspector</PaneTitle>
          <Text className="p-4 text-sm text-text-muted">
            A drawer over the detail pane from the trailing edge. It never takes layout width,
            and on a foldable it stays inside the trailing display region.
          </Text>
          <Pressable role="button" onPress={() => demo.setInspector(false)} className="mx-4 min-h-11 justify-center self-start border-2 border-border bg-surface-raised px-4">
            <Text className="text-sm font-semibold text-text">Close inspector</Text>
          </Pressable>
        </SplitView.Inspector>
      </SplitView>
      <HingeMarks />
    </View>
  );
}

function Folded({ regions, children }: { regions: readonly ReservedRegion[]; children: ReactNode }) {
  return <ReservedRegionsOverride regions={regions}>{children}</ReservedRegionsOverride>;
}

/* ---------- width classes ---------- */

/** Under 600 dp: one pane at a time; Back steps leading-ward. Starts on the detail. */
export const Compact: Story = { ...at('compact'), render: () => <Demo /> };

/** 600–839 dp: three-column shape drops the sidebar, keeps the list beside the detail. */
export const Medium: Story = { ...at('medium'), render: () => <Demo /> };

/** 840–1199 dp: sidebar steps to its narrow rail width, list and detail stay. */
export const Expanded: Story = { ...at('expanded'), render: () => <Demo /> };

/** 1200–1599 dp: all three panes at token widths, inspector allowed. */
export const Large: Story = { ...at('large'), render: () => <Demo inspector /> };

/** 1600 dp and up: three panes plus the inspector; the Android rail expands. */
export const ExtraLarge: Story = { ...at('extraLarge'), render: () => <Demo inspector /> };

/* ---------- fold postures ---------- */

/** Book posture: a half-open vertical crease becomes the list/detail boundary. */
export const BookPosture: Story = {
  ...at('bookFold'),
  render: () => (
    <Folded regions={BOOK_FOLD}>
      <Demo />
    </Folded>
  ),
};

/** Two screens around an occluding hinge: no pane is drawn under the 34 dp gap. */
export const DualScreenHinge: Story = {
  ...at('dualScreen'),
  render: () => (
    <Folded regions={DUAL_SCREEN}>
      <Demo inspector />
    </Folded>
  ),
};

/**
 * Tabletop: a horizontal crease. Panes keep their width-class layout (a
 * horizontal hinge is not a column boundary); Android navigation moves to the
 * bottom bar, which the Layout pane reports.
 */
export const Tabletop: Story = {
  ...at('tabletop'),
  render: () => (
    <Folded regions={TABLETOP}>
      <Demo />
    </Folded>
  ),
};

/** Trifold: two creases, three tiled panes, one per physical panel. */
export const Trifold: Story = {
  ...at('trifold'),
  render: () => (
    <Folded regions={TRIFOLD}>
      <Demo />
    </Folded>
  ),
};

/** Trifold with the inspector open: capped to the last panel, never over a crease. */
export const TrifoldInspector: Story = {
  ...at('trifold'),
  render: () => (
    <Folded regions={TRIFOLD}>
      <Demo inspector />
    </Folded>
  ),
};
