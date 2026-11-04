import type { Meta, StoryObj } from '@storybook/react-vite';
import { Popover } from './Popover';
import { Button } from './Button';
import { Text, View } from './tw';
import { ReservedRegionsOverride } from './reserved-regions-override';
import { useInstanceStore, useStore } from './use-instance-store';

const meta = {
  title: 'UI/Popover',
  component: Popover,
  args: {
    open: false,
    onOpenChange: () => {},
    trigger: <Text>Brush settings</Text>,
    children: <Text>Interactive fixture</Text>,
    accessibleLabel: 'Brush settings',
  },
} satisfies Meta<typeof Popover>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Interactive fixture. It proves presentation controls, not Rust opacity edits. */
function BrushInspector({ folded = false }: { folded?: boolean }) {
  const store = useInstanceStore(() => ({ open: false, opacity: 62 }));
  const open = useStore(store, s => s.open);
  const opacity = useStore(store, s => s.opacity);
  const control = (
    <Popover
      open={open}
      onOpenChange={value => store.setState({ open: value })}
      accessibleLabel="Brush settings"
      title="Brush settings"
      trigger={<Text className="text-sm font-semibold text-text">Brush settings</Text>}
    >
      <View className="gap-3">
        <Text className="text-xs text-text-muted">STORY FIXTURE · OPACITY</Text>
        <Text className="text-lg font-semibold tabular-nums text-text">{opacity}%</Text>
        <View className="flex-row gap-2">
          <Button title="Decrease" variant="outline" onPress={() => store.setState(s => ({
            opacity: Math.max(0, s.opacity - 5),
          }))} />
          <Button title="Increase" variant="outline" onPress={() => store.setState(s => ({
            opacity: Math.min(100, s.opacity + 5),
          }))} />
        </View>
        <Text className="text-xs text-text-muted">
          This is a presentation fixture; Forge&apos;s Rust engine owns real edits.
        </Text>
      </View>
    </Popover>
  );
  return (
    <View className="min-h-96 items-start bg-surface p-5">
      {folded ? (
        <ReservedRegionsOverride regions={[{
          kind: 'division', x: 450, y: 0, width: 8, height: 780,
          active: true, separating: true, orientation: 'vertical', state: 'flat',
          margins: { top: 0, right: 0, bottom: 0, left: 0 },
        }]}>
          {control}
        </ReservedRegionsOverride>
      ) : control}
    </View>
  );
}

export const Desktop: Story = { render: () => <BrushInspector /> };
export const Compact: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => <BrushInspector />,
};
export const BookFold: Story = { render: () => <BrushInspector folded /> };
