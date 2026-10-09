'use client';
import type { ReactNode } from 'react';
import { Text, View } from '../tw';
import { careRingName, percentOf } from './ring-model';
import { CARE_RING_SIZE, type CareMeterRingProps } from './CareMeterRing.types';

/**
 * The accessible shell of a care ring: one progressbar element, named by the
 * caption plus the low word, valued 0–100. The drawing inside is decorative.
 */
export function CareRingFrame({ props, canvas }: { props: CareMeterRingProps; canvas: ReactNode }) {
  const { value, label, low, lowLabel, size = 'md', testID } = props;
  const name = careRingName(label, low, lowLabel);
  const d = CARE_RING_SIZE[size].d;
  const now = percentOf(value);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      role="progressbar"
      accessibilityLabel={name}
      aria-label={name}
      accessibilityValue={{ min: 0, max: 100, now }}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={now}
      className="items-center gap-1"
    >
      <View style={{ width: d, height: d }}>{canvas}</View>
      <Text className="text-type-caption text-text" numberOfLines={1}>{label}</Text>
      {low && lowLabel ? <Text className="text-type-caption text-text-secondary" numberOfLines={1}>{lowLabel}</Text> : null}
    </View>
  );
}

/** Notch at 12 o'clock for the low state: a short square bar across the ring. */
export function notchRect(d: number, stroke: number) {
  return { x: d / 2 - 1.5, y: 0, width: 3, height: stroke + 4 };
}
