import type { Meta, StoryObj } from '@storybook/react-vite';
import { NativeDropdown } from './NativeDropdown';
import { useInstanceStore, useStore } from './use-instance-store';
import { Text, View } from './tw';

const OPTIONS = [
  { id: 'standard', label: 'Standard', options: [
    { value: 'normal', label: 'Normal', supportingText: 'Preserve the layer' },
    { value: 'multiply', label: 'Multiply', supportingText: 'Darken with source channels' },
    { value: 'screen', label: 'Screen', supportingText: 'Lighten through compositing' },
  ] },
  { id: 'creative', label: 'Creative', options: [
    { value: 'overlay', label: 'Overlay', supportingText: 'Blend contrast' },
    { value: 'soft-light', label: 'Soft Light', supportingText: 'Subtle contrast' },
    { value: 'not-supported', label: 'Experimental', disabled: true },
  ] },
] as const;

const meta = {
  title: 'UI/NativeDropdown',
  component: NativeDropdown,
  args: {
    label: 'Layer blend mode',
    value: 'normal',
    groups: OPTIONS,
    onValueChange: () => {},
  },
} satisfies Meta<typeof NativeDropdown>;
export default meta;
type Story = StoryObj<typeof meta>;

function LayerChoice() {
  const store = useInstanceStore(() => ({ blend: 'normal' }));
  const blend = useStore(store, state => state.blend);
  return (
    <View className="min-h-80 gap-4 bg-surface p-6">
      <NativeDropdown label="Blend mode" groups={OPTIONS} value={blend}
        onValueChange={next => store.setState({ blend: next })} />
      <Text className="text-sm text-text-muted">
        Fixture only: a real creative editor sends the chosen value to its document engine.
      </Text>
      <Text className="text-xs text-text">{'Selected mode: ' + blend}</Text>
    </View>
  );
}

export const ProfessionalLayers: Story = { render: () => <LayerChoice /> };
export const Phone: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => <LayerChoice />,
};
