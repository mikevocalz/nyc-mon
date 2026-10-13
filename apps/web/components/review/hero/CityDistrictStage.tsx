'use client';
/**
 * Direction C's client island: the district picker and the photograph it
 * swaps. Returned as a fragment so the two pieces sit in the server grid as
 * separate cells. State is a component-local Zustand store (repo rule: no
 * useState), not the site-wide district store, so trying districts here never
 * changes the district the live site remembers.
 *
 * Only the picked district's photograph is in the DOM, so one image loads at
 * a time; the first is eager because it is the direction's LCP candidate.
 */
import { NYC_PHOTOS, type NycPhoto } from '@acme/assets/photos';
import { DISTRICT_COPY, DISTRICTS } from '@acme/spatial/copy';
import { DISTRICT_TONE, Image, SegmentedControl, TONE_CLASSES, useInstanceStore, useStore, type District, type ImageProps } from '@acme/ui';
import { Figcaption, Figure, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import type { ReactNode } from 'react';
import { CITY_COPY } from './copy';

/** One daylit photograph per district where one exists; canon gives Mega City only night photos. */
const DISTRICT_PHOTO: Record<District, string> = {
  harlem: 'harlem-lenox-rowhouses',
  midtown: 'midtown-chrysler-spire',
  downtown: 'downtown-one-wtc',
  megacity: 'megacity-brooklyn-bridge-night',
};

function photoFor(district: District): NycPhoto {
  const photo = NYC_PHOTOS.find((p) => p.id === DISTRICT_PHOTO[district]);
  if (!photo) throw new Error(`@acme/assets/photos has no photo for ${district}`);
  return photo;
}

/** Route order of the signage board, Harlem first (PS-014). */
const ROUTE_ORDER: readonly District[] = ['harlem', 'midtown', 'downtown', 'megacity'];
const OPTIONS = ROUTE_ORDER.filter((d) => DISTRICTS.includes(d)).map((value) => ({ value, label: DISTRICT_COPY[value].name }));
const LABEL_ID = 'review-c-district-label';

/**
 * `cta` is server HTML passed through, placed between the picker and the
 * photograph so the CTA stays in the first view on a phone.
 */
export function CityDistrictStage({
  pickerClassName,
  figureClassName,
  cta,
}: {
  pickerClassName: string;
  figureClassName: string;
  cta: ReactNode;
}) {
  const store = useInstanceStore(() => ({ district: 'harlem' as District, picked: false }));
  const district = useStore(store, (s) => s.district);
  const picked = useStore(store, (s) => s.picked);
  const photo = photoFor(district);
  const tone = TONE_CLASSES[DISTRICT_TONE[district]];
  const copy = DISTRICT_COPY[district];

  return (
    <>
      <View testID="review-c-district" className={`gap-2 ${pickerClassName}`}>
        <Text {...({ id: LABEL_ID } as object)} className="text-sm font-semibold text-signage-black">
          {CITY_COPY.pickerLabel}
        </Text>
        <SegmentedControl
          options={OPTIONS}
          value={district}
          onChange={(next) => store.setState({ district: next, picked: true })}
          district={district}
          className="w-full"
          segmentClassName="basis-[45%] md:min-h-14"
          aria-labelledby={LABEL_ID}
        />
      </View>

      {cta}

      <Figure className={`relative m-0 min-w-0 ${figureClassName}`}>
        <View className="relative w-full">
          <Image
            key={photo.id}
            src={photo.source as ImageProps['src']}
            alt={photo.alt}
            fill
            priority={!picked}
            loading={picked ? 'lazy' : 'eager'}
            sizes="(min-width: 1024px) 44rem, 92vw"
            placeholder="blur"
            blurDataURL={photo.blurDataURL}
            district={district}
            className="aspect-[16/10] w-full"
          />
          {/* The picked district as a station plate on the photo's corner: disc, name, then the real cross streets. */}
          <View className="absolute left-0 top-0 z-10 max-w-[90%] flex-row items-center gap-2.5 bg-signage-black px-3 py-2">
            <View aria-hidden className={`h-3.5 w-3.5 shrink-0 rounded-full ${tone.face}`} />
            <Text className="font-display text-base uppercase text-signage-white md:text-lg">{copy.name}</Text>
          </View>
        </View>
        <Figcaption className="m-0 mt-3 flex flex-col gap-0.5 border-l-4 border-signage-black pl-3">
          <Text className="text-sm font-semibold text-signage-black md:text-base">{copy.line}</Text>
          <Text className="text-xs text-concrete-700 md:text-sm">{CITY_COPY.photoCaption(photo.title, photo.place)}</Text>
        </Figcaption>
      </Figure>
    </>
  );
}
