'use client';
import type { KeyboardEvent } from 'react';
import { Platform } from 'react-native';
import { tv } from 'tailwind-variants';
import { haptics } from './haptics';
import { Pressable, Text, View } from './tw';
import { resolveControlTone, toneVariants, type ControlTone, type ToneClasses } from './district';
import { nextRadioIndex, rovingTabIndex } from './radio-group';
import type { SegmentedControlProps } from './SegmentedControl.types';

const isWeb = Platform.OS === 'web';

// The NYC-MON segmented control: a night well behind a heavy ink keyline;
// the active segment is a solid tone face with its own keyline, labels in
// the display face. Inactive segments tint on hover. Shared by both forks.
//
// Semantics: a single-select radio group (WAI-ARIA APG). On web only the
// checked segment is a Tab stop; arrows move and select (wrapping), Home/End
// jump. The well wraps onto extra rows instead of overflowing a narrow
// parent, and segments grow so a wrapped row still fills the well. Every
// segment is at least 44px tall (WCAG 2.5.5).
const segmented = tv({
  slots: {
    root: 'max-w-full flex-row flex-wrap gap-1 self-start border-2 border-ink-800 bg-ink-950 p-1',
    segment:
      'min-h-11 grow items-center justify-center border-2 px-3 py-1.5 transition-colors duration-fast md:px-4 md:py-2 ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none',
    label: 'font-display text-sm tracking-wide md:text-base',
  },
  variants: {
    tone: toneVariants(() => ({})),
    active: {
      true: {},
      false: { segment: 'border-transparent hover:bg-ink-800', label: 'text-silver-300' },
    },
  },
  compoundVariants: (Object.entries(toneVariants((c) => c)) as [ControlTone, ToneClasses][]).map(([tone, c]) => ({
    tone, active: true, class: { segment: `${c.face} ${c.controlKeyline}`, label: c.onFace },
  })),
});

export function SegmentedControl<T extends string>({
  options, value, onChange, className, tone, district, rounded = false,
  'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy,
}: SegmentedControlProps<T>) {
  const resolved = resolveControlTone(tone, district);
  const checkedIndex = options.findIndex((option) => option.value === value);

  const select = (next: T) => {
    if (next === value) return;
    haptics.selection();
    onChange(next);
  };

  // Arrow/Home/End: move DOM focus to the target radio and select it. The
  // radios are found from the group element so no per-item refs are needed.
  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLElement>) => {
    const next = nextRadioIndex(index, event.key, options.length);
    if (next === null) return;
    event.preventDefault();
    const radios = event.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]');
    radios?.[next]?.focus();
    const target = options[next];
    if (target) select(target.value);
  };

  return (
    <View
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={segmented({ tone: resolved }).root({ className: `${rounded ? 'rounded-soft' : ''} overflow-hidden ${className ?? ''}` })}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        const s = segmented({ tone: resolved, active });
        return (
          <Pressable
            key={option.value}
            role="radio"
            aria-checked={active}
            accessibilityState={{ checked: active, selected: active }}
            onPress={() => select(option.value)}
            onKeyDown={onKeyDown(index)}
            // Roving tabindex is a web keyboard concept; native screen readers
            // and Android focus navigation keep every radio reachable.
            {...(isWeb ? ({ tabIndex: rovingTabIndex(index, checkedIndex) } as object) : {})}
            className={s.segment()}
          >
            <Text className={s.label()}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
