import { tv } from 'tailwind-variants';
import { SolitoImage } from 'solito/image';
import { View, Text } from './tw';
import { TONE_CLASSES, resolveControlTone, type ControlTone, type District } from './district';
import { initialsOf } from './surface-look';

/**
 * The NYC-MON avatar, cut like a cell of the neon DataTable: a square night
 * tile in an ink keyline with the table's cornice brackets at each corner in
 * the district tone, initials in the display face and the tone's text step.
 * Square everywhere; nothing about it is round. The brackets sit inside the
 * box the size (or a caller's className, e.g. `md:h-11 md:w-11`) sets, so the
 * tile never spills into the row around it.
 */
const avatar = tv({
  slots: {
    root: 'relative overflow-hidden border-2 border-ink-800 bg-ink-900',
    face: 'absolute inset-0 items-center justify-center',
    initials: 'font-display leading-none',
    bracket: 'absolute',
  },
  variants: {
    size: {
      sm: { root: 'h-8 w-8', initials: 'text-[11px]', bracket: 'h-2 w-2' },
      md: { root: 'h-11 w-11', initials: 'text-sm', bracket: 'h-2.5 w-2.5' },
      lg: { root: 'h-16 w-16', initials: 'text-xl', bracket: 'h-3.5 w-3.5' },
      xl: { root: 'h-24 w-24', initials: 'text-3xl', bracket: 'h-5 w-5' },
    },
  },
  defaultVariants: { size: 'md' },
});

// The DataTable's cornice brackets, one per corner. Heavier on the larger tiles.
const CORNERS = {
  thin: ['left-0 top-0 border-l-2 border-t-2', 'right-0 top-0 border-r-2 border-t-2', 'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'],
  thick: ['left-0 top-0 border-l-4 border-t-4', 'right-0 top-0 border-r-4 border-t-4', 'bottom-0 left-0 border-b-4 border-l-4', 'bottom-0 right-0 border-b-4 border-r-4'],
} as const;

export interface AvatarProps {
  name: string;
  imageUri?: string;
  /** Default md (44px). */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Bracket and initials colour by neighbourhood. Default midtown (orange). */
  district?: District;
  /** Bracket and initials colour; overrides the district. */
  tone?: ControlTone;
}

export function Avatar({ name, imageUri, size = 'md', className, district, tone }: AvatarProps) {
  const t = TONE_CLASSES[resolveControlTone(tone, district)];
  const s = avatar({ size });
  const corners = size === 'lg' || size === 'xl' ? CORNERS.thick : CORNERS.thin;
  return (
    <View role="img" aria-label={name} className={s.root({ className })}>
      <View className={s.face()}>
        {imageUri ? (
          <SolitoImage src={imageUri} alt="" fill unoptimized contentFit="cover" sizes="96px" />
        ) : (
          // Tone text steps hold 4.5:1 on night (district.test.ts checks them).
          <Text aria-hidden className={s.initials({ className: t.text })}>{initialsOf(name)}</Text>
        )}
      </View>
      {corners.map((pos) => (
        <View key={pos} aria-hidden pointerEvents="none" className={s.bracket({ className: `${pos} ${t.controlBorder}` })} />
      ))}
    </View>
  );
}
