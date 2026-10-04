'use client';
import { View } from './tw';
import { Select as PrimitiveSelect, Label } from './primitives';
import { Text } from './Text';
import { NEON_FIELD } from './cards/neon-field';
import { resolveControlTone } from './district';
import { selectField } from './select-look';
import type { SelectProps } from './Select.types';

/**
 * Native Select: the OS picker (a menu on both platforms) inside the neon
 * well. The picker draws its own list and indicator, so there is no kit
 * chevron or dropdown panel here; the web fork draws the kit dropdown.
 */
export function Select({
  label, hint, error, disabled, className, rounded = false, containerClassName, variant: _variant, tone, district, options, children, ...selectProps
}: SelectProps) {
  const toneName = resolveControlTone(tone, district);
  const s = selectField({ error: !!error, disabled, tone: toneName });
  return (
    <View className={s.root({ className: containerClassName })}>
      <Label className={s.label()}>{label}</Label>
      <View className="relative w-full">
        <PrimitiveSelect
          aria-label={label}
          disabled={disabled}
          className={s.select({ className: `${rounded ? 'rounded-soft' : ''} ${className ?? ''}` })}
          {...selectProps}
        >
          {options?.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label ?? o.value}</option>
          ))}
          {children}
        </PrimitiveSelect>
      </View>
      {error ? (
        <Text role="alert" className={s.message()}>{error}</Text>
      ) : hint ? (
        <Text className={NEON_FIELD.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}
