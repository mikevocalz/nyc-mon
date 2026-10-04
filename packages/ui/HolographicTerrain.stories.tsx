import type { Meta, StoryObj } from '@storybook/react-vite';
import { BackgroundCaption } from './backgrounds/story-helpers';
import { Section } from './html';
import { HolographicTerrain, type HolographicTerrainProps } from './three/HolographicTerrain';
import { TERRAIN_COLORS, TERRAIN_DEFAULTS } from './three/terrain/terrain-config';

const meta = {
  title: 'Backgrounds/HolographicTerrain',
  component: HolographicTerrain,
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
  args: { ...TERRAIN_COLORS, ...TERRAIN_DEFAULTS, paused: false, forceWebGL: false },
  argTypes: {
    waveAmplitude: { control: { type: 'range', min: 0, max: 3, step: 0.05 } },
    waveFrequency: { control: { type: 'range', min: 0.1, max: 5, step: 0.1 } },
    waveSpeed: { control: { type: 'range', min: 0, max: 5, step: 0.1 } },
    bumpRadius: { control: { type: 'range', min: 0.5, max: 10, step: 0.5 } },
    bumpStrength: { control: { type: 'range', min: 0, max: 8, step: 0.5 } },
    planeWidth: { control: { type: 'range', min: 8, max: 60, step: 1 } },
    planeDepth: { control: { type: 'range', min: 8, max: 60, step: 1 } },
    cameraHeight: { control: { type: 'range', min: 2, max: 30, step: 0.5 } },
    gridSegments: { control: { type: 'range', min: 8, max: 200, step: 2 } },
    opacity: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    lineColor: { control: 'color' },
    bgColor: { control: 'color' },
    accentColor: { control: 'color' },
    forceWebGL: { description: "Web: run WebGPURenderer on its WebGL2 backend even where WebGPU works." },
  },
} satisfies Meta<typeof HolographicTerrain>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop as a control. Move the pointer (or drag a finger) to raise the bump. */
export const Playground: Story = {
  render: (args: HolographicTerrainProps) => (
    <Section className="h-screen min-h-[520px]">
      <HolographicTerrain {...args} className="flex-1">
        <BackgroundCaption title="Holographic Terrain" line="NeonBlade's wireframe terrain in theme colours. Move the pointer to lift it." />
      </HolographicTerrain>
    </Section>
  ),
};

/** NeonBlade's own colours (#00ffff on #020a0a, no accent), for comparing against its demo. */
export const NeonBladeColors: Story = {
  ...Playground,
  args: { lineColor: '#00ffff', bgColor: '#020a0a', accentColor: '#00ffff' },
};

/**
 * The terrain as NeonBlade's component page previews it (30 segments,
 * amplitude 0.6, a 28 x 28 plane, camera at 9), in theme colours.
 */
export const PagePreview: Story = {
  ...Playground,
  args: { gridSegments: 30, waveAmplitude: 0.6, planeWidth: 28, planeDepth: 28, cameraHeight: 9 },
};

/** NeonBlade's page preview in its own colours, for side-by-side checks. */
export const PagePreviewNeonBladeColors: Story = {
  ...Playground,
  args: { ...PagePreview.args, lineColor: '#00ffff', bgColor: '#020a0a', accentColor: '#00ffff' },
};

/**
 * The same scene on WebGPURenderer's WebGL2 backend, as browsers without
 * WebGPU see it. TSL compiles the material (and the TypeGPU height) to GLSL.
 */
export const WebGL2Fallback: Story = { ...Playground, args: { forceWebGL: true } };
