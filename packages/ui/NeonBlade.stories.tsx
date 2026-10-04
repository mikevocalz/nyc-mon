import type { ComponentType, ReactNode } from 'react';
import { createElement, useEffect, useRef } from 'react';
import { composeStories, type Meta, type StoryObj } from '@storybook/react-vite';
import { Heading, Link, List, ListItem, Paragraph, Section, Text } from './html';
import { View } from './tw';
import { useInstanceStore, useStore } from './use-instance-store';
import { useLayoutSize } from './use-layout-size';
import { CATALOG, byCategory, siteUrl, type CatalogEntry, type NeonBladeCategory } from './neonblade/catalog';
import { storyHref, storyId } from './neonblade/story-id';
import * as AccentFrameStories from './AccentFrame.stories';
import * as ArrowLoaderStories from './ArrowLoader.stories';
import * as BadgeStories from './Badge.stories';
import * as ButtonStories from './Button.stories';
import * as CardStories from './Card.stories';
import * as CardSliderStories from './CardSlider.stories';
import * as CheckboxStories from './Checkbox.stories';
import * as CircularProgressStories from './CircularProgress.stories';
import * as CityBlocksStories from './CityBlocks.stories';
import * as CityHeightfieldStories from './CityHeightfield.stories';
import * as CitySkylineStories from './CitySkyline.stories';
import * as CursorsStories from './Cursors.stories';
import * as DataTableStories from './DataTable.stories';
import * as DialogStories from './Dialog.stories';
import * as GridFloorStories from './GridFloor.stories';
import * as GridSceneStories from './GridScene.stories';
import * as NavStories from './Nav.stories';
import * as NeonBarChartStories from './NeonBarChart.stories';
import * as NeonDonutChartStories from './NeonDonutChart.stories';
import * as NeonLineChartStories from './NeonLineChart.stories';
import * as NeonSparklineStories from './NeonSparkline.stories';
import * as ProgressBarStories from './ProgressBar.stories';
import * as RainLoaderStories from './RainLoader.stories';
import * as RainWindowStories from './RainWindow.stories';
import * as RiverTideStories from './RiverTide.stories';
import * as SelectStories from './Select.stories';
import * as SignRainStories from './SignRain.stories';
import * as StatCardStories from './StatCard.stories';
import * as StreetPulseStories from './StreetPulse.stories';
import * as SubwayLinesStories from './SubwayLines.stories';
import * as SwitchStories from './Switch.stories';
import * as TextEffectsStories from './TextEffects.stories';
import * as TextFieldStories from './TextField.stories';
import * as TimelineStories from './Timeline.stories';
import * as ToastStories from './Toast.stories';
import * as TurbineLoaderStories from './TurbineLoader.stories';

/**
 * NeonBlade/Index: every NeonBlade UI component next to its NYC-MON port,
 * in the site's categories, with a live preview, our name, and links to the
 * story here and the demo on the NeonBlade site. Each component also has its
 * own entry below the index, named as NeonBlade names it, so the sidebar
 * search finds "donut" or "ascii rain".
 */

type StoryModule = { default: { title?: string; id?: string } } & Record<string, unknown>;

// Every story file a catalog entry points at, composed once.
const MODULES: Record<string, StoryModule> = {
  AccentFrame: AccentFrameStories,
  ArrowLoader: ArrowLoaderStories,
  Badge: BadgeStories,
  Button: ButtonStories,
  Card: CardStories,
  CardSlider: CardSliderStories,
  Checkbox: CheckboxStories,
  CircularProgress: CircularProgressStories,
  CityBlocks: CityBlocksStories,
  CityHeightfield: CityHeightfieldStories,
  CitySkyline: CitySkylineStories,
  Cursors: CursorsStories,
  DataTable: DataTableStories,
  Dialog: DialogStories,
  GridFloor: GridFloorStories,
  GridScene: GridSceneStories,
  Nav: NavStories,
  NeonBarChart: NeonBarChartStories,
  NeonDonutChart: NeonDonutChartStories,
  NeonLineChart: NeonLineChartStories,
  NeonSparkline: NeonSparklineStories,
  ProgressBar: ProgressBarStories,
  RainLoader: RainLoaderStories,
  RainWindow: RainWindowStories,
  RiverTide: RiverTideStories,
  Select: SelectStories,
  SignRain: SignRainStories,
  StatCard: StatCardStories,
  StreetPulse: StreetPulseStories,
  SubwayLines: SubwayLinesStories,
  Switch: SwitchStories,
  TextEffects: TextEffectsStories,
  TextField: TextFieldStories,
  Timeline: TimelineStories,
  Toast: ToastStories,
  TurbineLoader: TurbineLoaderStories,
};
const COMPOSED: Record<string, Record<string, ComponentType>> = Object.fromEntries(
  Object.entries(MODULES).map(([file, mod]) => [
    file,
    composeStories(mod as Parameters<typeof composeStories>[0]) as unknown as Record<string, ComponentType>,
  ]),
);

