import { NYC_PHOTOS, type NycPhoto } from '../../../assets/photos';
import type { CardSliderImageItemData } from '../card-slider.types';

/** A bundled NYC photo as an image-slide record: landmark as title, street as subtitle. */
export function photoItem(photo: NycPhoto, extra: Partial<CardSliderImageItemData> = {}): CardSliderImageItemData {
  return {
    id: photo.id,
    image: { source: photo.source, alt: photo.alt, blurDataURL: photo.blurDataURL },
    title: photo.title,
    subtitle: photo.place,
    district: photo.district,
    ...extra,
  };
}

/** Every bundled photo as a slide, Downtown first through Mega City. */
export const CITY_PHOTO_ITEMS: readonly CardSliderImageItemData[] = NYC_PHOTOS.map((p) => photoItem(p));
