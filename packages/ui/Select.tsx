'use client';
import { tv } from 'tailwind-variants';
import { View } from './tw';
import { Select as PrimitiveSelect, Label } from './primitives';
import { Text } from './Text';
import { NEON_FIELD, neonErrorVariant, neonFieldCompounds, neonLabelCompounds } from './cards/neon-field';
import { resolveControlTone, toneVariants, type ControlTone, type District } from './district';

const field = tv({
  slots: {
    root: NEON_FIELD.root,
    label: NEON_FIELD.label,
    select: `${NEON_FIELD.input}`,
    message: NEON_FIELD.message,
  },
  variants: {
    error: { true: neonErrorVariant('select'), false: {} },
    disabled: { true: { select: NEON_FIELD.disabled } },
    tone: toneVariants(() => ({})),
  },
  compoundVariants: [...neonFieldCompounds('select'), ...neonLabelCompounds()],
  defaultVariants: { error: false },
});

export interface SelectOption {
  value: string;
  label?: string;
  disabled?: boolean;
}

export interface SelectProps extends React.ComponentProps<typeof PrimitiveSelect> {
  label: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  containerClassName?: string;
  /** Options as data (NeonBlade's API). Rendered before any option children. */
  options?: SelectOption[];
  /** The NYC-MON field is the only look; `neon` and `default` are both accepted for older callers. */
  variant?: 'default' | 'neon';
  /** Colour family for the nameplate and well border. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default Midtown (orange). */
  district?: District;
}

export function Select({
  label, hint, error, disabled, className, containerClassName, variant: _variant, tone, district, options, children, ...selectProps
}: SelectProps) {
  const s = field({ error: !!error, disabled, tone: resolveControlTone(tone, district) });
  return (
    <View className={s.root({ className: containerClassName })}>
      <Label className={s.label()}>{label}</Label>
      <PrimitiveSelect
        aria-label={label}
        disabled={disabled}
        className={s.select({ className })}
        {...selectProps}
      >
        {options?.map((o) => (
          // <option> is what the web <select> needs; the native fork reads value and label from it.
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label ?? o.value}</option>
        ))}
        {children}
      </PrimitiveSelect>
      {error ? (
        <Text role="alert" className={s.message()}>{error}</Text>
      ) : hint ? (
        <Text className={NEON_FIELD.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}
