import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { CityHeightfield } from './backgrounds/CityHeightfield';
import { CitySkyline } from './backgrounds/CitySkyline';
import { DISTRICTS, DISTRICT_NAMES, type District } from './district';
import { GridFloor } from './backgrounds/GridFloor';
import { GridScene } from './backgrounds/GridScene';
import { RainWindow } from './backgrounds/RainWindow';
import { RiverTide } from './backgrounds/RiverTide';
import { SignRain } from './backgrounds/SignRain';
import { BackgroundCaption } from './backgrounds/story-helpers';
import { StreetPulse } from './backgrounds/StreetPulse';
import { SubwayLines } from './backgrounds/SubwayLines';
import { Heading, List, ListItem, Section } from './html';
import { View } from './tw';

interface AllArgs {
  district: District;
  forceFallback: boolean;
}

const meta = {
  title: 'Backgrounds/All',
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
  args: { district: 'midtown', forceFallback: false },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    forceFallback: { description: 'Draw every tile with Skia even where WebGPU works.' },
  },
} satisfies Meta<AllArgs>;

export default meta;
type Story = StoryObj<AllArgs>;

type Render = (district: District, forceFallback: boolean) => ReactNode;

/** Every background, by the name it ships under and the NeonBlade component it ports. */
const BACKGROUNDS: { name: string; from: string; render: Render }[] = [
  { name: 'CitySkyline', from: 'Glyph City', render: (d, f) => <CitySkyline district={d} forceFallback={f} className="flex-1" /> },
  { name: 'SignRain', from: 'ASCII Rain', render: (d, f) => <SignRain district={d} forceFallback={f} className="flex-1" /> },
  { name: 'SubwayLines', from: 'Cyber Circuit', render: (d, f) => <SubwayLines district={d} forceFallback={f} className="flex-1" /> },
  { name: 'StreetPulse', from: 'Datalines with Grid', render: (d, f) => <StreetPulse district={d} forceFallback={f} className="flex-1" /> },
  { name: 'CityHeightfield', from: 'Holographic Terrain', render: (d, f) => <CityHeightfield district={d} forceFallback={f} className="flex-1" /> },
  { name: 'RiverTide', from: 'Neon Tide', render: (d, f) => <RiverTide district={d} forceFallback={f} className="flex-1" /> },
  { name: 'RainWindow', from: 'Pluviophile', render: (d, f) => <RainWindow district={d} forceFallback={f} className="flex-1" /> },
  { name: 'GridFloor', from: 'Grid Floor', render: (d, f) => <GridFloor district={d} skyline forceFallback={f} className="flex-1" /> },
  { name: 'GridScene', from: 'Grid Scene', render: (d, f) => <GridScene district={d} forceFallback={f} className="flex-1" /> },
];

/** Prop variants worth seeing next to the defaults. */
const VARIANTS: { name: string; render: (f: boolean) => ReactNode }[] = [
  { name: 'CitySkyline, panorama', render: (f) => <CitySkyline district="all" forceFallback={f} className="flex-1" /> },
  { name: 'CitySkyline, one layer', render: (f) => <CitySkyline variant="ruins" depth={1} forceFallback={f} className="flex-1" /> },
  { name: 'SubwayLines, outline dots', render: (f) => <SubwayLines district="downtown" dotType="outline" lineThickness={3} glowIntensity="strong" forceFallback={f} className="flex-1" /> },
  { name: 'SignRain, big type, no skyline', render: (f) => <SignRain district="harlem" fontSize={24} skyline={false} forceFallback={f} className="flex-1" /> },
  { name: 'StreetPulse, overlay', render: (f) => <StreetPulse district="megacity" cellSize={36} maxLines={24} overlay forceFallback={f} className="flex-1" /> },
  { name: 'RiverTide, bottom-left swell', render: (f) => <RiverTide district="harlem" origin="bottom-left" bands={10} forceFallback={f} className="flex-1" /> },
  { name: 'RainWindow, storm', render: (f) => <RainWindow district="downtown" dropCount={320} angle={-30} speed={20} forceFallback={f} className="flex-1" /> },
  { name: 'GridScene, floor only', render: (f) => <GridScene district="midtown" showCeiling={false} horizon={0.3} forceFallback={f} className="flex-1" /> },
];

function Tile({ title, line, children }: { title: string; line?: string; children: ReactNode }) {
  return (
    <ListItem className="h-[240px] list-none overflow-hidden border-2 border-ink-800 md:h-[280px] md:w-[calc(50%-0.5rem)] xl:w-[calc(33.333%-0.667rem)]">
      <View className="relative flex-1">
        {children}
        <BackgroundCaption title={title} line={line} />
      </View>
    </ListItem>
  );
}

/** Every background in one district. Switch districts with the control. */
export const All: Story = {
  render: ({ district, forceFallback }: AllArgs) => (
    <Section className="min-h-screen gap-4 bg-ink-950 p-4">
      <Heading level={1} className="my-0 font-display text-2xl text-ink-50">Backgrounds: {DISTRICT_NAMES[district]}</Heading>
      <List className="m-0 flex-col gap-4 p-0 md:flex-row md:flex-wrap">
        {BACKGROUNDS.map((b) => (
          <Tile key={b.name} title={b.name} line={`Ports ${b.from}`}>{b.render(district, forceFallback)}</Tile>
        ))}
      </List>
    </Section>
  ),
};

/** Every background in all four districts: one row per background. */
export const EveryDistrict: Story = {
  render: ({ forceFallback }: AllArgs) => (
    <Section className="min-h-screen gap-6 bg-ink-950 p-4">
      {BACKGROUNDS.map((b) => (
        <Section key={b.name} className="gap-2">
          <Heading level={2} className="my-0 font-display text-xl text-ink-50">{b.name}</Heading>
          <List className="m-0 flex-col gap-3 p-0 md:flex-row">
            {DISTRICTS.map((d) => (
              <ListItem key={d} className="h-[180px] list-none overflow-hidden border-2 border-ink-800 md:flex-1">
                <View className="relative flex-1">
                  {b.render(d, forceFallback)}
                  <BackgroundCaption title={DISTRICT_NAMES[d]} />
                </View>
              </ListItem>
            ))}
          </List>
        </Section>
      ))}
    </Section>
  ),
};

/** Prop variants: panorama, single layer, outline dots, big type, overlay, swell origin, storm, floor only. */
export const Variants: Story = {
  render: ({ forceFallback }: AllArgs) => (
    <Section className="min-h-screen gap-4 bg-ink-950 p-4">
      <List className="m-0 flex-col gap-4 p-0 md:flex-row md:flex-wrap">
        {VARIANTS.map((v) => (
          <Tile key={v.name} title={v.name}>{v.render(forceFallback)}</Tile>
        ))}
      </List>
    </Section>
  ),
};
