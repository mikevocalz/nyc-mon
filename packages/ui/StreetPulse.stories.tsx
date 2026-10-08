import type { Meta, StoryObj } from '@storybook/react-vite';
import { StreetPulse, type StreetPulseProps } from './backgrounds/StreetPulse';
import { DISTRICTS, DISTRICT_NAMES } from './district';
import { BackgroundCaption, DistrictGrid } from './backgrounds/story-helpers';
import { Section } from './html';

const meta = {
  title: 'Backgrounds/StreetPulse',
  component: StreetPulse,
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
  args: { district: 'midtown', cellSize: 50, maxLines: 12, baseSpeed: 2, lineLength: 150, spawnProbability: 0.1, overlay: false, seed: 1, hoverEffect: true, forceFallback: false },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    cellSize: { control: { type: 'range', min: 24, max: 120, step: 2 } },
    maxLines: { control: { type: 'range', min: 1, max: 40, step: 1 } },
    baseSpeed: { control: { type: 'range', min: 0.5, max: 8, step: 0.5 } },
    lineLength: { control: { type: 'range', min: 30, max: 400, step: 10 } },
    spawnProbability: { control: { type: 'range', min: 0, max: 0.3, step: 0.01 } },
    lineColor: { control: 'color' },
    shadowColor: { control: 'color' },
    bgGridColor: { control: 'color' },
    forceFallback: { description: 'Draw with Skia even where WebGPU works.' },
  },
} satisfies Meta<typeof StreetPulse>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop as a control. */
export const Playground: Story = {
  render: (args: StreetPulseProps) => (
    <Section className="h-screen min-h-[520px]">
      <StreetPulse {...args} className="flex-1">
        <BackgroundCaption title="StreetPulse" line="Traffic pulses running a solid street grid. Point at a block to light it." />
      </StreetPulse>
    </Section>
  ),
};

/** The same background on the Skia fallback, as browsers without WebGPU see it. */
export const SkiaFallback: Story = { ...Playground, args: { forceFallback: true } };

/** One tile per district. */
export const Districts: Story = {
  render: (args: StreetPulseProps) => (
    <DistrictGrid>
      {DISTRICTS.map((district) => (
        <StreetPulse key={district} {...args} district={district} className="flex-1">
          <BackgroundCaption title={DISTRICT_NAMES[district]} />
        </StreetPulse>
      ))}
    </DistrictGrid>
  ),
};
