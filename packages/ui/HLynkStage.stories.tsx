import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { Heading } from './Heading';
import { HLynkShell } from './hlynk/HLynkShell';
import { HLynkStage } from './hlynk/HLynkStage';
import { Text } from './Text';
import { View } from './tw';

/**
 * The shell with side panes (M13–M16 on the Quest 2D window, 1280 × 800 dp
 * by default, resizable 360–1280). From 840 dp wide the stage opens a leading
 * and a trailing pane at `content-form` width; the shell keeps the centre and
 * its 440 pt cap. Narrower, the panes are gone and the screen draws the same
 * panel inside the shell. Resize the canvas to see the switch.
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

/** Quest default: 1280 × 800. Both panes, shell centred. */
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

/** Trailing pane only: the leading pane stays as an empty column so the shell does not shift. */
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
