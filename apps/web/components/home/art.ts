/**
 * The W01 art map (prompt pack 02 §5). Every image slot on the home page
 * reads through `art(slot)`; the slot name is the contract final art replaces.
 *
 * Until NYC-MON key art, Baby Mon renders, egg art and H-Lynk product
 * photography exist, each slot holds a bundled, licensed NYC photograph from
 * `@acme/assets/photos` (1200x800 WebP with a blurDataURL; never hotlinked).
 * `hlynk.static` and `care` are not rendered yet: they reserve the slots the
 * Phase 4 product stage fallback and Phase 5 care art fill.
 */
import { breakpoints, contentWidths } from '@acme/theme';
import type { StarterBloodline } from '@acme/content';
import { NYC_PHOTOS, type NycPhoto, type PhotoDistrict, type PhotoSource } from '@acme/assets/photos';

/** A starter's slot number from @acme/content (DECISIONS.md #1). */
export type StarterId = StarterBloodline['slot'];

export type ArtSlot =
  | 'hero'
  | 'world.primary'
  | 'world.secondary'
  | 'world.detail'
  | 'hlynk.static'
  | `starter.${StarterId}`
  | 'care'
  | 'hatch';

/** Decorative art renders with `alt=""`; the reason is required so the choice is reviewed. */
export interface ArtDecorative {
  reason: string;
}

/** A point in the frame to keep in view when cropping, 0–1 from the top left. */
export interface ArtFocalPoint {
  x: number;
  y: number;
}

/** A caption the page currently prints with the art. */
export interface ArtCaption {
  title: string;
  place: string;
}

export interface ArtEntry {
  src: PhotoSource;
  width: number;
  height: number;
  alt: string;
  decorative?: ArtDecorative;
  focalPoint?: ArtFocalPoint;
  blurDataURL?: string;
  mobileSrc?: PhotoSource;
  sizes: string;
  district?: PhotoDistrict;
  caption?: ArtCaption;
}

const MD_UP = `(min-width: ${breakpoints.md})`;
const XL_UP = `(min-width: ${breakpoints.xl})`;
const sizes = (desktopVw: number) => `${MD_UP} ${desktopVw}vw, 92vw`;
/** Columns of the 12-column, 80rem-capped home grid: the true rendered width from `md`. */
const gridSizes = (cols: number) =>
  `${XL_UP} ${Math.round((80 * cols) / 12)}rem, ${MD_UP} ${Math.round((100 * cols) / 12)}vw, 100vw`;

function photoById(id: string): NycPhoto {
  const photo = NYC_PHOTOS.find((p) => p.id === id);
  if (!photo) throw new Error(`@acme/assets/photos has no bundled photo "${id}"`);
  return photo;
}

function fromPhoto(id: string, slotSizes: string): ArtEntry {
  const photo = photoById(id);
  return {
    src: photo.source,
    width: photo.width,
    height: photo.height,
    alt: photo.alt,
    blurDataURL: photo.blurDataURL,
    sizes: slotSizes,
    district: photo.district,
    caption: { title: photo.title, place: photo.place },
  };
}

const ART = {
  hero: { ...fromPhoto('midtown-chrysler-spire', `(min-width: ${breakpoints.lg}) ${contentWidths['content-hero-art']}, 100vw`), focalPoint: { x: 0.5, y: 0.3 } },
  'world.primary': { ...fromPhoto('harlem-lenox-rowhouses', gridSizes(7)), focalPoint: { x: 0.45, y: 0.55 } },
  'world.secondary': { ...fromPhoto('downtown-nyse', gridSizes(5)), focalPoint: { x: 0.5, y: 0.5 } },
  'world.detail': fromPhoto('harlem-apollo', gridSizes(4)),
  'hlynk.static': fromPhoto('downtown-nyse', sizes(40)),
  'starter.1': fromPhoto('harlem-brownstone-stoops', sizes(30)),
  'starter.2': fromPhoto('midtown-times-square', sizes(30)),
  'starter.3': fromPhoto('megacity-bridge-deck', sizes(30)),
  care: fromPhoto('harlem-brownstone-stoops', sizes(40)),
  hatch: fromPhoto('megacity-brooklyn-bridge-night', sizes(40)),
} as const satisfies Record<ArtSlot, ArtEntry>;

export const ART_SLOTS = Object.keys(ART) as readonly ArtSlot[];

/**
 * World frames in DOM (= mobile reading) order: the dominant frame, then the
 * supporting one. `world.detail` is reserved for the Mon-in-district art (PS-007).
 */
export const WORLD_SLOTS = ['world.primary', 'world.secondary'] as const satisfies readonly ArtSlot[];

/** The image's content position for a slot's focal point, so a crop keeps it in view. */
export function artPosition(entry: ArtEntry): { left: `${number}%`; top: `${number}%` } | undefined {
  const f = entry.focalPoint;
  return f ? { left: `${Math.round(f.x * 100)}%`, top: `${Math.round(f.y * 100)}%` } : undefined;
}

export function art(slot: ArtSlot): ArtEntry {
  return ART[slot];
}

export function starterSlot(id: StarterId): `starter.${StarterId}` {
  return `starter.${id}`;
}

/** A URL for `<link rel="preload">`: the bundler gives a string or StaticImageData. */
export function artHref(entry: ArtEntry): string {
  const { src } = entry;
  return typeof src === 'object' ? src.src : String(src);
}
