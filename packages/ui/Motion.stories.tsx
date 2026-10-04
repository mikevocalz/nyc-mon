import type { Meta, StoryObj } from '@storybook/react-vite';
import { FadeIn, ScaleIn, SlideUp } from './motion';
import { Text } from './Text';
import { View } from './tw';

/**
 * The entrance presets with their authored reduced-motion siblings. Full: rise,
 * pop and slide. Reduced: a fade timed by `motion-enter` or `motion-step`
 * (motionTokens in @acme/theme), with no travel and no scale.
 */
const meta = {
  title: 'UI/Motion presets',
  component: FadeIn,
  args: { reducedMotion: false },
  argTypes: { reducedMotion: { control: 'boolean' } },
} satisfies Meta<typeof FadeIn>;
export default meta;
type Story = StoryObj<typeof meta>;

function Block({ label }: { label: string }) {
  return (
    <View className="border-2 border-border bg-surface-raised p-4">
      <Text>{label}</Text>
    </View>
  );
}

const Presets = ({ reducedMotion }: { reducedMotion?: boolean }) => (
  <View className="gap-4 bg-bg p-4">
    <FadeIn reducedMotion={reducedMotion}>
      <Block label="FadeIn" />
    </FadeIn>
    <ScaleIn reducedMotion={reducedMotion} delay={80}>
      <Block label="ScaleIn" />
    </ScaleIn>
    <SlideUp reducedMotion={reducedMotion} delay={160}>
      <Block label="SlideUp" />
    </SlideUp>
  </View>
);

/** Full motion: rise, pop, slide. */
export const Full: Story = { render: (args) => <Presets reducedMotion={args.reducedMotion} /> };

/** The authored reduced siblings: fades only. */
export const ReducedMotion: Story = { args: { reducedMotion: true }, render: (args) => <Presets reducedMotion={args.reducedMotion} /> };
