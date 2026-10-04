import { tv } from 'tailwind-variants';
import { Badge } from './Badge';
import { View } from './tw';
import type { LegacyBadgeTone } from './surface-look';

/**
 * The onboarding status tones understood by {@linkcode StatusRow}. They are
 * mapped onto {@linkcode Badge} tones so the chips stay semantic and brand-
 * aligned.
 */
export type StatusRowTone = 'pending' | 'offline' | 'neutral';

export interface StatusRowItem {
  /** Stable key for the chip. */
  id: string;
  /** Visible label on the status chip. */
  label: string;
  /** Semantic tone; defaults to `neutral`. */
  tone?: StatusRowTone;
}

/**
 * Props for {@linkcode StatusRow}.
 */
export interface StatusRowProps {
  /** A one-line set of status chips. Empty arrays render nothing. */
  items: StatusRowItem[];
}

const row = tv({
  slots: {
    root: 'flex-row flex-wrap items-center gap-2',
  },
});

const TONE_MAP: Record<StatusRowTone, LegacyBadgeTone> = {
  pending: 'neutral',
  offline: 'danger',
  neutral: 'neutral',
};

/**
 * A one-line row of status badges for onboarding-time states (pending
 * consent, offline, etc.). The container carries `accessibilityRole="none"`;
 * each {@linkcode Badge} supplies its own label so the row is not
 * over-announced.
 */
export function StatusRow({ items }: StatusRowProps) {
  if (!items.length) return null;
  const s = row();
  return (
    <View accessibilityRole="none" className={s.root()}>
      {items.map((item) => (
        <Badge
          key={item.id}
          label={item.label}
          tone={TONE_MAP[item.tone ?? 'neutral']}
          size="sm"
        />
      ))}
    </View>
  );
}
