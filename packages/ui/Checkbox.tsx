'use client';
import { tv } from 'tailwind-variants';
import { Host, Checkbox as ExpoCheckbox } from '@expo/ui';
import { haptics } from './haptics';
import { NeonCheckbox } from './cards/NeonCheckbox';
import type { ControlTone, District } from './cards/tones';
// Native control tint comes from theme tokens — the platform toolkit
// (SwiftUI / Compose via @expo/ui Host) cannot consume Tailwind classes.
import { semantic } from '@acme/theme';
import { View } from './tw';
import { Text } from './Text';

const checkboxRow = tv({
  slots: { root: 'flex-row items-center gap-2.5 self-start' },
  variants: { disabled: { true: { root: 'opacity-50' } } },
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

// Native fork — the platform's real control via @expo/ui (Material Checkbox on
// Android; SwiftUI Toggle on iOS, where a switch IS the checkbox idiom).
// The web fork renders a styled <button role="checkbox">.
export function Checkbox({ checked, onChange, label, disabled, className, variant, tone, district }: CheckboxProps) {
  if (variant === 'neon') {
    return <NeonCheckbox {...{ checked, onChange, label, disabled, className, tone, district }} />;
  }
  const s = checkboxRow({ disabled });
  return (
    <View className={s.root({ className })}>
      <Host matchContents seedColor={semantic.primary.light}>
        <ExpoCheckbox
          value={checked}
          onValueChange={(v: boolean) => { if (disabled) return; haptics.selection(); onChange(v); }}
          disabled={disabled}
        />
      </Host>
      <Text className="text-base" aria-label={label}>{label}</Text>
    </View>
  );
}
