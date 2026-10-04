import type { Meta, StoryObj } from '@storybook/react-vite';
import { DISTRICTS, DISTRICT_NAMES } from './backgrounds/district-theme';
import { BackgroundCaption, DistrictGrid } from './backgrounds/story-helpers';
import { Section } from './html';
import { HolographicTerrain, type HolographicTerrainProps } from './three/HolographicTerrain';

const meta = {
  title: 'Backgrounds/HolographicTerrain',
  component: HolographicTerrain,
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
  args: {
    district: 'midtown',
    variant: 'solid',
    waveAmplitude: 0.8,
    waveFrequency: 1.5,
    waveSpeed: 1,
    bumpRadius: 3.5,
    bumpStrength: 2.5,
    planeWidth: 48,
    planeDepth: 28,
    cameraHeight: 10,
    fog: true,
    fogDensity: 0.07,
    opacity: 100,
    hoverEffect: true,
    cursorEffect: 'lift',
    windowLights: true,
    scrollSpeed: 0.6,
    paused: false,
    forceWebGL: false,
    forceFallback: false,
  },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    variant: { control: 'inline-radio', options: ['solid', 'lines'] },
    cursorEffect: { control: 'inline-radio', options: ['lift', 'ripple'] },
    waveAmplitude: { control: { type: 'range', min: 0, max: 2, step: 0.05 } },
    waveFrequency: { control: { type: 'range', min: 0.2, max: 4, step: 0.1 } },
    waveSpeed: { control: { type: 'range', min: 0, max: 3, step: 0.1 } },
    bumpRadius: { control: { type: 'range', min: 1, max: 8, step: 0.5 } },
    bumpStrength: { control: { type: 'range', min: 0, max: 6, step: 0.5 } },
    planeWidth: { control: { type: 'range', min: 16, max: 96, step: 4 } },
    planeDepth: { control: { type: 'range', min: 12, max: 60, step: 2 } },
    cameraHeight: { control: { type: 'range', min: 3, max: 20, step: 0.5 } },
    gridSegments: { control: { type: 'range', min: 8, max: 120, step: 2 } },
    fogDensity: { control: { type: 'range', min: 0, max: 0.12, step: 0.005 } },
    opacity: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    scrollSpeed: { control: { type: 'range', min: 0, max: 3, step: 0.1 } },
    lineColor: { control: 'color' },
    bgColor: { control: 'color' },
    forceWebGL: { description: "Web: run WebGPURenderer on its WebGL2 backend even where WebGPU works." },
    forceFallback: { description: 'Skip three.js and draw the flat 2D heightfield.' },
  },
} satisfies Meta<typeof HolographicTerrain>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop as a control. Move the pointer (or drag a finger) to lift the blocks. */
export const Playground: Story = {
  render: (args: HolographicTerrainProps) => (
    <Section className="h-screen min-h-[520px]">
      <HolographicTerrain {...args} className="flex-1">
        <BackgroundCaption title="Holographic Terrain" line="Solid city blocks in three.js. Move the pointer to lift them." />
      </HolographicTerrain>
    </Section>
  ),
};

/** One tile per district: tower spine, Deco masses, rows and slabs, megastacks. */
export const Districts: Story = {
  render: (args: HolographicTerrainProps) => (
    <DistrictGrid>
      {DISTRICTS.map((district) => (
        <HolographicTerrain key={district} {...args} district={district} gridSegments={36} className="flex-1">
          <BackgroundCaption title={DISTRICT_NAMES[district]} />
        </HolographicTerrain>
      ))}
    </DistrictGrid>
  ),
};

/** NeonBlade's line look: dark solid blocks with lit edges and floor lines. */
export const Lines: Story = { ...Playground, args: { variant: 'lines', district: 'downtown' } };

/** Rings ripple out from the pointer instead of a single lift. */
export const Ripple: Story = { ...Playground, args: { cursorEffect: 'ripple', district: 'megacity' } };

/**
 * The same scene on WebGPURenderer's WebGL2 backend, as browsers without
 * WebGPU see it. TSL compiles the material (and the TypeGPU height) to GLSL.
 */
export const WebGL2Fallback: Story = {
  render: (args: HolographicTerrainProps) => (
    <Section className="h-screen min-h-[520px]">
      <HolographicTerrain {...args} forceWebGL className="flex-1">
        <BackgroundCaption title="WebGL2 backend" line="WebGPURenderer with forceWebGL. Same TSL, compiled to GLSL." />
      </HolographicTerrain>
    </Section>
  ),
  args: { forceWebGL: true },
};
