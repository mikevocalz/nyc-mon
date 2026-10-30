import { DISTRICT_TONE, Image, TONE_CLASSES, type ImageProps } from '@acme/ui';
import { Figcaption, Figure, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { W01_COPY } from '../home/copy';
import type { RouteArt } from './art';

/**
 * One art tile: a hard-edged frame that holds its aspect before the image
 * loads. `frame` sets the box (aspect, grid placement, border); the image
 * fills it. A photograph with a place gets the home page's signage caption
 * plate (district disc, then district and cross streets); creature art has
 * none, because a Mon is not a place.
 */
export function ArtTile({
  art,
  frame,
  id,
  fit = 'cover',
  eager = false,
  caption = true,
}: {
  art: RouteArt;
  frame: string;
  id?: string;
  fit?: 'cover' | 'contain';
  eager?: boolean;
  caption?: boolean;
}) {
  const place = caption && art.place ? art : null;
  return (
    <Figure id={id} className={`relative m-0 min-w-0 overflow-hidden bg-ink-900 ${frame}`}>
      <Image
        src={art.src as ImageProps['src']}
        alt={art.alt}
        fill
        framed={false}
        sizes={art.sizes}
        unoptimized={typeof art.src === 'string' && art.src.startsWith('https://')}
        loading={eager ? 'eager' : 'lazy'}
        placeholder={art.blurDataURL ? 'blur' : undefined}
        blurDataURL={art.blurDataURL}
        contentPosition={art.position}
        {...({ contentFit: fit } as object)}
        className="h-full w-full"
      />
      {place?.place ? (
        <Figcaption className="absolute bottom-0 left-0 m-0 flex max-w-full flex-row items-center gap-2.5 bg-signage-black px-3 py-2">
          {place.district ? <View aria-hidden className={`h-3.5 w-3.5 shrink-0 rounded-full ${TONE_CLASSES[DISTRICT_TONE[place.district]].face}`} /> : null}
          <Text className="text-sm font-semibold text-signage-white">
            {place.district ? W01_COPY.placeCaption(place.district, place.place.place) : place.place.title}
          </Text>
        </Figcaption>
      ) : null}
    </Figure>
  );
}
