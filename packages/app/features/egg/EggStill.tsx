'use client';

import { Badge, Image, type ImageProps } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { CREATURE_ART } from '../../../assets/creatures';

/**
 * A starter egg's still from `CREATURE_ART` (`kind === 'egg'`, matched on
 * `dexId`), filling its parent. `decorative` drops the alt when a wrapper
 * already names the egg (M10's `m10.egg.a11y.label`). Missing art draws the
 * raised surface with a Coming Soon badge (the Alexa view's convention), so a
 * tile never collapses.
 */
export function EggStill({ dexId, decorative = false }: { dexId: number; decorative?: boolean }) {
  const art = CREATURE_ART.find((a) => a.kind === 'egg' && a.dexId === dexId);
  if (art === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-raised">
        <Badge label="Coming Soon" tone="neutral" />
      </View>
    );
  }
  return (
    <Image
      fill
      framed={false}
      src={art.source as ImageProps['src']}
      alt={decorative ? '' : art.alt}
      placeholder="blur"
      blurDataURL={art.blurDataURL}
      // The fill wrapper has no size of its own on native: without this it collapses to 0.
      className="h-full w-full"
    />
  );
}
