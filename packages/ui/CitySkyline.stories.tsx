import type { Meta, StoryObj } from '@storybook/react-vite';
import { CitySkyline } from './backgrounds/CitySkyline';
import type { CitySkylineProps } from './backgrounds/CitySkyline.types';
import { DISTRICTS, DISTRICT_NAMES } from './district';
import { BackgroundCaption, DistrictGrid } from './backgrounds/story-helpers';
import { Section } from './html';

const meta = {
  title: 'Backgrounds/CitySkyline',
  component: CitySkyline,
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
  args: {
    district: 'all',
    seed: 1,
    speed: 1,
    showVehicles: true,
    blinkingLights: true,
    windowLights: true,
    opacity: 1,
    forceFallback: false,
  },
  argTypes: {
    district: { control: 'inline-radio', options: ['all', ...DISTRICTS] },
    variant: { control: 'inline-radio', options: [undefined, 'downtown', 'megacity', 'district', 'ruins'] },
    depth: { control: { type: 'range', min: 1, max: 3, step: 1 } },
    seed: { control: { type: 'number', min: 1, step: 1 } },
    speed: { control: { type: 'range', min: 0, max: 4, step: 0.1 } },
    opacity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    colorPrimary: { control: 'color' },
    colorSecondary: { control: 'color' },
    colorTertiary: { control: 'color' },
    bgColor: { control: 'color' },
    forceFallback: { description: 'Draw with Skia even where WebGPU works.' },
  },
} satisfies Meta<typeof CitySkyline>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The hero: Harlem, Midtown and Downtown, with Mega City looming behind. */
export const Playground: Story = {
  render: (args: CitySkylineProps) => (
    <Section className="h-screen min-h-[520px]">
      <CitySkyline {...args} className="flex-1">
        <BackgroundCaption title="NYC-MON" line="Every block has a legend." />
      </CitySkyline>
    </Section>
  ),
};

/** The same skyline on the Skia fallback, as browsers without WebGPU see it. */
export const SkiaFallback: Story = { ...Playground, args: { forceFallback: true } };

/** One skyline per district. */
export const Districts: Story = {
  render: (args: CitySkylineProps) => (
    <DistrictGrid>
      {DISTRICTS.map((district) => (
        <CitySkyline key={district} {...args} district={district} className="flex-1">
          <BackgroundCaption title={DISTRICT_NAMES[district]} />
        </CitySkyline>
      ))}
    </DistrictGrid>
  ),
};
