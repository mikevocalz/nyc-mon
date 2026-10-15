'use client';

import { Image, type ImageProps } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { CREATURE_ART } from '../../../assets/creatures';

/**
 * A starter egg's still from `CREATURE_ART` (`kind === 'egg'`, matched on
 * `dexId`), filling its parent. `decorative` drops the alt when a wrapper
 * already names the egg (M10's `m10.egg.a11y.label`). Missing art draws the
 * raised surface, so a tile never collapses.
 */
export function EggStill({ dexId, decorative = false }: { dexId: number; decorative?: boolean }) {
  const art = CREATURE_ART.find((a) => a.kind === 'egg' && a.dexId === dexId);
  if (art === undefined) return <View className="flex-1 bg-surface-raised" />;
  return (
    <Image
      fill
      framed={false}
      src={art.source as ImageProps['src']}
      alt={decorative ? '' : art.alt}
      placeholder="blur"
      blurDataURL={art.blurDataURL}
    />
  );
}
