import type { Meta, StoryObj } from '@storybook/react-vite';
import { CityBlocks, type CityBlocksProps, type District } from './backgrounds/CityBlocks';
import { DISTRICTS } from './district';
import { Heading, Paragraph, Section } from './html';
import { SolidPanel } from './neon/SolidPanel';
import { View } from './tw';

const meta = {
  title: 'NYC Mon/City blocks',
  component: CityBlocks,
  parameters: { layout: 'fullscreen', backgrounds: { disable: true } },
  args: {
    district: 'midtown',
    seed: 1,
    streetWidth: 10,
    windowLights: true,
    traffic: true,
    trafficDensity: 1,
    trafficSpeed: 1,
    hoverEffect: true,
    overlay: false,
    forceFallback: false,
  },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    blockSize: { control: { type: 'range', min: 32, max: 96, step: 2 } },
    streetWidth: { control: { type: 'range', min: 4, max: 24, step: 1 } },
    seed: { control: { type: 'number', min: 1, step: 1 } },
    trafficDensity: { control: { type: 'range', min: 0, max: 3, step: 0.1 } },
    trafficSpeed: { control: { type: 'range', min: 0, max: 3, step: 0.1 } },
    lightColor: { control: 'color' },
    accentColor: { control: 'color' },
    streetColor: { control: 'color' },
    hoverColor: { control: 'color' },
    forceFallback: { description: 'Draw with Skia even where WebGPU works.' },
  },
} satisfies Meta<typeof CityBlocks>;

export default meta;
type Story = StoryObj<typeof meta>;

const DISTRICT_COPY: Record<District, { name: string; line: string }> = {
  downtown: { name: 'Downtown', line: 'FiDi supertalls, setbacks and spires.' },
  midtown: { name: 'Midtown', line: 'Deco crowns and water towers on every other roof.' },
  harlem: { name: 'Harlem', line: 'Brownstone rows, stoops and the towers behind them.' },
  megacity: { name: 'Mega City', line: 'The future grid: megastructures joined by sky bridges.' },
};

function Caption({ district }: { district: District }) {
  const copy = DISTRICT_COPY[district];
  return (
    <View className="absolute bottom-4 left-4 max-w-xs">
      <SolidPanel tone="ink" depth="sm" className="gap-1 px-4 py-3">
        <Heading level={2} className="my-0 font-display text-lg text-ink-50">{copy.name}</Heading>
        <Paragraph className="my-0 text-sm text-silver-300">{copy.line}</Paragraph>
      </SolidPanel>
    </View>
  );
}

/** Every prop as a control. Move the pointer over a block to see the hover plate. */
export const Playground: Story = {
  render: (args: CityBlocksProps) => (
    <Section className="h-screen min-h-[560px]">
      <CityBlocks {...args} className="flex-1">
        <Caption district={args.district ?? 'midtown'} />
      </CityBlocks>
    </Section>
  ),
};

/** The same component on the Skia fallback, as browsers without WebGPU see it. */
export const SkiaFallback: Story = {
  ...Playground,
  args: { forceFallback: true },
};

/** The four districts side by side; one column on phones, two on wider screens. */
export const Districts: Story = {
  render: (args: CityBlocksProps) => (
    <View className="min-h-screen gap-4 bg-ink-950 p-4 md:flex-row md:flex-wrap">
      {DISTRICTS.map((district) => (
        <Section key={district} className="h-[320px] overflow-hidden border-2 border-ink-800 md:h-[380px] md:w-[calc(50%-0.5rem)]">
          <CityBlocks {...args} district={district} className="flex-1">
            <Caption district={district} />
          </CityBlocks>
        </Section>
      ))}
    </View>
  ),
};
