'use client';
import { tv, type VariantProps } from 'tailwind-variants';
import { Pressable, View } from './tw';
import { Text } from './Text';
import { Check, Info, LoaderCircle, TriangleAlert, X } from './icons';
import { TONE_CLASSES, resolveTone, type District, type Tone } from './district';
import type { NeonColorInput } from './neon/colors';

/**
 * The toast card itself — shared by BOTH toasters.
 *
 * sonner (web) and sonner-native both accept custom JSX, so the design is
 * written once here and each platform's toaster only supplies the queue,
 * positioning and enter/exit motion. Theming two different libraries' internal
 * styles to match would have produced two designs that drift.
 *
 * Deliberately NOT wrapped in `SlideUp`: the toaster owns entrance and exit,
 * and a second animation on the same element fights it.
 */
const card = tv({
  slots: {
    root:
      'w-full max-w-content-form self-center flex-row items-start gap-3 rounded-card border-2 border-border ' +
      'bg-surface-raised p-3.5 shadow-overlay',
    // A rounded square inside the rounded rectangle — the same containment the
    // switches and icon buttons use, so a toast reads as part of this app.
    tile: 'h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-border',
    icon: '',
    body: 'flex-1 gap-0.5 py-0.5',
    title: 'text-sm font-semibold text-text',
    description: 'text-sm leading-snug text-text-muted',
    action:
      'shrink-0 items-center justify-center rounded-md border-2 border-border bg-surface px-3 py-2 ' +
      'transition-colors duration-fast hover:bg-surface-sunken active:bg-surface-sunken motion-reduce:transition-none',
    actionLabel: 'text-sm font-semibold text-text',
    close:
      'h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-fast ' +
      'hover:bg-surface-sunken active:bg-surface-sunken motion-reduce:transition-none',
  },
  variants: {
    // Colour lives on the tile, never the card. A fully tinted card would put
    // the loudest thing on screen behind the words instead of on the status.
    variant: {
      info: { tile: 'bg-primary', icon: 'text-on-primary' },
      success: { tile: 'bg-accent', icon: 'text-on-accent' },
      warning: { tile: 'bg-primary', icon: 'text-on-primary' },
      error: { tile: 'bg-danger', icon: 'text-on-danger' },
      loading: { tile: 'bg-surface-sunken', icon: 'text-text-muted' },
    },
  },
  defaultVariants: { variant: 'info' },
});

/**
 * The neon appearance: a storefront at night. A cornice band in the district
 * tone caps a night facade, the status icon sits in a lit window, and the
 * title is set in the display face. Status colour stays on the window (info
 * takes the district tone), so meaning never depends on the neighbourhood.
 * Ported from NeonBlade UI's NeonModal toast pattern (MIT, see
 * THIRD-PARTY-NOTICES.md).
 */
const neonCard = tv({
  slots: {
    root: 'w-full max-w-content-form self-center',
    cornice: 'h-2 border-2 border-b-0 border-ink-950',
    face: 'flex-row items-start gap-3 border-x-2 border-b-2 border-ink-950 bg-ink-900 p-3',
    tile: 'h-10 w-10 shrink-0 items-center justify-center border-2 border-ink-950',
    icon: '',
    body: 'flex-1 gap-0.5 py-0.5',
    title: 'font-display text-base leading-tight text-ink-50',
    description: 'text-sm leading-snug text-silver-300',
    action: 'shrink-0 items-center justify-center border-2 border-ink-950 px-3 py-2 active:opacity-80',
    actionLabel: 'text-sm font-bold',
    close: 'h-8 w-8 shrink-0 items-center justify-center hover:bg-ink-800 active:bg-ink-800',
  },
  variants: {
    variant: {
      info: {},
      success: { tile: 'bg-leaf-500', icon: 'text-ink-950' },
      warning: { tile: 'bg-orange-500', icon: 'text-ink-950' },
      error: { tile: 'bg-apple-500', icon: 'text-ink-50' },
      loading: { tile: 'bg-ink-700', icon: 'text-ink-50' },
    },
  },
  defaultVariants: { variant: 'info' },
});

const GLYPH = {
  info: Info,
  success: Check,
  warning: TriangleAlert,
  error: TriangleAlert,
  loading: LoaderCircle,
} as const;

export interface ToastCardProps extends VariantProps<typeof card> {
  title: string;
  description?: string;
  /** One action, right-aligned. More than one belongs in a dialog, not a toast. */
  action?: { label: string; onPress: () => void };
  onDismiss?: () => void;
  className?: string;
  /** default: the kit card. neon: the NYC-MON storefront. */
  appearance?: 'default' | 'neon';
  /** neon: colour by neighbourhood. Default midtown. */
  district?: District;
  /** neon: brand token or NeonBlade preset; overrides the district. */
  color?: NeonColorInput | Tone;
}

export function ToastCard(props: ToastCardProps) {
  if (props.appearance === 'neon') return <NeonToastCard {...props} />;
  const { variant, title, description, action, onDismiss, className } = props;
  const s = card({ variant });
  const Glyph = GLYPH[variant ?? 'info'];

  return (
    <View
      // `status` is polite; an error toast is the one case worth interrupting.
      role={variant === 'error' ? 'alert' : 'status'}
      className={s.root({ className })}
    >
      <View aria-hidden className={s.tile()}>
        <Glyph size={18} className={s.icon()} />
      </View>

      <View className={s.body()}>
        <Text className={s.title()}>{title}</Text>
        {description ? <Text className={s.description()}>{description}</Text> : null}
      </View>

      {action ? (
        <Pressable role="button" onPress={action.onPress} className={s.action()}>
          <Text className={s.actionLabel()} numberOfLines={1}>{action.label}</Text>
        </Pressable>
      ) : null}

      {onDismiss ? (
        <Pressable role="button" aria-label="Dismiss" onPress={onDismiss} className={s.close()}>
          <X size={16} className="text-text-muted" />
        </Pressable>
      ) : null}
    </View>
  );
}

function NeonToastCard({
  variant, title, description, action, onDismiss, className, district = 'midtown', color,
}: ToastCardProps) {
  const t = TONE_CLASSES[resolveTone(district, color)];
  const s = neonCard({ variant });
  const Glyph = GLYPH[variant ?? 'info'];
  const isInfo = (variant ?? 'info') === 'info';

  return (
    <View role={variant === 'error' ? 'alert' : 'status'} className={s.root({ className })}>
      <View aria-hidden className={s.cornice({ className: t.face })} />
      <View className={s.face()}>
        <View aria-hidden className={s.tile({ className: isInfo ? t.face : '' })}>
          <Glyph size={20} className={s.icon({ className: isInfo ? t.on : '' })} />
        </View>
        <View className={s.body()}>
          <Text className={s.title()}>{title}</Text>
          {description ? <Text className={s.description()}>{description}</Text> : null}
        </View>
        {action ? (
          <Pressable role="button" onPress={action.onPress} className={s.action({ className: t.face })}>
            <Text className={s.actionLabel({ className: t.on })} numberOfLines={1}>{action.label}</Text>
          </Pressable>
        ) : null}
        {onDismiss ? (
          <Pressable role="button" aria-label="Dismiss" onPress={onDismiss} className={s.close()}>
            <X size={16} className="text-silver-300" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
