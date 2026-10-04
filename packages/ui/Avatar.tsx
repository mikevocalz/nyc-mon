import { tv } from 'tailwind-variants';
import { SolitoImage } from 'solito/image';
import { View, Text } from './tw';
import { TONE_CLASSES, resolveControlTone, type ControlTone, type District } from './district';
import { initialsOf } from './surface-look';

/**
 * The NYC-MON avatar: a jersey-number tile. A solid tone face in a night
 * keyline over a depth plate stepped down and right, initials in the display
 * face. Plate and face both sit inside the box the size (or a caller's
 * className, e.g. `md:h-11 md:w-11`) sets, so the tile never spills into
 * the row around it.
 */
const avatar = tv({
  slots: {
    root: 'relative',
    plate: 'absolute bottom-0 right-0',
    face: 'absolute left-0 top-0 items-center justify-center overflow-hidden border-2 border-ink-950',
    initials: 'font-display leading-none',
  },
  variants: {
    size: {
      sm: { root: 'h-8 w-8', plate: 'left-0.5 top-0.5', face: 'bottom-0.5 right-0.5', initials: 'text-[11px]' },
      md: { root: 'h-11 w-11', plate: 'left-1 top-1', face: 'bottom-1 right-1', initials: 'text-sm' },
      lg: { root: 'h-16 w-16', plate: 'left-1.5 top-1.5', face: 'bottom-1.5 right-1.5', initials: 'text-xl' },
      xl: { root: 'h-24 w-24', plate: 'left-2 top-2', face: 'bottom-2 right-2 border-[3px]', initials: 'text-3xl' },
    },
  },
  defaultVariants: { size: 'md' },
});

export interface AvatarProps {
  name: string;
  imageUri?: string;
  /** Default md (44px). */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Tile colour by neighbourhood. Default midtown (orange). */
  district?: District;
  /** Tile colour; overrides the district. */
  tone?: ControlTone;
}

export function Avatar({ name, imageUri, size, className, district, tone }: AvatarProps) {
  const toneName = resolveControlTone(tone, district);
  const t = TONE_CLASSES[toneName];
  // Small initials need 4.5:1; white on apple-500 is 3.96:1, night is 4.83:1.
  const on = toneName === 'apple' ? 'text-ink-950' : t.onFace;
  const s = avatar({ size });
  return (
    <View role="img" aria-label={name} className={s.root({ className })}>
      <View aria-hidden className={s.plate({ className: t.plate })} />
      <View className={s.face({ className: t.face })}>
        {imageUri ? (
          <SolitoImage src={imageUri} alt="" fill unoptimized contentFit="cover" sizes="96px" />
        ) : (
          <Text aria-hidden className={s.initials({ className: on })}>{initialsOf(name)}</Text>
        )}
      </View>
    </View>
  );
}
