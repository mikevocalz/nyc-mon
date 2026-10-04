'use client';
import { tv } from 'tailwind-variants';
import { haptics } from './haptics';
import { NeonCheckbox } from './cards/NeonCheckbox';
import type { ControlTone, District } from './cards/tones';
import { View, Text, Pressable } from './tw';

const checkbox = tv({
  slots: {
    root:
      'flex-row items-center gap-2.5 self-start rounded-md transition-opacity duration-fast active:opacity-80 ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 ' +
      'motion-reduce:transition-none',
    box: 'h-5 w-5 items-center justify-center rounded-[6px] transition-all duration-fast motion-reduce:transition-none',
    check: 'text-xs font-bold text-on-primary',
    label: 'text-base text-text',
  },
  variants: {
    checked: {
      true: { box: 'bg-primary shadow-card' },
      false: { box: 'border-2 border-border-strong bg-surface-raised hover:border-primary' },
    },
    disabled: { true: { root: 'opacity-50' } },
  },
  defaultVariants: { checked: false, disabled: false },
});

export interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
  /** neon is the NeonBlade checkbox; default is the platform control (native) or kit box (web). */
  variant?: 'default' | 'neon';
  /** neon: colour family. Overrides `district`. */
  tone?: ControlTone;
  /** neon: theme by neighbourhood. */
  district?: District;
}

export function Checkbox({ checked, onChange, label, disabled, className, variant, tone, district }: CheckboxProps) {
  if (variant === 'neon') {
    return <NeonCheckbox {...{ checked, onChange, label, disabled, className, tone, district }} />;
  }
  const s = checkbox({ checked, disabled });
  return (
    <Pressable
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled}
      accessibilityState={{ checked, disabled: !!disabled }}
      onPress={disabled ? undefined : () => { haptics.selection(); onChange(!checked); }}
      className={s.root({ className })}
    >
      <View className={s.box()}>
        {checked ? <Text className={s.check()}>✓</Text> : null}
      </View>
      <Text className={s.label()}>{label}</Text>
    </Pressable>
  );
}
