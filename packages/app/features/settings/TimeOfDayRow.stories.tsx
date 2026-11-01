// The Graphics card's time-of-day row, as Settings shows it under
// EXPO_PUBLIC_WORLD_PHYSICAL. Typed without @storybook/* because
// packages/app does not depend on it; CSF needs only these plain objects.
import { Card, Text, useInstanceStore, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';
import type { PhysicalPresetId } from '../game/world/physical-look.ts';
import { TimeOfDayRow } from './TimeOfDayRow';

export default { title: 'Settings/TimeOfDayRow' };

function Live({ initial }: { initial: PhysicalPresetId }) {
  const store = useInstanceStore<{ preset: PhysicalPresetId }>(() => ({ preset: initial }));
  const preset = useStore(store, (s) => s.preset);
  return (
    <Card className="gap-4">
      <Text variant="heading">Graphics</Text>
      <TimeOfDayRow value={preset} onChange={(next) => store.setState({ preset: next })} />
    </Card>
  );
}

/** The default: Dusk selected. Click or use the arrow keys to switch. */
export const Default = {
  render: () => (
    <View className="max-w-content-form p-4">
      <Live initial="twilight" />
    </View>
  ),
};

/** Phone width: the four presets wrap to a 2x2 grid; every segment stays 44px tall. */
export const PhoneWidth = {
  render: () => (
    <View className="w-[360px] p-4">
      <Live initial="midnight" />
    </View>
  ),
};
