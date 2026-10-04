'use client';
import { tv, type VariantProps } from 'tailwind-variants';
import { Pressable, View } from './tw';
import { Text } from './Text';
import { Check, Info, LoaderCircle, TriangleAlert, X } from './icons';
import { TONE_CLASSES, resolveTone, type District, type Tone } from './elements/tones';
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

export interface ToastCardProps extends VariantProps<typeof neonCard> {
  title: string;
  description?: string;
  /** One action, right-aligned. More than one belongs in a dialog, not a toast. */
  action?: { label: string; onPress: () => void };
  onDismiss?: () => void;
  className?: string;
  /** The storefront is the only look; kept so older callers compile. */
  appearance?: 'default' | 'neon';
  /** neon: colour by neighbourhood. Default midtown. */
  district?: District;
  /** neon: brand token or NeonBlade preset; overrides the district. */
  color?: NeonColorInput | Tone;
}

/** The NYC-MON storefront card; `appearance` is accepted for older callers and ignored. */
export function ToastCard(props: ToastCardProps) {
  return <NeonToastCard {...props} />;
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
