import type { Meta, StoryObj } from '@storybook/react-vite';
import { GridFloor, type GridFloorProps } from './backgrounds/GridFloor';
import { DISTRICTS, DISTRICT_NAMES } from './backgrounds/district-theme';
import { BackgroundCaption, DistrictGrid } from './backgrounds/story-helpers';
import { Section } from './html';

const meta = {
  title: 'Backgrounds/GridFloor',
  component: GridFloor,
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
  args: { district: 'midtown', horizon: 0.45, columns: 24, rows: 18, speed: 0.6, opacity: 1, lineWidth: 1, skyline: true, forceFallback: false },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    horizon: { control: { type: 'range', min: 0.1, max: 0.8, step: 0.01 } },
    columns: { control: { type: 'range', min: 6, max: 48, step: 1 } },
    rows: { control: { type: 'range', min: 6, max: 40, step: 1 } },
    speed: { control: { type: 'range', min: 0, max: 3, step: 0.05 } },
    opacity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    lineWidth: { control: { type: 'range', min: 0.2, max: 3, step: 0.1 } },
    lineColor: { control: 'color' },
    glowColor: { control: 'color' },
    horizonGlowColor: { control: 'color' },
    bgColor: { control: 'color' },
    forceFallback: { description: 'Draw with Skia even where WebGPU works.' },
  },
} satisfies Meta<typeof GridFloor>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop as a control. */
export const Playground: Story = {
  render: (args: GridFloorProps) => (
    <Section className="h-screen min-h-[520px]">
      <GridFloor {...args} className="flex-1">
        <BackgroundCaption title="GridFloor" line="A solid street-grid ground plane with avenue lighting." />
      </GridFloor>
    </Section>
  ),
};

/** The same background on the Skia fallback, as browsers without WebGPU see it. */
export const SkiaFallback: Story = { ...Playground, args: { forceFallback: true } };

/** One tile per district. */
export const Districts: Story = {
  render: (args: GridFloorProps) => (
    <DistrictGrid>
      {DISTRICTS.map((district) => (
        <GridFloor key={district} {...args} district={district} className="flex-1">
          <BackgroundCaption title={DISTRICT_NAMES[district]} />
        </GridFloor>
      ))}
    </DistrictGrid>
  ),
};
