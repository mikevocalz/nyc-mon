import { tv } from 'tailwind-variants';
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
  },
});

export interface ToolbarProps {
  title?: string;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  /** Cornice colour family. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default midtown (orange). */
  district?: District;
  className?: string;
}

export function Toolbar({ title, leading, actions, tone, district, className }: ToolbarProps) {
  const s = toolbar({ tone: resolveControlTone(tone, district) });
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
