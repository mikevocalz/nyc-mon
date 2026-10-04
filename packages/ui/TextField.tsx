'use client';
import { useRef } from 'react';
import { tv } from 'tailwind-variants';
import { PasteWrapper, type PasteEventPayload } from './paste-wrapper';
import { View, Pressable, Text as TWText } from './tw';
import { Input, Label } from './primitives';
import type { InputHandle } from './html/dom';
import { Text } from './Text';
import { X } from './icons';
import { NEON_FIELD, neonErrorVariant, neonFieldCompounds, neonLabelCompounds } from './cards/neon-field';
import { resolveControlTone, toneVariants, type ControlTone, type District } from './district';
import { TYPE_SCALE_TV } from './type-scale';

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

/**
 * The daylit look (M03/M04/M05/M07 handoffs): a raised face with a
 * `text-muted` edge (concrete-600 by day, silver by night) and the label
 * above it in type-label `text`. Every colour is a theme token, so the same
 * field reads on a daylit page and on night.
 */
const daylit = tv({
  slots: {
    root: 'gap-1.5',
    label: 'self-start font-sans text-type-label text-text',
    input:
      'w-full min-h-11 rounded-none border-2 border-text-muted bg-surface-raised px-4 py-2.5 text-base text-text ' +
      'placeholder:text-text-muted transition-colors duration-fast focus:border-focus focus:outline-none motion-reduce:transition-none',
    message: NEON_FIELD.message,
  },
  variants: {
    error: { true: { input: 'border-danger focus:border-danger' }, false: {} },
    disabled: { true: { input: NEON_FIELD.disabled } },
  },
  defaultVariants: { error: false },
}, TYPE_SCALE_TV);

export type { PasteEventPayload };

/** `well`: the night well with a tone nameplate (default). `daylit`: a raised face that follows the scheme. */
export type TextFieldSurface = 'well' | 'daylit';

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
  /** Default `well`. `daylit` for screens on the daylit page (sign-in, onboarding forms). */
  surface?: TextFieldSurface;
  /** Colour family for the nameplate and well border. Overrides `district`. Ignored by `daylit`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default Midtown (orange). Ignored by `daylit`. */
  district?: District;
  /** Rich paste (text / images / GIFs from the clipboard) via expo-paste-input — iOS, Android, and web. */
  onPaste?: (payload: PasteEventPayload) => void;
  /**
   * A 44 pt clear button inside the field, shown while `value` has text.
   * Needs a controlled `value` and `onChangeText`; pressing it sends '' and
   * returns focus to the field. The label is required because the button has
   * no visible text.
   */
  clearButton?: { accessibilityLabel: string };
}

export function TextField({
  rounded = false, label, hint, error, disabled, className, containerClassName, variant: _variant,
  surface = 'well', tone, district, onPaste, clearButton, ...inputProps
}: TextFieldProps) {
  const s = surface === 'daylit'
    ? daylit({ error: !!error, disabled })
    : field({ error: !!error, disabled, tone: resolveControlTone(tone, district) });
  const fieldRef = useRef<InputHandle>(null);
  const value = inputProps.value;
  const showClear = !!clearButton && !disabled && typeof value === 'string' && value.length > 0;
  // Trailing room for whatever sits inside the field: the paste chip, the clear button, or both.
  const trail = showClear && onPaste ? 'pr-24' : showClear || onPaste ? 'pr-12' : '';
  const input = (
    <Input
      aria-label={label}
      aria-invalid={!!error}
      editable={!disabled}
      placeholderTextColor={undefined}
      className={s.input({ className: `${rounded ? 'rounded-soft' : ''} ${trail} ${className ?? ''}` })}
      {...inputProps}
      ref={fieldRef}
    />
  );
  const clear = showClear ? (
    <Pressable
      role="button"
      accessibilityLabel={clearButton.accessibilityLabel}
      onPress={() => {
        inputProps.onChangeText?.('');
        // The button leaves with the text, so focus goes back to the field, not the page.
        fieldRef.current?.focus();
      }}
      className={`absolute bottom-0 top-0 w-11 items-center justify-center rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${onPaste ? 'right-12' : 'right-0'}`}
    >
      <X size={18} strokeWidth={2.5} className={surface === 'daylit' ? 'text-text-muted' : 'text-silver-300'} />
    </Pressable>
  ) : null;
  // Stable while a clear button is configured: switching wrappers would remount the input and drop its focus.
  const trailing = !!onPaste || !!clearButton;
  return (
    <View className={s.root({ className: containerClassName })}>
      <Label className={s.label()}>{label}</Label>
      {trailing ? (
        <PasteWrapperIf onPaste={onPaste}>
          <View className="relative">
            {input}
            {clear}
            {onPaste ? (
              <View
                aria-hidden
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${NEON_FIELD.chip}`}
              >
                <TWText className={NEON_FIELD.chipText}>⌘V</TWText>
              </View>
            ) : null}
          </View>
        </PasteWrapperIf>
      ) : input}
      {error ? (
        <Text role="alert" className={s.message()}>{error}</Text>
      ) : hint ? (
        <Text className={NEON_FIELD.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** The paste wrapper only when the caller handles paste. */
function PasteWrapperIf({ onPaste, children }: { onPaste?: (payload: PasteEventPayload) => void; children: React.ReactNode }) {
  return onPaste ? <PasteWrapper onPaste={onPaste}>{children}</PasteWrapper> : <>{children}</>;
}
