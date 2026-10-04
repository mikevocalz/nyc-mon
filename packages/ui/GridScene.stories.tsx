import type { Meta, StoryObj } from '@storybook/react-vite';
import { GridScene, type GridSceneProps } from './backgrounds/GridScene';
import { DISTRICTS, DISTRICT_NAMES } from './district';
import { BackgroundCaption, DistrictGrid } from './backgrounds/story-helpers';
import { Section } from './html';

const meta = {
  title: 'Backgrounds/GridScene',
  component: GridScene,
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
  args: { district: 'megacity', horizon: 0.5, gap: 0.08, columns: 24, rows: 18, speed: 0.6, opacity: 1, lineWidth: 1, showCeiling: true, showFloor: true, forceFallback: false },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    horizon: { control: { type: 'range', min: 0.2, max: 0.8, step: 0.01 } },
    gap: { control: { type: 'range', min: 0, max: 0.3, step: 0.01 } },
    columns: { control: { type: 'range', min: 6, max: 48, step: 1 } },
    rows: { control: { type: 'range', min: 6, max: 40, step: 1 } },
    speed: { control: { type: 'range', min: 0, max: 3, step: 0.05 } },
    opacity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    lineWidth: { control: { type: 'range', min: 0.2, max: 3, step: 0.1 } },
    lineColor: { control: 'color' },
    glowColor: { control: 'color' },
    bgColor: { control: 'color' },
    forceFallback: { description: 'Draw with Skia even where WebGPU works.' },
  },
} satisfies Meta<typeof GridScene>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop as a control. */
export const Playground: Story = {
  render: (args: GridSceneProps) => (
    <Section className="h-screen min-h-[520px]">
      <GridScene {...args} className="flex-1">
        <BackgroundCaption title="GridScene" line="Street grid below, a Mega City deck above." />
      </GridScene>
    </Section>
  ),
};

/** The same background on the Skia fallback, as browsers without WebGPU see it. */
export const SkiaFallback: Story = { ...Playground, args: { forceFallback: true } };

/** One tile per district. */
export const Districts: Story = {
  render: (args: GridSceneProps) => (
    <DistrictGrid>
      {DISTRICTS.map((district) => (
        <GridScene key={district} {...args} district={district} className="flex-1">
          <BackgroundCaption title={DISTRICT_NAMES[district]} />
        </GridScene>
      ))}
    </DistrictGrid>
  ),
};
