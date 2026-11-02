import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { Heading } from './Heading';
import { HLynkShell } from './hlynk/HLynkShell';
import { HLynkStage } from './hlynk/HLynkStage';
import { Text } from './Text';
import { View } from './tw';

/**
 * The companion loop's shell host. From `md` the stage shows one companion
 * pane beside the shell (landscape: pane left, shell right, the open-foldable
 * layout) or under it (portrait); below `md` the pane is hidden and screens
 * draw the same content inside the H-Lynk screen. Breakpoint and orientation
 * classes drive it, so these fixed-size frames show the layout of whichever
 * window Storybook runs in.
 */
const meta = {
  title: 'H-Lynk/HLynkStage',
  component: HLynkStage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HLynkStage>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => undefined;

const Shell = () => (
  <HLynkShell
    reducedMotion={false}
    screen={<View className="flex-1 items-center justify-end pb-12"><View className="bg-concrete-300" style={{ width: 120, height: 150 }} /></View>}
    trackpad={{ label: 'Room', onActivate: noop }}
    keys={{ menu: { onPress: noop }, back: { onPress: noop } }}
    insets={{ topPt: 0, bottomPt: 0 }}
  />
);

const Panel = ({ title }: { title: string }) => (
  <View className="gap-3 border-2 border-border bg-surface-raised p-4">
    <Heading level={2}>{title}</Heading>
    <Text variant="body" tone="muted">Panel content at content-form width.</Text>
    <Button title="Action" variant="cta" fullWidth onPress={noop} />
  </View>
);

/** Quest default: 1280 × 800. Leading and trailing stacked in the companion pane, shell on the right. */
export const QuestWindow: Story = {
  args: { children: null },
  render: () => (
    <View style={{ width: 1280, height: 800 }}>
      <HLynkStage leading={<Panel title="Name card" />} trailing={<Panel title="Share a meal" />} testID="stage">
        <Shell />
      </HLynkStage>
    </View>
  ),
};

/** Trailing content only: it alone fills the companion pane. */
export const TrailingOnly: Story = {
  args: { children: null },
  render: () => (
    <View style={{ width: 1280, height: 800 }}>
      <HLynkStage trailing={<Panel title="Rest" />}>
        <Shell />
      </HLynkStage>
    </View>
  ),
};
