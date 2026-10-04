import type { Meta, StoryObj } from '@storybook/react-vite';
import { HLynkKey } from './hlynk/HLynkKey';
import { Text } from './Text';
import { View } from './tw';

/** The four black keys on the red Core body: home, menu, back, forward. 48 pt square. */
const meta = {
  title: 'H-Lynk/HLynkKey',
  component: HLynkKey,
  args: { role: 'home', reducedMotion: false, onPress: () => undefined },
} satisfies Meta<typeof HLynkKey>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => undefined;

const Body = ({ children }: { children: React.ReactNode }) => (
  <View className="flex-row items-center gap-3 self-start bg-hlynk-core-body p-3">{children}</View>
);

/** Every role, enabled. Press one to see the depress and the white glyph. */
export const AllRoles: Story = {
  render: (args) => (
    <View className="scheme-light gap-3 bg-bg p-4">
      <Body>
        <HLynkKey role="home" onPress={noop} reducedMotion={args.reducedMotion} />
        <HLynkKey role="menu" onPress={noop} reducedMotion={args.reducedMotion} />
        <HLynkKey role="back" onPress={noop} reducedMotion={args.reducedMotion} />
        <HLynkKey role="forward" onPress={noop} reducedMotion={args.reducedMotion} />
      </Body>
    </View>
  ),
};

/** Reduced press feedback: the glyph turns white, no depress. */
export const PressedReduced: Story = { args: { reducedMotion: true }, render: AllRoles.render };

/** No handler: disabled, still focusable and named, reads "Available after start-up". */
export const Disabled: Story = {
  render: () => (
    <View className="scheme-light gap-3 bg-bg p-4">
      <Body>
        <HLynkKey role="home" reducedMotion={false} />
        <HLynkKey role="menu" reducedMotion={false} />
        <HLynkKey role="back" reducedMotion={false} />
        <HLynkKey role="forward" reducedMotion={false} />
      </Body>
    </View>
  ),
};

/** The body does not change at night; only the page behind it does. */
export const OnNightPage: Story = {
  render: () => (
    <View className="scheme-dark gap-3 bg-bg p-4">
      <Text variant="caption">Night page, same red body</Text>
      <Body>
        <HLynkKey role="home" onPress={noop} reducedMotion={false} />
        <HLynkKey role="menu" onPress={noop} reducedMotion={false} />
        <HLynkKey role="back" reducedMotion={false} />
        <HLynkKey role="forward" reducedMotion={false} />
      </Body>
    </View>
  ),
};