function linkFor(e: CatalogEntry) {
  const mod = MODULES[e.story.file];
  const title = mod?.default.title ?? e.story.file;
  return storyHref(storyId(title, e.story.export, mod?.default.id));
}

function previewOf(e: CatalogEntry): ComponentType | undefined {
  const ref = e.preview ?? e.story;
  return COMPOSED[ref.file]?.[ref.export];
}

const ENTRY = new Map(CATALOG.map((e) => [`${e.category}/${e.slug}`, e]));

// One accent per category, cycling the brand tones, for the card's top band.
const BAND: Record<NeonBladeCategory, string> = {
  backgrounds: 'bg-royal-500',
  buttons: 'bg-orange-500',
  cards: 'bg-carolina-500',
  charts: 'bg-leaf-500',
  cursors: 'bg-apple-500',
  elements: 'bg-orange-500',
  footers: 'bg-royal-500',
  inputs: 'bg-carolina-500',
  navbars: 'bg-leaf-500',
  progress: 'bg-apple-500',
  sliders: 'bg-orange-500',
  tables: 'bg-royal-500',
  text: 'bg-carolina-500',
};

/** Width the thumbnail story renders at before it is scaled down. */
const STAGE_W = 1200;
const STAGE_H = 760;

/**
 * Mounts its children only while on screen. Each GPU/Skia preview holds a
 * WebGL context and Chrome keeps about sixteen, so the index never runs all
 * 41 at once.
 */
function WhenVisible({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLElement | null>(null);
  const store = useInstanceStore(() => ({ on: false }));
  const on = useStore(store, (s) => s.on);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      store.setState({ on: true });
      return;
    }
    const io = new IntersectionObserver(([entry]) => store.setState({ on: !!entry?.isIntersecting }), { rootMargin: '150px' });
    io.observe(el);
    return () => io.disconnect();
  }, [store]);
  return (
    <View ref={ref as never} className={className}>
      {on ? children : null}
    </View>
  );
}

/** A story rendered at desktop width and scaled to fit the card. */
function Thumbnail({ entry }: { entry: CatalogEntry }) {
  const Story = previewOf(entry);
  const { size, onLayout } = useLayoutSize({ width: 0, height: 0 });
  const stageW = entry.stage ?? STAGE_W;
  const scale = size.width > 0 ? size.width / stageW : 0;
  const stageH = Math.max(STAGE_H, size.height / (scale || 1));
  const bottom = entry.anchor === 'bottom';
  return (
    <View onLayout={onLayout} aria-hidden className="h-48 w-full overflow-hidden bg-ink-950" pointerEvents="none">
      <WhenVisible className="h-full w-full">
        {Story && scale > 0 ? (
          <View
            // Computed geometry: the story lays out at the entry's stage width, then scales to the card.
            style={{
              position: 'absolute',
              left: 0,
              ...(bottom ? { bottom: 0 } : { top: 0 }),
              width: stageW,
              height: stageH,
              transform: [{ scale }],
              transformOrigin: bottom ? 'bottom left' : 'top left',
            }}
            className="overflow-hidden"
          >
            {createElement(Story)}
          </View>
        ) : null}
      </WhenVisible>
    </View>
  );
}

function EntryLinks({ entry }: { entry: CatalogEntry }) {
  return (
    <View className="flex-row flex-wrap gap-x-4 gap-y-1">
      <Link href={linkFor(entry)} target="_top" className="text-sm font-semibold text-carolina-300 underline">
        Open our story
      </Link>
      <Link href={siteUrl(entry)} target="_blank" rel="noreferrer" className="text-sm text-silver-300 underline">
        NeonBlade demo
      </Link>
    </View>
  );
}

