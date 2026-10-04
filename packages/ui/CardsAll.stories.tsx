import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';
import { Button } from './Button';
import { CardSlider } from './cards/CardSlider';
import { DISTRICT_NAME, DISTRICTS, type District } from './district';
import { Heading, Main, Paragraph, Section } from './html';
import { View } from './tw';

const meta = {
  title: 'Cards/All',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const COPY: Record<District, { notch: string; cut: string; beam: string; line: string }> = {
  downtown: { notch: 'Bowling Green', cut: 'Wall Street', beam: 'One World', line: 'Glass towers, setbacks and a spire over the tightest streets in town.' },
  midtown: { notch: 'Empire block', cut: 'Chrysler crown', beam: 'Grand Central', line: 'Deco crowns, stepped setbacks and water towers on the roofs.' },
  harlem: { notch: 'Lenox stoop', cut: 'Strivers Row', beam: 'The Apollo', line: 'Brownstone rows, stoops and cornices, with the projects behind.' },
  megacity: { notch: 'Level 90', cut: 'Grid 12', beam: 'East bridge', line: 'Stacked megastructures joined by sky bridges, still on the grid.' },
};

/** Every NeonBlade card variant in every district, then the card slider. One column at 390px, more from md. */
export const All: Story = {
  render: () => (
    <Main className="min-h-screen gap-10 bg-ink-950 px-4 py-8 md:px-10">
      {DISTRICTS.map((d) => (
        <Section key={d} aria-label={DISTRICT_NAME[d]} className="gap-4">
          <Heading level={2} className="my-0 font-display text-2xl text-ink-50">{DISTRICT_NAME[d]}</Heading>
          <View className="gap-6 md:flex-row">
            <Card className="md:flex-1" variant="notch" district={d} title={COPY[d].notch} description={COPY[d].line} />
            <Card className="md:flex-1" variant="cornerCut" district={d} title={COPY[d].cut} description={COPY[d].line}>
              <Button variant="cornerCut" district={d} size="sm" title="Claim block" onPress={() => {}} />
            </Card>
            <Card className="md:flex-1" variant="beam" district={d} title={COPY[d].beam} description={COPY[d].line} beamVariant={d === 'megacity' ? 'dual' : d === 'harlem' ? 'pulse' : 'single'} />
          </View>
        </Section>
      ))}
      <Section aria-label="Card slider" className="gap-4">
        <Heading level={2} className="my-0 font-display text-2xl text-ink-50">Card slider</Heading>
        <Paragraph className="my-0 text-silver-300">Swipe, scroll, use the buttons, or focus the track and press the arrow keys.</Paragraph>
        <CardSlider label="Blocks by district" visibleCount={{ sm: 1, md: 2, xl: 3 }} district="midtown">
          {DISTRICTS.flatMap((d) => [
            <Card key={`${d}-n`} variant="notch" district={d} title={COPY[d].notch} description={COPY[d].line} />,
            <Card key={`${d}-b`} variant="cornerCut" district={d} title={COPY[d].cut} description={COPY[d].line} />,
          ])}
        </CardSlider>
      </Section>
    </Main>
  ),
};
