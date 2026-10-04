import { Canvas, Group, Image, LinearGradient, Path, Skia, useImage, vec } from 'react-native-skia';
import { useMemo } from 'react';
import { View, Text } from './tw';
import { useLayoutSize } from './use-layout-size';
import { initialsOf } from './surface-look';
import { ROUND_RADIUS } from './neon/corner-cut';
import { AVATAR_PX, avatarCut, avatarGradientStops, avatarLook } from './avatar-look';
import { BracketAvatar, avatarTile } from './Avatar.shared';
import type { AvatarProps } from './Avatar.types';

/**
 * Native: one Skia canvas draws the tile. The gradient fills the cut polygon
 * (or a rounded rect when `rounded`), and a photo draws inside a Group
 * clipped to the same path, so photo and initials tiles share the shape.
 * Initials are a Text on top, centred well clear of the cut corner.
 */
export function Avatar(props: AvatarProps) {
  if (avatarLook(props.variant) === 'bracket') return <BracketAvatar {...props} />;
  return <CutAvatar {...props} />;
}

function CutAvatar({ name, imageUri, size = 'md', className, gradient, rounded = false }: AvatarProps) {
  const px = AVATAR_PX[size];
  const { size: box, onLayout } = useLayoutSize({ width: px, height: px });
  const { width, height } = box;
  const stops = avatarGradientStops(gradient);
  const photo = useImage(imageUri ?? null);
  const s = avatarTile({ size });

  const shape = useMemo(() => {
    if (rounded) {
      return Skia.PathBuilder.Make().addRRect(Skia.RRectXY(Skia.XYWHRect(0, 0, width, height), ROUND_RADIUS, ROUND_RADIUS)).build();
    }
    const c = avatarCut(width, height);
    return Skia.PathBuilder.Make()
      .moveTo(0, 0)
      .lineTo(width, 0)
      .lineTo(width, height - c)
      .lineTo(width - c, height)
      .lineTo(0, height)
      .close()
      .build();
  }, [width, height, rounded]);

  return (
    <View role="img" aria-label={name} className={s.root({ className })} onLayout={onLayout}>
      {/* Skia surface: Canvas takes a style, not a className. Sized to the measured tile. Decorative. */}
      <Canvas aria-hidden style={{ position: 'absolute', left: 0, top: 0, width, height, pointerEvents: 'none' }}>
        <Path path={shape}>
          <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={stops} />
        </Path>
        {photo ? (
          <Group clip={shape}>
            <Image image={photo} x={0} y={0} width={width} height={height} fit="cover" />
          </Group>
        ) : null}
      </Canvas>
      {imageUri ? null : (
        <View className={s.face()}>
          <Text aria-hidden className={s.initials({ className: 'text-ink-950' })}>{initialsOf(name)}</Text>
        </View>
      )}
    </View>
  );
}
