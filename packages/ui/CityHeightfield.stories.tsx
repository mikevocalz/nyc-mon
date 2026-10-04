import type { Meta, StoryObj } from '@storybook/react-vite';
import { CityHeightfield, type CityHeightfieldProps } from './backgrounds/CityHeightfield';
import { DISTRICTS, DISTRICT_NAMES } from './district';
import { BackgroundCaption, DistrictGrid } from './backgrounds/story-helpers';
import { Section } from './html';

// CityHeightfield is the solid city-blocks three.js scene (three/CityHeightfield);
// HolographicTerrain is the faithful wireframe port.

const meta = {
  title: 'Backgrounds/CityHeightfield',
  component: CityHeightfield,
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
  args: { district: 'midtown', variant: 'solid', waveAmplitude: 0.8, waveFrequency: 1.5, waveSpeed: 1, bumpRadius: 3.5, bumpStrength: 2.5, cameraHeight: 10, fog: true, opacity: 100, hoverEffect: true, windowLights: true, forceFallback: false },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    variant: { control: 'inline-radio', options: ['solid', 'lines'] },
    waveAmplitude: { control: { type: 'range', min: 0, max: 2, step: 0.05 } },
    waveFrequency: { control: { type: 'range', min: 0.2, max: 4, step: 0.1 } },
    waveSpeed: { control: { type: 'range', min: 0, max: 3, step: 0.1 } },
    bumpRadius: { control: { type: 'range', min: 1, max: 8, step: 0.5 } },
    bumpStrength: { control: { type: 'range', min: 0, max: 6, step: 0.5 } },
    cameraHeight: { control: { type: 'range', min: 3, max: 20, step: 0.5 } },
    gridSegments: { control: { type: 'range', min: 8, max: 120, step: 2 } },
    opacity: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    lineColor: { control: 'color' },
    bgColor: { control: 'color' },
    forceFallback: { description: 'Skip three.js and draw the flat 2D heightfield (CityHeightfieldFlat).' },
  },
} satisfies Meta<typeof CityHeightfield>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop as a control. */
export const Playground: Story = {
  render: (args: CityHeightfieldProps) => (
    <Section className="h-screen min-h-[520px]">
      <CityHeightfield {...args} className="flex-1">
        <BackgroundCaption title="CityHeightfield" line="Solid city blocks built on the Holographic Terrain. Move the pointer to lift them." />
      </CityHeightfield>
    </Section>
  ),
};

/** The flat 2D heightfield, the fallback where no three.js backend runs. */
export const SkiaFallback: Story = { ...Playground, args: { forceFallback: true } };

/** One tile per district. */
export const Districts: Story = {
  render: (args: CityHeightfieldProps) => (
    <DistrictGrid>
      {DISTRICTS.map((district) => (
        <CityHeightfield key={district} {...args} district={district} className="flex-1">
          <BackgroundCaption title={DISTRICT_NAMES[district]} />
        </CityHeightfield>
      ))}
    </DistrictGrid>
  ),
};
