import { tv } from 'tailwind-variants';
import { Badge } from './Badge';
import { controlA11y } from './hlynk/a11y';
import { Text } from './Text';
import { Pressable, View } from './tw';
import type { LegacyBadgeTone } from './surface-look';

/**
 * The onboarding status tones understood by {@linkcode StatusRow}. They are
 * mapped onto {@linkcode Badge} tones so the chips stay semantic and brand-
 * aligned.
 */
export type StatusRowTone = 'pending' | 'offline' | 'neutral';

/** One optional text action on a {@linkcode StatusRowItem}, e.g. "Open Settings". */
export interface StatusRowAction {
  label: string;
  /** Spoken detail beyond the label — says what happens, not how to gesture. */
  accessibilityHint?: string;
  onPress: () => void;
}

export interface StatusRowItem {
  /** Stable key; also the testID suffix (`status-{id}`). */
  id: string;
  /** Visible text, at least `type-caption`. */
  label: string;
  /** Spoken text when it must say more than the visible label. Defaults to `label`. */
  accessibilityLabel?: string;
  /** Semantic tone; defaults to `neutral`. */
  tone?: StatusRowTone;
  /**
   * One optional text action. An item with an action is a sentence and a
   * link, not a chip — badges clip at status length.
   */
  action?: StatusRowAction;
}

/**
 * Props for {@linkcode StatusRow}.
 */
export interface StatusRowProps {
  /** A one-line set of statuses. Empty arrays render nothing. */
  items: StatusRowItem[];
}

const row = tv({
  slots: {
    root: 'flex-row flex-wrap items-center gap-2',
    actionItem: 'w-full flex-row flex-wrap items-center gap-x-3 gap-y-1',
    actionLabel: 'flex-1 basis-48',
    actionLink:
      'min-h-11 items-center justify-center rounded-none px-2 ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ' +
      'focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
  },
});

const TONE_MAP: Record<StatusRowTone, LegacyBadgeTone> = {
  pending: 'neutral',
  offline: 'danger',
  neutral: 'neutral',
};

/**
 * A one-line row of statuses for onboarding-time states (pending consent,
 * offline, notifications off). Chip items render as {@linkcode Badge}s; an
 * item carrying an `action` renders as a muted line plus a text link. The
 * container carries `accessibilityRole="none"`; each part supplies its own
 * label so the row is not over-announced.
 */
export function StatusRow({ items }: StatusRowProps) {
  if (!items.length) return null;
  const s = row();
  return (
    <View accessibilityRole="none" className={s.root()}>
      {items.map((item) =>
        item.action !== undefined ? (
          <View key={item.id} className={s.actionItem()}>
            <Text
              variant="caption"
              tone="muted"
              className={s.actionLabel()}
              accessibilityLabel={item.accessibilityLabel}
            >
              {item.label}
            </Text>
            <Pressable
              role="link"
              {...controlA11y({ label: item.action.label, hint: item.action.accessibilityHint, disabled: false })}
              onPress={item.action.onPress}
              className={s.actionLink()}
            >
              <Text variant="label" tone="accent" className="underline">
                {item.action.label}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Badge
            key={item.id}
            label={item.label}
            tone={TONE_MAP[item.tone ?? 'neutral']}
            size="sm"
          />
        ),
      )}
    </View>
  );
}
