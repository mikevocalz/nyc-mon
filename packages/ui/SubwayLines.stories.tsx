import type { Meta, StoryObj } from '@storybook/react-vite';
import { SubwayLines, type SubwayLinesProps } from './backgrounds/SubwayLines';
import { DISTRICTS, DISTRICT_NAMES } from './backgrounds/district-theme';
import { BackgroundCaption, DistrictGrid } from './backgrounds/story-helpers';
import { Section } from './html';

const meta = {
  title: 'Backgrounds/SubwayLines',
  component: SubwayLines,
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
  args: { district: 'midtown', lineThickness: 2, dotSize: 3, dotType: 'filled', glowIntensity: 'medium', trains: true, speed: 1, seed: 1, opacity: 1, forceFallback: false },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    lineThickness: { control: { type: 'range', min: 1, max: 5, step: 0.5 } },
    dotSize: { control: { type: 'range', min: 1, max: 6, step: 0.5 } },
    dotType: { control: 'inline-radio', options: ['filled', 'outline'] },
    glowIntensity: { control: 'inline-radio', options: ['none', 'soft', 'medium', 'strong'] },
    speed: { control: { type: 'range', min: 0, max: 4, step: 0.1 } },
    color: { control: 'color' },
    glowColor: { control: 'color' },
    forceFallback: { description: 'Draw with Skia even where WebGPU works.' },
  },
} satisfies Meta<typeof SubwayLines>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop as a control. */
export const Playground: Story = {
  render: (args: SubwayLinesProps) => (
    <Section className="h-screen min-h-[520px]">
      <SubwayLines {...args} className="flex-1">
        <BackgroundCaption title="SubwayLines" line="The subway map: route bars, stations, bullets and trains." />
      </SubwayLines>
    </Section>
  ),
};

/** The same background on the Skia fallback, as browsers without WebGPU see it. */
export const SkiaFallback: Story = { ...Playground, args: { forceFallback: true } };

/** One tile per district. */
export const Districts: Story = {
  render: (args: SubwayLinesProps) => (
    <DistrictGrid>
      {DISTRICTS.map((district) => (
        <SubwayLines key={district} {...args} district={district} className="flex-1">
          <BackgroundCaption title={DISTRICT_NAMES[district]} />
        </SubwayLines>
      ))}
    </DistrictGrid>
  ),
};
