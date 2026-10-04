import type { Meta, StoryObj } from '@storybook/react-vite';
import { BackgroundCaption } from './backgrounds/story-helpers';
import { Section } from './html';
import { NeonTide, type NeonTideProps } from './three/NeonTide';

const meta = {
  title: 'Backgrounds/NeonTide',
  component: NeonTide,
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
  args: {
    origin: 'top-right',
    speed: 0.5,
    amplitude: 1.2,
    frequency: 0.55,
    glow: 0.9,
    gloss: 0.6,
    planeWidth: 34,
    planeDepth: 34,
    cameraHeight: 11,
    cameraTilt: 1.6,
    gridSegments: 120,
    fog: true,
    opacity: 100,
    hoverEffect: true,
    hoverRadius: 4,
    hoverStrength: 1.4,
    paused: false,
    forceWebGL: false,
    forceFallback: false,
  },
  argTypes: {
    origin: { control: 'inline-radio', options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] },
    speed: { control: { type: 'range', min: 0, max: 2, step: 0.05 } },
    amplitude: { control: { type: 'range', min: 0, max: 3, step: 0.05 } },
    frequency: { control: { type: 'range', min: 0.1, max: 2, step: 0.05 } },
    glow: { control: { type: 'range', min: 0, max: 3, step: 0.05 } },
    gloss: { control: { type: 'range', min: 0, max: 2, step: 0.05 } },
    planeWidth: { control: { type: 'range', min: 10, max: 80, step: 1 } },
    planeDepth: { control: { type: 'range', min: 10, max: 80, step: 1 } },
    cameraHeight: { control: { type: 'range', min: 3, max: 25, step: 0.5 } },
    cameraTilt: { control: { type: 'range', min: 0.5, max: 4, step: 0.05 } },
    gridSegments: { control: { type: 'range', min: 8, max: 220, step: 1 } },
    opacity: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    hoverRadius: { control: { type: 'range', min: 0.5, max: 10, step: 0.5 } },
    hoverStrength: { control: { type: 'range', min: 0, max: 4, step: 0.1 } },
    colorA: { control: 'color' },
    colorB: { control: 'color' },
    glossColor: { control: 'color' },
    bgColor: { control: 'color' },
    forceWebGL: { description: 'Web: run WebGPURenderer on its WebGL2 backend even where WebGPU works.' },
    forceFallback: { description: 'Skip three.js and draw the flat 2D bands (RiverTide).' },
  },
} satisfies Meta<typeof NeonTide>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop as a control, in the theme colours. Move the pointer (or drag a finger) to raise the surface. */
export const Playground: Story = {
  render: (args: NeonTideProps) => (
    <Section className="h-screen min-h-[520px]">
      <NeonTide {...args} className="flex-1">
        <BackgroundCaption title="Neon Tide" line="A wave surface in three.js, royal to carolina. Move the pointer to raise it." />
      </NeonTide>
    </Section>
  ),
};

/** NeonBlade's own defaults (single-colour cyan on #020408, white highlights), to compare against the original demo. */
export const NeonBladeColors: Story = {
  ...Playground,
  args: { colorA: '#00f3ff', glossColor: '#ffffff', bgColor: '#020408' },
};

/** Waves from the bottom-left corner, single colour: carolina only. */
export const BottomLeft: Story = { ...Playground, args: { origin: 'bottom-left', colorA: '#4BA8F0' } };

/**
 * The same scene on WebGPURenderer's WebGL2 backend, as browsers without
 * WebGPU see it. TSL compiles the material (and the TypeGPU wave) to GLSL.
 */
export const WebGL2Fallback: Story = {
  render: (args: NeonTideProps) => (
    <Section className="h-screen min-h-[520px]">
      <NeonTide {...args} forceWebGL className="flex-1">
        <BackgroundCaption title="WebGL2 backend" line="WebGPURenderer with forceWebGL. Same TSL, compiled to GLSL." />
      </NeonTide>
    </Section>
  ),
  args: { forceWebGL: true },
};

/** The flat 2D bands, where no three.js backend runs (native without WebGPU). */
export const FlatFallback: Story = { ...Playground, args: { forceFallback: true } };
