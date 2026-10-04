import { cloneElement, isValidElement, type ReactElement } from 'react';
import { tv } from 'tailwind-variants';
import { View } from './tw';
import { FadeIn, ScaleIn } from './motion';
import { Text } from './Text';
import { TONE_CLASSES, resolveControlTone, type ControlTone, type District } from './district';
import { skylineHeights, withoutTextColour } from './surface-look';

/**
 * The NYC-MON empty state: the icon on a solid tone tile with a depth plate,
 * standing on a small night skyline with a tone street line, then a display
 * title. The page behind it can be light or dark, so the text uses theme
 * tokens; the tile sets its own icon colour. `illustration` swaps the tile
 * and skyline for the caller's art; with neither, the state opens on its title.
 */
const emptyState = tv({
  slots: {
    root: 'items-center justify-center gap-2 p-10',
    mark: 'relative mb-3 h-24 w-44 items-center justify-end',
    illustration: 'mb-3 w-full max-w-content-form items-center',
    skyline: 'absolute inset-x-0 bottom-1 h-14 flex-row items-end gap-1',
    building: 'flex-1 bg-ink-800',
    street: 'absolute inset-x-0 bottom-0 h-1',
    tile: 'relative mb-1 h-[70px] w-[70px]',
    plate: 'absolute bottom-0 right-0 left-1.5 top-1.5',
    face: 'absolute left-0 top-0 bottom-1.5 right-1.5 items-center justify-center border-2 border-ink-950',
    title: 'text-center font-display text-xl leading-tight text-text md:text-2xl',
    description: 'max-w-content-form text-center',
    action: 'mt-3 items-center',
  },
});

export interface EmptyStateProps {
  /**
   * The glyph on the tone tile above the skyline. Ignored when `illustration`
   * is set. With neither, the state starts at its title and leaves no gap.
   */
  icon?: React.ReactNode;
  /**
   * Art that replaces the icon tile and skyline. The caller owns its
   * accessible name (an image with alt text, or `aria-hidden` art). Pass
   * nothing while the art does not exist yet: the slot renders nothing,
   * never a placeholder.
   */
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Tile and street colour by neighbourhood. Default midtown (orange). */
  district?: District;
  /** Tile colour; overrides the district. */
  tone?: ControlTone;
}

export function EmptyState({ icon, illustration, title, description, action, className, district, tone }: EmptyStateProps) {
  const toneName = resolveControlTone(tone, district);
  const t = TONE_CLASSES[toneName];
  const on = toneName === 'apple' ? 'text-ink-950' : t.onFace;
  const s = emptyState();
  // The icon sits on a solid face, so its colour comes from the tile: a
  // caller's `text-text-muted` would vanish on orange.
  const glyph = isValidElement(icon)
    ? cloneElement(icon as ReactElement<{ className?: string }>, {
        className: `${withoutTextColour((icon as ReactElement<{ className?: string }>).props.className)} ${on}`,
      })
    : icon;

  return (
    <FadeIn className={s.root({ className })}>
      {illustration ? (
        <ScaleIn delay={80} className={s.illustration()}>{illustration}</ScaleIn>
      ) : icon ? (
        <ScaleIn aria-hidden delay={80} className={s.mark()}>
          <View className={s.skyline()}>
            {skylineHeights(1, 11).map((h, i) => (
              // Computed geometry: each building's height is a share of the strip.
              <View key={i} className={s.building()} style={{ height: `${h}%` }} />
            ))}
          </View>
          <View className={s.street({ className: t.face })} />
          <View className={s.tile()}>
            <View className={s.plate({ className: t.plate })} />
            <View className={s.face({ className: t.face })}>{glyph}</View>
          </View>
        </ScaleIn>
      ) : null}
      <Text className={s.title()}>{title}</Text>
      {description ? (
        <Text tone="muted" className={s.description()}>{description}</Text>
      ) : null}
      {action ? <View className={s.action()}>{action}</View> : null}
    </FadeIn>
  );
}
