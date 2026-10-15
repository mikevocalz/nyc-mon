'use client';
import '../rn-globals-shim';
import type { KeyboardEvent, ReactNode } from 'react';
import { Platform } from 'react-native';
import { haptics } from '../haptics';
import { hiddenA11y, testIdProps } from '../hlynk/a11y';
import { nextRadioIndex, rovingTabIndex } from '../radio-group';
import { Pressable, Text, View } from '../tw';

const isWeb = Platform.OS === 'web';

/** One row: a visible name, an optional second line and still, and its spoken name. */
export interface ChoiceRow {
  key: string;
  label: string;
  /** Second line, e.g. the Bloodline on M08. */
  detail?: string;
  /** e.g. `m08.tile.a11y.label` or `m10.option.15.a11y`, filled. */
  accessibilityLabel: string;
  /** A 64 pt still on the leading edge (M08). Decorative: the label carries the meaning. */
  media?: ReactNode;
}

/** Props for {@linkcode ChoiceRows}. */
export interface ChoiceRowsProps {
  rows: readonly ChoiceRow[];
  /** Checked row index, or null for none (no default, D-16b). Controlled. */
  value: number | null;
  onChange: (index: number) => void;
  /** Group name for assistive tech. */
  accessibilityLabel: string;
  testID?: string;
  rowTestID?: (row: ChoiceRow) => string;
}

/** Still size on a row (M08 07-a11y.md "Accessibility sizes"). */
const MEDIA_PT = 64;

/**
 * A short single choice as full-width radio rows: what M08's triptych and
 * M10's ring become at accessibility text sizes (07-a11y.md). Rows are at
 * least `min-h-target` (48 px, absolute; `min-h-12` is rem-based and
 * Uniwind's `rem: 14` polyfill in apps/mobile/metro.config.js makes it 42 dp) and grow with the text; nothing is checked until the
 * Caller picks. Web: arrows wrap, Home/End jump, roving tab stop.
 */
export function ChoiceRows({ rows, value, onChange, accessibilityLabel, testID, rowTestID }: ChoiceRowsProps) {
  const checked = value ?? -1;
  const pick = (i: number) => {
    if (i === value) return;
    haptics.selection();
    onChange(i);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const next = nextRadioIndex(checked, event.key, rows.length);
    if (next === null) return;
    event.preventDefault();
    event.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
    pick(next);
  };
  return (
    <View
      testID={testID}
      role="radiogroup"
      accessibilityRole="radiogroup"
      aria-label={accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      className="gap-2"
    >
      {rows.map((row, i) => {
        const on = i === checked;
        return (
          <Pressable
            key={row.key}
            role="radio"
            aria-checked={on}
            accessibilityState={{ checked: on, selected: on }}
            accessibilityLabel={row.accessibilityLabel}
            aria-label={row.accessibilityLabel}
            {...(testIdProps(rowTestID?.(row)) as object)}
            onPress={() => pick(i)}
            onKeyDown={isWeb ? onKeyDown : undefined}
            {...(isWeb ? ({ tabIndex: rovingTabIndex(i, checked) } as object) : {})}
            className={`min-h-target flex-row items-center gap-3 border-2 px-3 py-2 ${on ? 'border-text bg-surface-raised' : 'border-border'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg`}
          >
            {/* The radio mark: filled square when checked, so the state is not colour alone. */}
            <View {...(hiddenA11y(true) as object)} className="size-5 items-center justify-center border-2 border-text">
              {on ? <View className="size-2.5 bg-text" /> : null}
            </View>
            {row.media ? (
              <View {...(hiddenA11y(true) as object)} className="overflow-hidden border-2 border-border" style={{ width: MEDIA_PT, height: MEDIA_PT }}>
                {row.media}
              </View>
            ) : null}
            <View className="flex-1 gap-0.5">
              <Text className="text-type-body-strong text-text">{row.label}</Text>
              {row.detail ? <Text className="text-type-label text-text-muted">{row.detail}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