function EntryCard({ entry }: { entry: CatalogEntry }) {
  return (
    <View className="overflow-hidden border-2 border-ink-800 bg-ink-900">
      <View aria-hidden className={`h-1.5 ${BAND[entry.category]}`} />
      <Thumbnail entry={entry} />
      <View className="gap-1.5 p-4">
        <Heading level={3} className="my-0 font-display text-lg leading-tight text-ink-50">{entry.name}</Heading>
        <Text className="font-mono text-xs text-orange-300">{entry.ours}</Text>
        <Paragraph className="my-0 text-sm text-silver-300">{entry.note}</Paragraph>
        <EntryLinks entry={entry} />
      </View>
    </View>
  );
}

function IndexPage() {
  const groups = byCategory();
  return (
    <View className="min-h-screen gap-10 bg-ink-950 px-4 py-8 md:px-10">
      <View className="max-w-3xl gap-3">
        <Heading level={1} className="my-0 font-display text-4xl text-ink-50 md:text-5xl">NeonBlade, ported</Heading>
        <Paragraph className="my-0 text-base text-silver-300">
          All {CATALOG.length} NeonBlade UI components in the site&apos;s categories. Each card runs our port live and links to its
          story here and to the NeonBlade demo. Search the sidebar by NeonBlade&apos;s names too: every component has an entry under
          NeonBlade/Index.
        </Paragraph>
      </View>
      {groups.map((g) => (
        <Section key={g.category} aria-label={g.name} className="gap-4">
          <Heading level={2} className="my-0 font-display text-2xl text-ink-50">
            {`${g.name} (${g.entries.length})`}
          </Heading>
          <List className="m-0 flex-row flex-wrap gap-4 p-0">
            {g.entries.map((e) => (
              <ListItem key={e.slug} className="w-full list-none md:w-[calc(50%-0.5rem)] xl:w-[calc(33.333%-0.7rem)]">
                <EntryCard entry={e} />
              </ListItem>
            ))}
          </List>
        </Section>
      ))}
    </View>
  );
}

/** One NeonBlade component: names, links and our story full size. */
function Detail({ slug }: { slug: string }) {
  const entry = ENTRY.get(slug)!;
  const Story = previewOf(entry);
  return (
    <View className="min-h-screen bg-ink-950">
      <View className="gap-2 border-b-2 border-ink-800 px-4 py-5 md:px-10">
        <Heading level={1} className="my-0 font-display text-3xl text-ink-50">{entry.name}</Heading>
        <Text className="font-mono text-sm text-orange-300">{entry.ours}</Text>
        <Paragraph className="my-0 text-sm text-silver-300">{entry.note}</Paragraph>
        <EntryLinks entry={entry} />
      </View>
      {Story ? createElement(Story) : null}
    </View>
  );
}

