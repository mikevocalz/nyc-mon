'use client';
import type { ReactNode } from 'react';
import { View } from '../tw';

export interface CareMeterRingGroupProps {
  /** Three `CareMeterRing`s (energy, fullness, social). */
  children: ReactNode;
  /** Group name, e.g. `m13.rings.a11y.label`. */
  accessibilityLabel: string;
  testID?: string;
}

/**
 * Lays the care rings in one row on the `scrim-scene` plate (M13). The
 * native group is a `summary` so a screen reader lands on the group name
 * before the three meters; on web it is a labelled `group`.
 */
export function CareMeterRingGroup({ children, accessibilityLabel, testID }: CareMeterRingGroupProps) {
  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      role="group"
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
      className="flex-row items-start justify-center gap-4 bg-scrim-scene px-3 py-2"
    >
      {children}
    </View>
  );
}
