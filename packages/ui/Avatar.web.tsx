import { SolitoImage } from 'solito/image';
import { View, Text } from './tw';
import { initialsOf } from './surface-look';
import { AVATAR_CLIP_PATH, avatarGradientStops, avatarLook } from './avatar-look';
import { BracketAvatar, avatarTile } from './Avatar.shared';
import type { AvatarProps } from './Avatar.types';

/**
 * The NYC-MON avatar. Default look is NeonBlade's data-table user tile: a
 * square filled corner to corner with the gradient, the bottom-right corner
 * cut at 45 degrees, initials in night ink in the display face. A photo takes
 * the same cut. No border and no rounding unless `rounded` asks for it, which
 * swaps the cut for rounded-soft corners.
 *
 * Web: the cut is a percentage clip-path, so a caller's size class
 * (`md:h-11 md:w-11`) keeps its proportion.
 */
export function Avatar(props: AvatarProps) {
  if (avatarLook(props.variant) === 'bracket') return <BracketAvatar {...props} />;
  const { name, imageUri, size = 'md', className, gradient, rounded = false } = props;
  const stops = avatarGradientStops(gradient);
  const s = avatarTile({ size });
  return (
    <View
      role="img"
      aria-label={name}
      className={s.root({ className: `${rounded ? 'rounded-soft' : ''} ${className ?? ''}` })}
      // Computed: gradient colours from the prop; clip polygon from the cut ratio.
      style={{ backgroundImage: `linear-gradient(to bottom right, ${stops.join(', ')})`, clipPath: rounded ? undefined : AVATAR_CLIP_PATH } as object}
    >
      <View className={s.face()}>
        {imageUri ? (
          <SolitoImage src={imageUri} alt="" fill unoptimized contentFit="cover" sizes="96px" />
        ) : (
          // Night ink holds 4.5:1 across every preset (avatar-look.test.ts).
          <Text aria-hidden className={s.initials({ className: 'text-ink-950' })}>{initialsOf(name)}</Text>
        )}
      </View>
    </View>
  );
}
