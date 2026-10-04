'use client';
import { tv } from 'tailwind-variants';
import { haptics } from '../haptics';
import { Pressable, Text as TWText, View } from '../tw';
import { Text } from '../Text';
import { NEON_FIELD } from './neon-field';
import { resolveControlTone, toneVariants, type ControlTone, type District } from '../district';

const neonCheckbox = tv({
  slots: {
    root:
      'min-h-11 flex-row items-center gap-3 self-start ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2',
    wrap: 'relative h-8 w-8',
    plate: 'absolute left-1 top-1 h-7 w-7',
    box: 'h-7 w-7 items-center justify-center border-2 transition-colors duration-fast motion-reduce:transition-none',
    check: 'text-center font-display text-base leading-none',
    label: 'text-base font-semibold text-text',
  },
  variants: {
    tone: toneVariants(() => ({})),
    checked: {
      true: {},
      false: { box: 'border-silver-500 bg-ink-950', plate: 'hidden' },
    },
    disabled: { true: { root: 'opacity-50' } },
  },
  compoundVariants: (Object.entries(toneVariants((c) => c)) as [ControlTone, import('../district').ToneClasses][]).map(
    ([tone, c]) => ({ tone, checked: true, class: { box: `${c.face} ${c.controlKeyline}`, plate: c.plate, check: c.onFace } }),
  ),
});

export interface NeonCheckboxProps {
  /** Opt-in rounded corners (rounded-soft). Default false: square. */
  rounded?: boolean;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
  tone?: ControlTone;
  district?: District;
  /** Validation message under the box (the form binding passes it once touched). */
  error?: string;
}

/**
 * NeonBlade's neon checkbox as a solid badge tile: unchecked is a night
 * well, checked fills with the tone over a darker plate that steps out
 * behind it. Shared by the web and native Checkbox forks for
 * `variant="neon"`; the pressable is a real <button role="checkbox"> on web
 * and a Pressable with the checkbox role on native.
 */
export function NeonCheckbox({ checked, onChange, label, disabled, className, tone, district, error, rounded = false }: NeonCheckboxProps) {
  const s = neonCheckbox({ checked, disabled, tone: resolveControlTone(tone, district) });
  const box = (
    <Pressable
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      aria-invalid={!!error}
      aria-disabled={disabled}
      accessibilityState={{ checked, disabled: !!disabled }}
      onPress={disabled ? undefined : () => { haptics.selection(); onChange(!checked); }}
      className={s.root({ className })}
    >
      <View aria-hidden className={s.wrap()}>
        <View className={s.plate()} />
        <View className={s.box({ className: rounded ? 'rounded-[4px]' : '' })}>
          {checked ? <TWText className={s.check()}>✓</TWText> : null}
        </View>
      </View>
      <Text className={s.label()}>{label}</Text>
    </Pressable>
  );
  if (!error) return box;
  return (
    <View className="gap-1">
      {box}
      <Text role="alert" className={NEON_FIELD.message}>{error}</Text>
    </View>
  );
}
