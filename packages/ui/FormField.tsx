import { tv } from 'tailwind-variants';
import { View } from './tw';
import { Label } from './primitives';
import { Text } from './Text';
import { NEON_FIELD } from './cards/neon-field';
import { resolveControlTone, toneVariants, type ControlTone, type District } from './district';

// The label + hint/error shell from TextField, for controls that bring their
// own input: the label is the neon nameplate (a solid tone tag in the display
// face), the error is apple 400 in the display face. Presentational only; the
// control comes in as children, controlled by the parent.
const formField = tv({
  slots: {
    root: NEON_FIELD.root,
    label: NEON_FIELD.label,
    message: NEON_FIELD.message,
  },
  variants: {
    tone: toneVariants((c) => ({ label: `${c.face} ${c.onFace}` })),
    disabled: { true: { root: NEON_FIELD.disabled } },
  },
});

export interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  /** Colour family of the nameplate. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default Midtown (orange). */
  district?: District;
}

export function FormField({ label, children, hint, error, disabled, className, tone, district }: FormFieldProps) {
  const s = formField({ disabled, tone: resolveControlTone(tone, district) });
  return (
    <View className={s.root({ className })}>
      <Label className={s.label()}>{label}</Label>
      {children}
      {error ? (
        <Text role="alert" className={s.message()}>{error}</Text>
      ) : hint ? (
        <Text className={NEON_FIELD.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}
