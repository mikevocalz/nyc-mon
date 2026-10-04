import type { Meta, StoryObj } from '@storybook/react-vite';
import { RiverTide, type RiverTideProps } from './backgrounds/RiverTide';
import { DISTRICTS, DISTRICT_NAMES } from './backgrounds/district-theme';
import { BackgroundCaption, DistrictGrid } from './backgrounds/story-helpers';
import { Section } from './html';

const meta = {
  title: 'Backgrounds/RiverTide',
  component: RiverTide,
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
  args: { district: 'downtown', origin: 'top-right', speed: 0.5, amplitude: 1.2, frequency: 0.55, glow: 0.9, gloss: 0.6, bands: 7, shore: true, opacity: 100, hoverEffect: true, hoverRadius: 4, hoverStrength: 1.4, seed: 1, forceFallback: false },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    origin: { control: 'inline-radio', options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] },
    speed: { control: { type: 'range', min: 0, max: 2, step: 0.05 } },
    amplitude: { control: { type: 'range', min: 0, max: 3, step: 0.1 } },
    frequency: { control: { type: 'range', min: 0.1, max: 2, step: 0.05 } },
    glow: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    gloss: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    bands: { control: { type: 'range', min: 3, max: 12, step: 1 } },
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
