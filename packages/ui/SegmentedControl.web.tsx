'use client';
import { tv } from 'tailwind-variants';
import { haptics } from './haptics';
import { Pressable, Text, View } from './tw';
import { resolveControlTone, toneVariants, type ControlTone, type ToneClasses } from './district';
import type { SegmentedControlProps } from './SegmentedControl.types';

// The NYC-MON segmented control: a night well behind a heavy ink keyline;
// the active segment is a solid tone face with its own keyline, labels in
// the display face. Inactive segments tint on hover. Shared by both forks.
const segmented = tv({
  slots: {
    root: 'flex-row gap-1 self-start border-2 border-ink-800 bg-ink-950 p-1',
    segment:
      'min-h-9 items-center justify-center border-2 px-3 py-1.5 transition-colors duration-fast md:px-4 md:py-2 ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 motion-reduce:transition-none',
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
}: SegmentedControlProps<T>) {
  const resolved = resolveControlTone(tone, district);
  return (
    <View role="tablist" className={segmented({ tone: resolved }).root({ className: `${rounded ? 'rounded-soft' : ''} overflow-hidden ${className ?? ''}` })}>
      {options.map((option) => {
        const active = option.value === value;
        const s = segmented({ tone: resolved, active });
        return (
          <Pressable
            key={option.value}
            role="tab"
            aria-selected={active}
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              haptics.selection();
              onChange(option.value);
            }}
            className={s.segment()}
          >
            <Text className={s.label()}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
