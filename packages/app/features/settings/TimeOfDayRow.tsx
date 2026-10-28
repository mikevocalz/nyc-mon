// The time-of-day row of the Graphics card: a label, the four presets as a
// SegmentedControl, and one caption. Controlled; settings-content.tsx binds
// it to timeOfDayStore. Segments are at least 44pt tall (the kit's min-h-11),
// above WCAG 2.5.8's 24px minimum. Four options wrap to a 2x2 grid on
// phones, the same segmentClassName the Game controls screen uses.
import { SegmentedControl, Text } from '@acme/ui';
import { View } from '@acme/ui/tw';
import type { PhysicalPresetId } from '../game/world/physical-look.ts';
import { TIME_OF_DAY_COPY, TIME_OF_DAY_OPTIONS } from './time-of-day-options.ts';

export interface TimeOfDayRowProps {
  value: PhysicalPresetId;
  onChange: (value: PhysicalPresetId) => void;
}

export function TimeOfDayRow({ value, onChange }: TimeOfDayRowProps) {
  return (
    <View className="gap-1">
      <Text variant="label">{TIME_OF_DAY_COPY.label}</Text>
      <SegmentedControl
        aria-label={TIME_OF_DAY_COPY.label}
        options={TIME_OF_DAY_OPTIONS}
        value={value}
        onChange={onChange}
        segmentClassName="basis-[40%] sm:basis-auto"
      />
      <Text variant="caption" tone="muted">{TIME_OF_DAY_COPY.hint}</Text>
    </View>
  );
}
