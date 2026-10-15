/**
 * Shared, pure helpers for the editorial routes (/story, /city): how a
 * headline breaks across two signage plates, and the bundled NYC photographs
 * as art entries the home `PlaceCaption` can caption. No React here, so the
 * rules are unit-tested (editorial.test.ts).
 */
import { NYC_PHOTOS } from '@acme/assets/photos';
import type { ArtEntry, ArtFocalPoint } from '../home/art';

/**
 * Splits a headline into the two plates of the signage headline. A comma
 * wins (the break a reader already hears); otherwise the break that leaves
 * the two lines closest in length, the first never longer by more than a
 * word. One-word titles stay on one plate. Joining the lines with a space
 * always gives the title back, so the document text is the copy.
 */
export function splitTitle(title: string): readonly [string] | readonly [string, string] {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return [title];
  const comma = words.findIndex((w) => w.endsWith(','));
  if (comma >= 0 && comma < words.length - 1) {
    return [words.slice(0, comma + 1).join(' '), words.slice(comma + 1).join(' ')];
  }
  let best = 1;
  let bestDiff = Infinity;
  for (let k = 1; k < words.length; k += 1) {
    const diff = Math.abs(words.slice(0, k).join(' ').length - words.slice(k).join(' ').length);
    if (diff < bestDiff) {
      best = k;
      bestDiff = diff;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

/** Two-digit chapter label, "01" to "99": a numeral, never a word. */
export function chapterNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/**
 * A bundled NYC photograph as an art entry: alt text, blur placeholder and
 * the caption the home `PlaceCaption` prints (district, then cross streets;
 * Mega City has no streets on canon, so its caption is the district alone).
 */
export function placePhoto(id: string, sizes: string, focalPoint?: ArtFocalPoint): ArtEntry {
  const photo = NYC_PHOTOS.find((p) => p.id === id);
  if (!photo) throw new Error(`@acme/assets/photos has no bundled photo "${id}"`);
  return {
    src: photo.source,
    width: photo.width,
    height: photo.height,
    alt: photo.alt,
    blurDataURL: photo.blurDataURL,
    sizes,
    district: photo.district,
    caption: { title: photo.title, place: photo.place },
    ...(focalPoint ? { focalPoint } : {}),
  };
}
