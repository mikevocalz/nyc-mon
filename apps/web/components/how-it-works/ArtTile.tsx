import { DISTRICT_TONE, Image, TONE_CLASSES, type ImageProps } from '@acme/ui';
import { Figcaption, Figure, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { ComingSoonArt } from '../home/ComingSoonArt';
import { W01_COPY } from '../home/copy';
import type { RouteArt } from './art';

/**
 * One art tile: a hard-edged frame that holds its aspect before the image
 * loads. `frame` sets the box (aspect, grid placement, border); the image
 * fills it. A photograph with a place gets the home page's signage caption
 * plate (district disc, then district and cross streets); creature art has
 * none, because a Mon is not a place. A null `art` is a Mon with no picture
 * yet: the frame keeps its size and shows the Coming Soon plate.
 */
export function ArtTile({
  art,
  frame,
  id,
  fit = 'cover',
  eager = false,
  caption = true,
  compact = false,
}: {
  art: RouteArt | null;
  frame: string;
  id?: string;
  fit?: 'cover' | 'contain';
  eager?: boolean;
  caption?: boolean;
  /** A small tile: the Coming Soon plate uses the smallest chip. */
  compact?: boolean;
}) {
  if (art === null) {
    return (
      <Figure id={id} className={`relative m-0 min-w-0 overflow-hidden bg-ink-900 ${frame}`}>
        <ComingSoonArt compact={compact} />
      </Figure>
    );
  }
  const place = caption && art.district && art.place ? art : null;
  return (
    <Figure id={id} className={`relative m-0 min-w-0 overflow-hidden bg-ink-900 ${frame}`}>
      <Image
        src={art.src as ImageProps['src']}
        alt={art.alt}
        fill
        framed={false}
        sizes={art.sizes}
        loading={eager ? 'eager' : 'lazy'}
        placeholder={art.blurDataURL ? 'blur' : undefined}
        blurDataURL={art.blurDataURL}
        contentPosition={art.position}
        {...({ contentFit: fit } as object)}
        className="h-full w-full"
      />
      {place?.district && place.place ? (
        <Figcaption className="absolute bottom-0 left-0 m-0 flex max-w-full flex-row items-center gap-2.5 bg-signage-black px-3 py-2">
          <View aria-hidden className={`h-3.5 w-3.5 shrink-0 rounded-full ${TONE_CLASSES[DISTRICT_TONE[place.district]].face}`} />
          <Text className="text-sm font-semibold text-signage-white">
            {W01_COPY.placeCaption(place.district, place.place.place)}
          </Text>
        </Figcaption>
      ) : null}
    </Figure>
  );
}
