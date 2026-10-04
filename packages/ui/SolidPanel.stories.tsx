import type { Meta, StoryObj } from '@storybook/react-vite';
import { Heading, Paragraph } from './html';
import { SolidPanel } from './neon/SolidPanel';
import { View } from './tw';

const meta = {
  title: 'Foundation/Solid panel',
  component: SolidPanel,
  parameters: { layout: 'fullscreen' },
  args: { surface: 'page', depth: 'lg' },
  argTypes: {
    surface: { control: 'inline-radio', options: ['tone', 'page'] },
    tone: { control: 'select', options: ['orange', 'royal', 'carolina', 'leaf', 'apple', 'ink'] },
    depth: { control: 'inline-radio', options: ['none', 'sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof SolidPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * surface="page": a daylit plate in the light scheme and a night one in the
 * dark scheme, over a night backdrop standing in for a canvas scene. Themed
 * text inside reads the page palette. The home hero (W01) puts its copy on it.
 */
export const PageSurface: Story = {
  render: (args) => (
    <View className="min-h-[420px] justify-center bg-ink-950 p-6 md:p-10">
      <SolidPanel {...args} className="max-w-xl gap-3 px-6 py-6">
        <Heading level={2} className="my-0 font-display text-2xl text-text">Every block has a legend.</Heading>
        <Paragraph className="my-0 text-base text-text-muted">
          Mons live in New York, on the same blocks as you.
        </Paragraph>
      </SolidPanel>
    </View>
  ),
  play: ({ canvasElement }) => {
    const face = canvasElement.querySelector('h2')?.parentElement;
    const cls = face?.className ?? '';
    // The page face draws the raised surface, never a tone fill.
    if (!cls.includes('bg-surface-raised')) throw new Error(`page face classes: ${cls}`);
    if (/bg-(orange|royal|carolina|leaf|apple|ink)-\d/.test(cls)) throw new Error(`page face kept a tone fill: ${cls}`);
  },
};

/** The default tone face, for comparison. */
export const ToneSurface: Story = { ...PageSurface, args: { surface: 'tone', tone: 'ink' }, play: undefined };
