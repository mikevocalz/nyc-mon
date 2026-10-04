import type { Meta, StoryObj } from '@storybook/react-vite';
import { RainWindow, type RainWindowProps } from './backgrounds/RainWindow';
import { DISTRICTS, DISTRICT_NAMES } from './district';
import { BackgroundCaption, DistrictGrid } from './backgrounds/story-helpers';
import { Section } from './html';

const meta = {
  title: 'Backgrounds/RainWindow',
  component: RainWindow,
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
  args: { district: 'harlem', dropCount: 150, speed: 12, angle: -15, dropMinLength: 15, dropMaxLength: 40, dropWidth: 1, opacity: 0.75, frame: true, seed: 1, forceFallback: false },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    dropCount: { control: { type: 'range', min: 0, max: 500, step: 10 } },
    speed: { control: { type: 'range', min: 1, max: 40, step: 1 } },
    angle: { control: { type: 'range', min: -60, max: 60, step: 1 } },
    dropMinLength: { control: { type: 'range', min: 4, max: 60, step: 1 } },
    dropMaxLength: { control: { type: 'range', min: 8, max: 120, step: 1 } },
    dropWidth: { control: { type: 'range', min: 0.5, max: 4, step: 0.5 } },
    opacity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    dropColor: { control: 'color' },
    backgroundColor: { control: 'color' },
    forceFallback: { description: 'Draw with Skia even where WebGPU works.' },
  },
} satisfies Meta<typeof RainWindow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop as a control. */
export const Playground: Story = {
  render: (args: RainWindowProps) => (
    <Section className="h-screen min-h-[520px]">
      <RainWindow {...args} className="flex-1">
        <BackgroundCaption title="RainWindow" line="Rain on a city window at night." />
      </RainWindow>
    </Section>
  ),
};

/** The same background on the Skia fallback, as browsers without WebGPU see it. */
export const SkiaFallback: Story = { ...Playground, args: { forceFallback: true } };

/** One tile per district. */
export const Districts: Story = {
  render: (args: RainWindowProps) => (
    <DistrictGrid>
      {DISTRICTS.map((district) => (
        <RainWindow key={district} {...args} district={district} className="flex-1">
          <BackgroundCaption title={DISTRICT_NAMES[district]} />
        </RainWindow>
      ))}
    </DistrictGrid>
  ),
};