const meta = {
  title: 'NeonBlade/Index',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Every NeonBlade UI component and its NYC-MON port.' } },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The index: all 41, by NeonBlade category. */
export const AllComponents: Story = {
  name: 'All components',
  render: () => <IndexPage />,
};

export const AsciiRain: Story = {
  name: 'ASCII Rain',
  render: () => <Detail slug="backgrounds/ascii-rain" />,
};
export const CyberCircuit: Story = {
  name: 'Cyber Circuit',
  render: () => <Detail slug="backgrounds/cyber-circuit" />,
};
export const DatalinesWithGrid: Story = {
  name: 'Datalines With Grid',
  render: () => <Detail slug="backgrounds/datalines-with-grid" />,
};
export const GlyphCity: Story = {
  name: 'Glyph City',
  render: () => <Detail slug="backgrounds/glyph-city" />,
};
export const GridFloor: Story = {
  name: 'Grid Floor',
  render: () => <Detail slug="backgrounds/grid-floor" />,
};
export const GridScene: Story = {
  name: 'Grid Scene',
  render: () => <Detail slug="backgrounds/grid-scene" />,
};
export const Hexagons: Story = {
  name: 'Hexagons',
  render: () => <Detail slug="backgrounds/hexagons" />,
};
export const HolographicTerrain: Story = {
  name: 'Holographic Terrain',
  render: () => <Detail slug="backgrounds/holographic-terrain" />,
};
export const NeonTide: Story = {
  name: 'Neon Tide',
  render: () => <Detail slug="backgrounds/neon-tide" />,
};
export const Pluviophile: Story = {
  name: 'Pluviophile',
  render: () => <Detail slug="backgrounds/pluviophile" />,
};
export const CornerCutButton: Story = {
  name: 'Corner Cut Button',
  render: () => <Detail slug="buttons/corner-cut-button" />,
};
export const BorderBeamCornerCutCard: Story = {
  name: 'Border Beam Corner Cut Card',
  render: () => <Detail slug="cards/border-beam-corner-cut-card" />,
};
export const NeonGlowCornerCutCard: Story = {
  name: 'Neon Glow Corner Cut Card',
  render: () => <Detail slug="cards/neon-glow-corner-cut-card" />,
};
export const NotchCard: Story = {
  name: 'Notch Card',
  render: () => <Detail slug="cards/notch-card" />,
};
export const NeonBarChart: Story = {
  name: 'Neon Bar Chart',
  render: () => <Detail slug="charts/neon-bar-chart" />,
};
export const NeonDonutChart: Story = {
  name: 'Neon Donut Chart',
  render: () => <Detail slug="charts/neon-donut-chart" />,
};
export const NeonLineChart: Story = {
  name: 'Neon Line Chart',
  render: () => <Detail slug="charts/neon-line-chart" />,
};
export const NeonSparkline: Story = {
  name: 'Neon Sparkline',
  render: () => <Detail slug="charts/neon-sparkline" />,
};
export const StatCard: Story = {
  name: 'Stat Card',
  render: () => <Detail slug="charts/stat-card" />,
};
export const Crosshair: Story = {
  name: 'Crosshair',
  render: () => <Detail slug="cursors/crosshair" />,
};
export const FoxCursor: Story = {
  name: 'Fox Cursor',
  render: () => <Detail slug="cursors/fox-cursor" />,
};
export const AccentFrame: Story = {
  name: 'Accent Frame',
  render: () => <Detail slug="elements/accent-frame" />,
};
export const Badge: Story = {
  name: 'Badge',
  render: () => <Detail slug="elements/badge" />,
};
export const NeonModal: Story = {
  name: 'Neon Modal',
  render: () => <Detail slug="elements/neon-modal" />,
};
export const Timeline: Story = {
  name: 'Timeline',
  render: () => <Detail slug="elements/timeline" />,
};
export const Footer: Story = {
  name: 'Footer',
  render: () => <Detail slug="footers/footer" />,
};
export const NeonCheckbox: Story = {
  name: 'Neon Checkbox',
  render: () => <Detail slug="inputs/neon-checkbox" />,
};
export const NeonInput: Story = {
  name: 'Neon Input',
  render: () => <Detail slug="inputs/neon-input" />,
};
export const NeonSelect: Story = {
  name: 'Neon Select',
  render: () => <Detail slug="inputs/neon-select" />,
};
export const NeonToggle: Story = {
  name: 'Neon Toggle',
  render: () => <Detail slug="inputs/neon-toggle" />,
};
export const Navbar: Story = {
  name: 'NavBar',
  render: () => <Detail slug="navbars/navbar" />,
};
export const ArrowLoader: Story = {
  name: 'Arrow Loader',
  render: () => <Detail slug="progress/arrow-loader" />,
};
export const CircularProgress: Story = {
  name: 'Circular Progress',
  render: () => <Detail slug="progress/circular-progress" />,
};
export const ProgressBar: Story = {
  name: 'Progress Bar',
  render: () => <Detail slug="progress/progress-bar" />,
};
export const RainLoader: Story = {
  name: 'Rain Loader',
  render: () => <Detail slug="progress/rain-loader" />,
};
export const TurbineLoader: Story = {
  name: 'Turbine Loader',
  render: () => <Detail slug="progress/turbine-loader" />,
};
export const CardSlider: Story = {
  name: 'Card Slider',
  render: () => <Detail slug="sliders/card-slider" />,
};
export const NeonTable: Story = {
  name: 'Neon Table',
  render: () => <Detail slug="tables/neon-table" />,
};
export const GlitchText: Story = {
  name: 'Glitch Text',
  render: () => <Detail slug="text/glitch-text" />,
};
export const NeonGlow: Story = {
  name: 'Neon Glow',
  render: () => <Detail slug="text/neon-glow" />,
};
export const OutlineText: Story = {
  name: 'Outline Text',
  render: () => <Detail slug="text/outline-text" />,
};
