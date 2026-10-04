'use client';
import { useState } from 'react';
import { tv } from 'tailwind-variants';
import { TONE_CLASSES } from './district';
import { Pressable, Text, View } from './tw';
import { TYPE_SCALE_TV } from './type-scale';

/** The controlled stage displayed by {@linkcode YearGrid}. */
export type YearGridStep = 'decade' | 'year';

/** Props for the controlled {@linkcode YearGrid} picker. */
export interface YearGridProps {
  /** Selected year. `null` deliberately leaves the picker without a default. */
  value: number | null;
  /** Called with a year tile only: choosing a decade never produces a year. */
  onChange: (year: number) => void;
  /** The decade step's spoken group label (e.g. `m04.grid.decades.a11y.label`). */
  groupLabel: string;
  /** The year step's spoken group label, given the decade shown (e.g. `m04.grid.years.a11y.label`). Falls back to {@linkcode YearGridProps.groupLabel}. */
  yearGroupLabel?: (decade: number) => string;
  /** Earliest year offered by {@linkcode YearGrid}. */
  minYear: number;
  /** Latest year offered by {@linkcode YearGrid}. */
  maxYear: number;
  /** Controlled picker stage. */
  step: YearGridStep;
  /** Requests a controlled stage change after a decade is chosen. */
  onStepChange?: (step: YearGridStep) => void;
  className?: string;
}

const tile = tv({
  slots: {
    root:
      'min-h-12 flex-1 items-center justify-center border-2 border-border bg-surface-raised px-2 py-3 ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
    label: 'font-display text-type-label text-text',
  },
  variants: {
    selected: {
      true: {
        root: `${TONE_CLASSES.royal.face} ${TONE_CLASSES.royal.border}`,
        label: TONE_CLASSES.royal.onFace,
      },
      false: {},
    },
  },
  defaultVariants: { selected: false },
}, TYPE_SCALE_TV);

function range(first: number, last: number, increment = 1) {
  if (last < first) return [];
  return Array.from({ length: Math.floor((last - first) / increment) + 1 }, (_, index) => first + index * increment);
}

/** A controlled two-stage decade and year picker with no implicit selection. */
export function YearGrid({ value, onChange, minYear, maxYear, step, onStepChange, groupLabel, yearGroupLabel, className }: YearGridProps) {
  // A chosen decade is not a chosen year: it is remembered internally so no
  // `value` exists (and no screen-level Continue unlocks) until a year tile
  // is pressed.
  const [pickedDecade, setPickedDecade] = useState<number | null>(null);
  const firstDecade = Math.floor(minYear / 10) * 10;
  const lastDecade = Math.floor(maxYear / 10) * 10;
  const selectedDecade = value === null ? null : Math.floor(value / 10) * 10;
  const decade = selectedDecade ?? pickedDecade ?? firstDecade;
  const values = step === 'decade'
    ? range(firstDecade, lastDecade, 10)
    : range(Math.max(minYear, decade), Math.min(maxYear, decade + 9));

  return (
    <View
      role={step === 'year' ? 'radiogroup' : 'group'}
      aria-label={step === 'year' ? (yearGroupLabel?.(decade) ?? groupLabel) : groupLabel}
      className={`flex-row flex-wrap ${className ?? ''}`}
    >
      {values.map((item) => {
        const selected = step === 'year' ? value === item : selectedDecade === item || pickedDecade === item;
        const styles = tile({ selected });
        const label = step === 'decade' ? `${item}s` : String(item);
        return (
          <View key={item} className="w-1/3 p-1">
            <Pressable
              role={step === 'year' ? 'radio' : 'button'}
              aria-checked={step === 'year' ? selected : undefined}
              accessibilityState={step === 'year' ? { selected, checked: selected } : { selected }}
              accessibilityLabel={label}
              onPress={() => {
                if (step === 'decade') {
                  setPickedDecade(item);
                  onStepChange?.('year');
                } else {
                  onChange(item);
                }
              }}
              className={styles.root()}
            >
              <Text className={styles.label()}>{label}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
