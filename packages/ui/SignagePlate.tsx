import { Text, View } from './tw';

/**
 * Largest type step the plate starts at before stepping down for long text.
 * `station` begins at `type-station`, `title` at `type-title`; the caller sets
 * a ceiling, the plate steps itself.
 */
export type SignagePlateSize = 'station' | 'title';

/**
 * Props for {@linkcode SignagePlate}: the MTA-signage band (white type on a
 * black band) that previews the Caller name on M07 and the Mon's name at M09
 * and the hatch.
 */
export interface SignagePlateProps {
  /** Shown exactly as given. The plate renders nothing for an empty string. */
  text: string;
  /** Spoken label, always with the full text even when the plate truncates (e.g. `m07.plate.a11y.label`). */
  accessibilityLabel: string;
  /** Largest type step to try before stepping down. @default 'station' */
  maxSize?: SignagePlateSize;
  className?: string;
  testID?: string;
}

const LONG_TEXT_THRESHOLD = 16;

const RAMP: readonly `text-type-${string}`[] = [
  'text-type-station',
  'text-type-title',
  'text-type-body-strong',
  'text-type-body',
  'text-type-label',
  'text-type-caption',
];

function typeClassFor(maxSize: SignagePlateSize, text: string): `text-type-${string}` {
  const start = maxSize === 'station' ? 0 : 1;
  const step = text.length > LONG_TEXT_THRESHOLD ? start + 1 : start;
  return RAMP[Math.min(step, RAMP.length - 1)]!;
}

/**
 * One line, never wraps: over 16 characters the type steps down one ramp step.
 * On a night page it picks up a 1 pt `silver` keyline (M07 `07-a11y.md`
 * finding 4); the `dark:` utility resolves against `data-theme`. It is never
 * a live region — callers announce changes themselves.
 */
export function SignagePlate({ text, accessibilityLabel, maxSize = 'station', className, testID }: SignagePlateProps) {
  if (!text) return null;
  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      className={`w-full items-center justify-center overflow-hidden border border-transparent bg-signage-black px-4 py-3 dark:border-silver-300 ${className ?? ''}`}
    >
      <Text numberOfLines={1} className={`${maxSize === 'station' ? 'font-display' : 'font-sans'} text-center text-signage-white ${typeClassFor(maxSize, text)}`}>
        {text}
      </Text>
    </View>
  );
}
