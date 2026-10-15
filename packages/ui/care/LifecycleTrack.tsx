'use client';
import { Fragment } from 'react';
import { Check } from '../icons';
import { hiddenA11y } from '../hlynk/a11y';
import { Text, View } from '../tw';
import { lifecycleSlotSpoken, type LifecycleSlot, type LifecycleStateWords } from './lifecycle-model';

export interface LifecycleTrackProps {
  /** Ordered slots. Only reached stages carry a label; later stages are unnamed. Build with `lifecycleSlots`. */
  slots: readonly LifecycleSlot[];
  /** Group label, e.g. "Life stages". */
  accessibilityLabel: string;
  /** Spoken state words from copy ("done", "now", "Later stage"). Without them each slot speaks its label only. */
  stateWords?: LifecycleStateWords;
  testID?: string;
}

const MARK = 20;

/**
 * The Mon's life stages on M17 (D-15i): Egg ✓, Baby ●, then three ○ with
 * no text and no stage word. A list to assistive tech; each reached stage
 * speaks its form name and state, each later slot only "later". Static:
 * nothing here moves, so there is no reduced-motion branch to take.
 */
export function LifecycleTrack({ slots, accessibilityLabel, stateWords, testID }: LifecycleTrackProps) {
  return (
    <View
      testID={testID}
      role="list"
      accessibilityRole="list"
      aria-label={accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      className="flex-row items-start"
    >
      {slots.map((slot, i) => {
        const spoken = lifecycleSlotSpoken(slot, stateWords);
        return (
          <Fragment key={i}>
            {i > 0 ? <View {...(hiddenA11y(true) as object)} className="mt-[9px] h-0.5 flex-1 bg-border-strong" /> : null}
            <View
              role="listitem"
              accessible
              accessibilityLabel={spoken || undefined}
              aria-label={spoken || undefined}
              accessibilityState={slot.state === 'current' ? { selected: true } : undefined}
              aria-current={slot.state === 'current' ? 'step' : undefined}
              className="min-w-11 items-center gap-1"
            >
              <View {...(hiddenA11y(true) as object)} style={{ width: MARK, height: MARK }} className="items-center justify-center">
                {slot.state === 'done' ? (
                  <View className="h-full w-full items-center justify-center bg-text">
                    <Check size={14} className="text-text-inverse" />
                  </View>
                ) : slot.state === 'current' ? (
                  <View className="h-full w-full rounded-full bg-text" />
                ) : (
                  <View className="h-full w-full rounded-full border-2 border-text-muted" />
                )}
              </View>
              {slot.state === 'later' ? null : (
                <Text {...(hiddenA11y(true) as object)} className="text-center text-type-caption text-text" numberOfLines={2}>{slot.label}</Text>
              )}
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}
