import type { Meta, StoryObj } from '@storybook/react-vite';
import { neon } from '@acme/theme';
import { BrandLogo } from './brand/BrandLogo';
import { CircuitButton } from './future/CircuitButton';
import { GridCard } from './future/GridCard';
import { GlyphCity } from './backgrounds/GlyphCity';
import { GridFloor, type GridFloorProps } from './backgrounds/GridFloor';
import { GridScene } from './backgrounds/GridScene';
import { Heading, Paragraph, Section } from './html';
import { View } from './tw';

const meta = {
  title: 'NYC Mon/Grid world',
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The home hero: badge over a NeonBlade-style floor and the glyph skyline. */
export const Gateway: Story = {
  render: () => (
    <View className="h-screen min-h-[720px] bg-bg">
      <GridFloor className="flex-1" horizon={0.45} speed={0.35}>
        <View className="pointer-events-none absolute inset-x-0 top-0 h-[45%]">
          <GlyphCity className="flex-1" variant="megacity" colorPrimary={neon.glow} colorSecondary={neon.line} colorTertiary={neon.glowSoft} opacity={0.5} />
        </View>
        <View className="mx-auto w-full max-w-6xl flex-1 items-center justify-center gap-8 px-6 py-10 md:flex-row">
          <View className="md:order-2">
            <BrandLogo size={300} />
          </View>
          <View className="max-w-xl flex-1 gap-4 md:order-1">
            <Heading level={1} className="my-0 font-display text-4xl text-primary md:text-6xl">Every block has a legend.</Heading>
            <Paragraph className="my-0 text-base leading-7 text-white/80">
              Race light cycles across a neon New York grid on your phone, in the browser, or in a headset.
            </Paragraph>
            <View className="flex-row flex-wrap gap-3">
              <CircuitButton tone="orange" variant="solid">Start a race</CircuitButton>
              <CircuitButton>Enter the VR grid</CircuitButton>
            </View>
          </View>
        </View>
      </GridFloor>
    </View>
  ),
};

/**
 * NeonBlade Grid Floor props, NYC Mon defaults. Turn on reduced motion in the
 * OS (or emulate `prefers-reduced-motion: reduce`) and the scroll stops.
 */
export const GridFloorPlayground: StoryObj<GridFloorProps> = {
  args: {
    horizon: 0.45,
    columns: 24,
    rows: 18,
    lineColor: neon.line,
    glowColor: neon.glow,
    horizonGlowColor: neon.glowSoft,
    bgColor: neon.bg,
    speed: 0.6,
    opacity: 0.85,
    lineWidth: 1,
  },
  argTypes: {
    horizon: { control: { type: 'range', min: 0.1, max: 0.9, step: 0.01 } },
    speed: { control: { type: 'range', min: 0, max: 2, step: 0.05 } },
    opacity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    lineWidth: { control: { type: 'range', min: 0.5, max: 4, step: 0.5 } },
    lineColor: { control: 'color' },
    glowColor: { control: 'color' },
    horizonGlowColor: { control: 'color' },
    bgColor: { control: 'color' },
  },
  render: (args) => (
    <View className="h-screen min-h-[560px]">
      <GridFloor {...args} className="flex-1" />
    </View>
  ),
};

/** The three canvases side by side in brand colours. */
export const BackgroundSystems: Story = {
  render: () => (
    <View className="min-h-screen gap-6 bg-bg p-6">
      <Section className="h-[360px] overflow-hidden border border-structure/40">
        <GridFloor>
          <View className="flex-1 items-center justify-center">
            <Heading level={2} className="my-0 font-display text-xl text-primary">Grid floor</Heading>
          </View>
        </GridFloor>
      </Section>
      <Section className="h-[360px] overflow-hidden border border-structure/40">
        <GridScene>
          <View className="flex-1 items-center justify-center">
            <Heading level={2} className="my-0 font-display text-xl text-accent">Grid scene, floor and ceiling</Heading>
          </View>
        </GridScene>
      </Section>
      <Section className="h-[360px] overflow-hidden border border-structure/40">
        <GridScene showCeiling={false}>
          <View className="absolute inset-x-0 bottom-0 h-2/3">
            <GlyphCity className="flex-1" variant="downtown" />
          </View>
        </GridScene>
      </Section>
    </View>
  ),
};

/** Every tone and variant of the circuit button, and the card tones. */
export const FutureControls: Story = {
  render: () => (
    <View className="min-h-screen gap-6 bg-bg p-8">
      <View className="flex-row flex-wrap gap-3">
        <CircuitButton tone="orange" variant="solid">Start a race</CircuitButton>
        <CircuitButton tone="orange">Solo against AI</CircuitButton>
        <CircuitButton tone="carolina" variant="solid">Join table</CircuitButton>
        <CircuitButton tone="carolina">Enter the VR grid</CircuitButton>
        <CircuitButton tone="royal" variant="solid">Create table</CircuitButton>
        <CircuitButton tone="royal">Leave session</CircuitButton>
      </View>
      <View className="gap-4 md:flex-row">
        <GridCard className="flex-1" title="Royal card" eyebrow="Default tone">
          <Paragraph className="my-0 text-sm text-white/75">Structure: rules, outlines and the glow under the grid.</Paragraph>
        </GridCard>
        <GridCard className="flex-1" title="Carolina card" tone="carolina">
          <Paragraph className="my-0 text-sm text-white/75">Secondary actions and information.</Paragraph>
        </GridCard>
        <GridCard className="flex-1" title="Orange card" tone="orange">
          <Paragraph className="my-0 text-sm text-white/75">The main action on a screen.</Paragraph>
        </GridCard>
      </View>
    </View>
  ),
};
