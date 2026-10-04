import type { Meta, StoryObj } from '@storybook/react-vite';
import { SignRain, type SignRainProps } from './backgrounds/SignRain';
import { DISTRICTS, DISTRICT_NAMES } from './backgrounds/district-theme';
import { BackgroundCaption, DistrictGrid } from './backgrounds/story-helpers';
import { Section } from './html';

const meta = {
  title: 'Backgrounds/SignRain',
  component: SignRain,
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
  args: { district: 'midtown', fontSize: 14, speed: 33, opacity: 90, windowShare: 0.25, skyline: true, seed: 1, forceFallback: false },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    fontSize: { control: { type: 'range', min: 8, max: 32, step: 1 } },
    speed: { control: { type: 'range', min: 10, max: 120, step: 1 } },
    opacity: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    windowShare: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    textColor: { control: 'color' },
    signColor: { control: 'color' },
    bgColor: { control: 'color' },
    forceFallback: { description: 'Draw with Skia even where WebGPU works.' },
  },
} satisfies Meta<typeof SignRain>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop as a control. */
export const Playground: Story = {
  render: (args: SignRainProps) => (
    <Section className="h-screen min-h-[520px]">
      <SignRain {...args} className="flex-1">
        <BackgroundCaption title="SignRain" line="Street-sign glyph rain over a solid skyline." />
      </SignRain>
    </Section>
  ),
};

/** The same background on the Skia fallback, as browsers without WebGPU see it. */
export const SkiaFallback: Story = { ...Playground, args: { forceFallback: true } };

/** One tile per district. */
export const Districts: Story = {
  render: (args: SignRainProps) => (
    <DistrictGrid>
      {DISTRICTS.map((district) => (
        <SignRain key={district} {...args} district={district} className="flex-1">
          <BackgroundCaption title={DISTRICT_NAMES[district]} />
        </SignRain>
      ))}
    </DistrictGrid>
  ),
};
