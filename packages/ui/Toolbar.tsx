import { tv } from 'tailwind-variants';
import { TYPE_SCALE_TV } from './type-scale';
import { Header, Nav } from './primitives';
import { View, Text } from './tw';
import { resolveControlTone, toneVariants, type ControlTone, type District } from './district';

// §9 contextual top bar: presentational, with the leading control (back/menu)
// and the trailing action row (IconButtons) passed in as slots.
//
// NYC-MON: a night bar, the title in the display face, and a two-step cornice
// along the bottom edge: a tone face band over its darker plate step, the way
// a Deco cornice reads from the street.
const toolbar = tv({
  slots: {
    root: 'w-full bg-ink-950',
    row: 'h-14 flex-row items-center justify-between gap-2 px-4 md:h-16 md:px-6',
    leading: 'flex-row items-center gap-2',
    title: 'flex-1 font-display text-lg text-ink-50 md:text-xl',
    actions: 'flex-row items-center gap-2',
    cornice: 'h-1 w-full',
    plate: 'h-0.5 w-full',
  },
  variants: {
    tone: toneVariants((c) => ({ cornice: c.face, plate: c.plate })),
    density: {
      default: {},
      compact: {
        row: 'min-h-13 h-auto min-w-0 px-2 md:h-auto md:px-2',
        title: 'min-w-0 font-sans text-type-caption md:text-type-caption',
      },
    },
  },
  defaultVariants: { density: 'default' },
}, TYPE_SCALE_TV);

export interface ToolbarProps {
  title?: string;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  /** Cornice colour family. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default midtown (orange). */
  district?: District;
  /** Pane-friendly spacing without device-wide desktop height escalation. */
  density?: 'default' | 'compact';
  className?: string;
}

export function Toolbar({ title, leading, actions, tone, district, density = 'default', className }: ToolbarProps) {
  const s = toolbar({ tone: resolveControlTone(tone, district), density });
  return (
    <Header aria-label={title} className={s.root({ className })}>
      <View className={s.row()}>
        {leading ? <View className={s.leading()}>{leading}</View> : null}
        {title ? (
          <Text numberOfLines={1} className={s.title()}>
            {title}
          </Text>
        ) : (
          <View className="flex-1" />
        )}
        {actions ? <Nav className={s.actions()}>{actions}</Nav> : null}
      </View>
      <View aria-hidden className={s.cornice()} />
      <View aria-hidden className={s.plate()} />
    </Header>
  );
}
