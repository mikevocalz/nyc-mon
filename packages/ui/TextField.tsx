'use client';
import { tv } from 'tailwind-variants';
import { PasteWrapper, type PasteEventPayload } from './paste-wrapper';
import { View, Text as TWText } from './tw';
import { Input, Label } from './primitives';
import { Text } from './Text';
import { NEON_FIELD, neonErrorVariant, neonFieldCompounds, neonLabelCompounds } from './cards/neon-field';
import { resolveControlTone, toneVariants, type ControlTone, type District } from './district';

const field = tv({
  slots: {
    root: NEON_FIELD.root,
    label: NEON_FIELD.label,
    input: `${NEON_FIELD.input}`,
    message: NEON_FIELD.message,
  },
  variants: {
    error: { true: neonErrorVariant('input'), false: {} },
    disabled: { true: { input: NEON_FIELD.disabled } },
    tone: toneVariants(() => ({})),
  },
  compoundVariants: [...neonFieldCompounds('input'), ...neonLabelCompounds()],
  defaultVariants: { error: false },
});

export type { PasteEventPayload };

export interface TextFieldProps extends React.ComponentProps<typeof Input> {
  /** Opt-in rounded corners (rounded-soft). Default false: square. */
  rounded?: boolean;
  label: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  containerClassName?: string;
  /** The NYC-MON field is the only look; `neon` and `default` are both accepted for older callers. */
  variant?: 'default' | 'neon';
  /** Colour family for the nameplate and well border. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default Midtown (orange). */
  district?: District;
  /** Rich paste (text / images / GIFs from the clipboard) via expo-paste-input — iOS, Android, and web. */
  onPaste?: (payload: PasteEventPayload) => void;
}

export function TextField({
  rounded = false, label, hint, error, disabled, className, containerClassName, variant: _variant, tone, district, onPaste, ...inputProps
}: TextFieldProps) {
  const s = field({ error: !!error, disabled, tone: resolveControlTone(tone, district) });
  const input = (
    <Input
      aria-label={label}
      aria-invalid={!!error}
      editable={!disabled}
      placeholderTextColor={undefined}
      className={s.input({ className: `${rounded ? 'rounded-soft' : ''} ${onPaste ? 'pr-12' : ''} ${className ?? ''}` })}
      {...inputProps}
    />
  );
  return (
    <View className={s.root({ className: containerClassName })}>
      <Label className={s.label()}>{label}</Label>
      {onPaste ? (
        <PasteWrapper onPaste={onPaste}>
          <View className="relative">
            {input}
            <View
              aria-hidden
              className={`absolute right-3 top-1/2 -translate-y-1/2 ${NEON_FIELD.chip}`}
            >
              <TWText className={NEON_FIELD.chipText}>⌘V</TWText>
            </View>
          </View>
        </PasteWrapper>
      ) : input}
      {error ? (
        <Text role="alert" className={s.message()}>{error}</Text>
      ) : hint ? (
        <Text className={NEON_FIELD.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}
