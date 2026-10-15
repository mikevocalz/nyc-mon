import { NYC_PHOTOS, type PhotoDistrict, type PhotoSource } from '@acme/assets/photos';

/** Real setting references only. Mega City deliberately receives no new location. */
export const CITY_PHOTO_IDS = {
  downtown: 'downtown-one-wtc',
  midtown: 'midtown-chrysler-spire',
  harlem: 'harlem-lenox-rowhouses',
} as const;
export type CityPhotoDistrict = keyof typeof CITY_PHOTO_IDS;
export const CITY_PHOTO_DISTRICTS = Object.keys(CITY_PHOTO_IDS) as CityPhotoDistrict[];

export function cityPhoto(district: PhotoDistrict) {
  if (district === 'megacity') return null;
  const photo = NYC_PHOTOS.find((entry) => entry.id === CITY_PHOTO_IDS[district]);
  if (!photo) throw new Error(`Missing bundled City reference: ${district}`);
  return {
    ...photo,
    sizes: district === 'downtown'
      ? '(min-width: 80rem) 44rem, (min-width: 48rem) 58vw, 100vw'
      : '(min-width: 80rem) 32rem, (min-width: 48rem) 42vw, 100vw',
    position: district === 'midtown' ? 'top' as const : 'center' as const,
  };
}

/** Next emits StaticImageData; this web-only route never accepts Metro asset IDs. */
export function cityPhotoHref(source: PhotoSource): string {
  if (typeof source === 'string') return source;
  if (typeof source === 'object') return source.src;
  throw new Error('The City web route requires a web image source.');
}
