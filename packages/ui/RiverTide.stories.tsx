import type { Meta, StoryObj } from '@storybook/react-vite';
import { RiverTide, type RiverTideProps } from './backgrounds/RiverTide';
import { DISTRICTS, DISTRICT_NAMES } from './district';
import { BackgroundCaption, DistrictGrid } from './backgrounds/story-helpers';
import { Section } from './html';

const meta = {
  title: 'Backgrounds/RiverTide',
  component: RiverTide,
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
  args: { district: 'downtown', origin: 'top-right', speed: 0.5, amplitude: 1.2, frequency: 0.55, glow: 0.9, gloss: 0.6, bands: 7, shore: true, horizon: 0.34, opacity: 100, hoverEffect: true, hoverRadius: 4, hoverStrength: 1.4, seed: 1, forceFallback: false },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    origin: { control: 'inline-radio', options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] },
    speed: { control: { type: 'range', min: 0, max: 2, step: 0.05 } },
    amplitude: { control: { type: 'range', min: 0, max: 3, step: 0.1 } },
    frequency: { control: { type: 'range', min: 0.1, max: 2, step: 0.05 } },
    glow: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    gloss: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    bands: { control: { type: 'range', min: 3, max: 12, step: 1 } },
    horizon: { control: { type: 'range', min: 0.15, max: 0.7, step: 0.01 } },
    opacity: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    colorA: { control: 'color' },
    colorB: { control: 'color' },
    bgColor: { control: 'color' },
    forceFallback: { description: 'Draw with Skia even where WebGPU works.' },
  },
} satisfies Meta<typeof RiverTide>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop as a control. */
export const Playground: Story = {
  render: (args: RiverTideProps) => (
    <Section className="h-screen min-h-[520px]">
      <RiverTide {...args} className="flex-1">
        <BackgroundCaption title="RiverTide" line="The river at night under the far-shore skyline. The swell rises under the pointer." />
      </RiverTide>
    </Section>
  ),
};

/** The same background on the Skia fallback, as browsers without WebGPU see it. */
export const SkiaFallback: Story = { ...Playground, args: { forceFallback: true } };

/** One tile per district. */
export const Districts: Story = {
  render: (args: RiverTideProps) => (
    <DistrictGrid>
      {DISTRICTS.map((district) => (
        <RiverTide key={district} {...args} district={district} className="flex-1">
          <BackgroundCaption title={DISTRICT_NAMES[district]} />
        </RiverTide>
      ))}
    </DistrictGrid>
  ),
};

/**
 * Harlem's East River in a short band, as the site footer frames it: the
 * brownstone shore low on the horizon, apple beacons, warm window light on
 * the swell.
 */
export const HarlemBand: Story = {
  name: 'Harlem band',
  args: { district: 'harlem', horizon: 0.5, bands: 5, amplitude: 0.8, origin: 'bottom-left' },
  render: (args: RiverTideProps) => (
    <Section className="min-h-screen justify-end gap-6 bg-ink-950">
      <RiverTide {...args} className="h-32 flex-none md:h-44" />
      <RiverTide {...args} className="h-44 flex-none md:h-64" />
      <RiverTide {...args} horizon={0.34} bands={7} amplitude={1.2} origin="top-right" className="h-32 flex-none md:h-44" />
    </Section>
  ),
};
