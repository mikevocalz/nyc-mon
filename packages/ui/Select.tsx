'use client';
import { tv } from 'tailwind-variants';
import { Platform } from 'react-native';
import { View } from './tw';
import { NeonChevron } from './neon/NeonChevron';
import { Select as PrimitiveSelect, Label } from './primitives';
import { Text } from './Text';
import { NEON_FIELD, neonErrorVariant, neonFieldCompounds, neonLabelCompounds } from './cards/neon-field';
import { resolveControlTone, toneVariants, type ControlTone, type District } from './district';

const field = tv({
  slots: {
    root: NEON_FIELD.root,
    label: NEON_FIELD.label,
    // Web: the browser arrow is hidden and the kit chevron sits in the right padding.
    select: `${NEON_FIELD.input} cursor-pointer appearance-none pr-14`,
    chevron: 'absolute right-2 top-1/2 -translate-y-1/2',
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
  const toneName = resolveControlTone(tone, district);
  const s = field({ error: !!error, disabled, tone: toneName });
  // Native renders the OS picker (a menu on both platforms), which draws its own
  // indicator; a second chevron there would double it.
  const ownChevron = Platform.OS === 'web';
  return (
    <View className={s.root({ className: containerClassName })}>
      <Label className={s.label()}>{label}</Label>
      <View className="relative w-full">
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
        {ownChevron ? <NeonChevron tone={toneName} disabled={disabled} className={s.chevron()} /> : null}
      </View>
      {error ? (
        <Text role="alert" className={s.message()}>{error}</Text>
      ) : hint ? (
        <Text className={NEON_FIELD.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}
