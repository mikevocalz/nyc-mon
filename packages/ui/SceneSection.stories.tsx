import type { Meta, StoryObj } from '@storybook/react-vite';
import { brand } from '@acme/theme';
import { GridFloor } from './backgrounds/GridFloor';
import { SceneSection } from './backgrounds/SceneSection';
import { SignRain } from './backgrounds/SignRain';
import { SkylineDivider } from './backgrounds/SkylineDivider';
import { SubwayLines } from './backgrounds/SubwayLines';
import { Heading, Main, Paragraph, Section } from './html';
import { SolidPanel } from './neon/SolidPanel';
import { View } from './tw';

const meta = {
  title: 'Backgrounds/SceneSection',
  component: SceneSection,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SceneSection>;

export default meta;
type Story = StoryObj<typeof meta>;

function Plate({ title, line }: { title: string; line: string }) {
  return (
    <View className="mx-auto w-full max-w-3xl flex-1 justify-end px-4 py-10">
      <SolidPanel tone="ink" depth="lg" className="gap-3 px-5 py-6 md:px-8">
        <Heading level={1} className="my-0 font-display text-3xl text-orange-500">{title}</Heading>
        <Paragraph className="my-0 text-ink-50">{line}</Paragraph>
      </SolidPanel>
    </View>
  );
}

/** GridFloor as a page hero: the street grid runs to a skyline; the lead sits on an ink plate. */
export const GridFloorHero: Story = {
  args: { scene: () => null, children: null },
  render: () => (
    <SceneSection
      className="min-h-[520px]"
      placeholderColor={brand.night}
      scene={({ paused }) => <GridFloor district="midtown" skyline horizon={0.42} paused={paused} className="absolute inset-0" />}
    >
      <Plate title="Explore" line="Templates and resources from every block." />
    </SceneSection>
  ),
};

/** SubwayLines for wayfinding: the 404 page. */
export const SubwayLinesWayfinding: Story = {
  args: { scene: () => null, children: null },
  render: () => (
    <SceneSection
      className="min-h-[520px]"
      placeholderColor={brand.night}
      scene={({ paused }) => <SubwayLines district="midtown" opacity={0.55} paused={paused} className="absolute inset-0" />}
    >
      <Plate title="Page not found" line="This stop is not on the map." />
    </SceneSection>
  ),
};

/** SignRain, used sparingly: the error page. */
export const SignRainError: Story = {
  args: { scene: () => null, children: null },
  render: () => (
    <SceneSection
      className="min-h-[520px]"
      placeholderColor={brand.night}
      scene={({ paused }) => <SignRain district="harlem" opacity={60} paused={paused} className="absolute inset-0" />}
    >
      <Plate title="Something went wrong" line="Try again in a moment." />
    </SceneSection>
  ),
};

/** A whole page: one strong background up top, skyline dividers between the sections below. */
export const Page: Story = {
  args: { scene: () => null, children: null },
  render: () => (
    <Main className="bg-surface">
      <SceneSection
        className="min-h-[520px]"
        placeholderColor={brand.night}
        scene={({ paused }) => <GridFloor district="midtown" skyline horizon={0.42} paused={paused} className="absolute inset-0" />}
      >
        <Plate title="Explore" line="Templates and resources from every block." />
      </SceneSection>
      {['Featured', 'Resources'].map((title, i) => (
        <View key={title}>
          {i > 0 ? <SkylineDivider seed={i + 3} /> : null}
          <Section className="mx-auto w-full max-w-3xl gap-2 px-4 py-16">
            <Heading level={2} className="my-0 font-display text-2xl text-text">{title}</Heading>
            <Paragraph className="my-0 text-text-muted">Section content on the page surface, legible in both themes.</Paragraph>
          </Section>
        </View>
      ))}
    </Main>
  ),
};
