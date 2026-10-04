import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkylineDivider, type SkylineDividerProps } from './backgrounds/SkylineDivider';
import { DISTRICTS } from './district';
import { Heading, Main, Paragraph, Section } from './html';
import { View } from './tw';

const meta = {
  title: 'Backgrounds/SkylineDivider',
  component: SkylineDivider,
  parameters: { layout: 'fullscreen' },
  args: { district: 'midtown', size: 'md', seed: 1 },
  argTypes: {
    district: { control: 'inline-radio', options: DISTRICTS },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    seed: { control: { type: 'range', min: 1, max: 40, step: 1 } },
  },
} satisfies Meta<typeof SkylineDivider>;

export default meta;
type Story = StoryObj<typeof meta>;

function Block({ title, line }: { title: string; line: string }) {
  return (
    <Section className="mx-auto w-full max-w-3xl gap-2 px-4 py-12">
      <Heading level={2} className="my-0 font-display text-2xl text-text">{title}</Heading>
      <Paragraph className="my-0 text-text-muted">{line}</Paragraph>
    </Section>
  );
}

/** Every prop as a control, between two page sections. */
export const Playground: Story = {
  render: (args: SkylineDividerProps) => (
    <Main className="min-h-screen bg-surface">
      <Block title="Featured" line="The section above the divider." />
      <SkylineDivider {...args} />
      <Block title="Resources" line="The section below it. The divider is decorative and hidden from screen readers." />
    </Main>
  ),
};

/** One per district, at each size. */
export const Districts: Story = {
  render: () => (
    <View className="gap-6 bg-surface py-6">
      {DISTRICTS.map((district, i) => (
        <SkylineDivider key={district} district={district} size={(['sm', 'md', 'lg', 'md'] as const)[i]} seed={i + 1} />
      ))}
    </View>
  ),
};

/**
 * A long page: dividers far below the fold mount only as they scroll near and
 * pause once they scroll away. Scroll and watch the frame loop in DevTools.
 */
export const LongPage: Story = {
  render: () => (
    <Main className="bg-surface">
      {DISTRICTS.map((district, i) => (
        <View key={district}>
          <View className="h-[90vh]">
            <Block title={`Section ${i + 1}`} line="Filler height so the next divider starts below the fold." />
          </View>
          <SkylineDivider district={district} seed={i + 3} />
        </View>
      ))}
    </Main>
  ),
};
