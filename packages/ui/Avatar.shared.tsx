import { tv } from 'tailwind-variants';
import { SolitoImage } from 'solito/image';
import { View, Text } from './tw';
import { TONE_CLASSES, resolveControlTone } from './district';
import { initialsOf } from './surface-look';
import type { AvatarProps } from './Avatar.types';

/** Size steps shared by both looks. Initials sit at about a third of the side. */
export const avatarTile = tv({
  slots: {
    root: 'relative overflow-hidden',
    face: 'absolute inset-0 items-center justify-center',
    initials: 'font-display font-bold uppercase leading-none',
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

/**
 * The opt-in `bracket` look: a square night tile in an ink keyline with the
 * DataTable's cornice brackets in the district tone, initials in the tone's
 * text step. Plain views, so one file serves web and native.
 */
export function BracketAvatar({ name, imageUri, size = 'md', className, district, tone, rounded = false }: AvatarProps) {
  const t = TONE_CLASSES[resolveControlTone(tone, district)];
  const s = avatarTile({ size });
  const corners = size === 'lg' || size === 'xl' ? CORNERS.thick : CORNERS.thin;
  return (
    <View role="img" aria-label={name} className={s.root({ className: `border-2 border-ink-800 bg-ink-900 ${rounded ? 'rounded-soft' : ''} ${className ?? ''}` })}>
      <View className={s.face()}>
        {imageUri ? (
          <SolitoImage src={imageUri} alt="" fill unoptimized contentFit="cover" sizes="96px" />
        ) : (
          // Tone text steps hold 4.5:1 on night (district.test.ts checks them).
          <Text aria-hidden className={s.initials({ className: `font-normal normal-case ${t.text}` })}>{initialsOf(name)}</Text>
        )}
      </View>
      {corners.map((pos) => (
        <View key={pos} aria-hidden pointerEvents="none" className={s.bracket({ className: `${pos} ${t.controlBorder}` })} />
      ))}
    </View>
  );
}
