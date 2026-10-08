/**
 * The W01 art map (prompt pack 02 §5). Every image slot on the home page
 * reads through `art(slot)`; the slot name is the contract final art replaces.
 *
 * The starter posters and the hatch band hold generated concept art from
 * `@acme/assets/creatures` (PS-028): the three Baby forms and the egg at
 * night. It stands in for final renders (PS-007) and carries no caption,
 * because a Mon is not a place. The other slots hold bundled, licensed NYC
 * photographs from `@acme/assets/photos` (1200x800 WebP with a blurDataURL;
 * never hotlinked). The `hlynk.*` slots are renders of the H-Lynk Core scene.
 * `care` is not rendered yet: it reserves the slot the Mon reaction art for
 * CARE fills.
 */
import { breakpoints, contentWidths } from '@acme/theme';
import type { StarterBloodline } from '@acme/content';
import { NYC_PHOTOS, type NycPhoto, type PhotoDistrict, type PhotoSource } from '@acme/assets/photos';
import { creatureArt } from '@acme/assets/creatures';

/** A starter's slot number from @acme/content (DECISIONS.md #1). */
export type StarterId = StarterBloodline['slot'];

export type ArtSlot =
  | 'hero'
  | 'world.primary'
  | 'world.secondary'
  | 'world.detail'
  | 'hlynk.static'
  | 'hlynk.scanner'
  | 'hlynk.controls'
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
  /** Cross streets; absent where canon gives no place (Mega City). */
  place?: string;
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
const LG_UP = `(min-width: ${breakpoints.lg})`;
const XL_UP = `(min-width: ${breakpoints.xl})`;
const sizes = (desktopVw: number) => `${MD_UP} ${desktopVw}vw, 92vw`;
/** Columns of the 12-column, 80rem-capped home grid: the true rendered width from `md`. */
const gridSizes = (cols: number) =>
  `${XL_UP} ${Math.round((80 * cols) / 12)}rem, ${MD_UP} ${Math.round((100 * cols) / 12)}vw, 100vw`;

/** Starter posters: a third of the 80rem grid from `lg`, half the row as a side-on poster from `md`. */
const starterSizes = `${LG_UP} 26rem, ${MD_UP} 50vw, 100vw`;

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

/** Generated creature art: no district and no caption, so `PlaceCaption` renders nothing. */
function fromCreature(id: string, slotSizes: string, focalPoint: ArtFocalPoint): ArtEntry {
  const a = creatureArt(id);
  return { src: a.source, width: a.width, height: a.height, alt: a.alt, blurDataURL: a.blurDataURL, sizes: slotSizes, focalPoint };
}

const ART = {
  hero: { ...fromPhoto('midtown-chrysler-spire', `(min-width: ${breakpoints.lg}) ${contentWidths['content-hero-art']}, 100vw`), focalPoint: { x: 0.5, y: 0.3 } },
  'world.primary': { ...fromPhoto('harlem-lenox-rowhouses', gridSizes(7)), focalPoint: { x: 0.45, y: 0.55 } },
  'world.secondary': { ...fromPhoto('downtown-nyse', gridSizes(5)), focalPoint: { x: 0.5, y: 0.5 } },
  'world.detail': fromPhoto('harlem-apollo', gridSizes(4)),
  // H-Lynk Core renders from device-scene.ts at its rest pose on ink-950 (PS-017; HANDOFF §H-LYNK
  // "Static capture"). The stage box is 4:5: 32rem wide from `xl`, 28rem from `lg`, 24rem from `md`.
  'hlynk.static': {
    src: '/home/h-lynk-core-v2.png',
    width: 896,
    height: 1120,
    alt: '',
    decorative: { reason: 'The stage figure is named "H-Lynk Core" and captioned; the capture repeats it.' },
    sizes: `${XL_UP} 32rem, ${LG_UP} 28rem, ${MD_UP} 24rem, 92vw`,
  },
  // Crops of the same render for the proof rows; each row's headline and line name the part shown.
  'hlynk.scanner': {
    src: '/home/h-lynk-scanner.png',
    width: 640,
    height: 480,
    alt: '',
    decorative: { reason: 'The proof row names the scanner head in its headline and line.' },
    sizes: `${LG_UP} 12rem, 9rem`,
  },
  'hlynk.controls': {
    src: '/home/h-lynk-controls.png',
    width: 640,
    height: 480,
    alt: '',
    decorative: { reason: 'The proof row names the control row in its headline and line.' },
    sizes: `${LG_UP} 12rem, 9rem`,
  },
  // Starter posters (PS-020, PS-028): each Baby form on a street of its Bloodline's home turf
  // (Hood Ratti: Harlem stoop; Bodega Baddiee Cee: 125th St bodega; Yote: Times Square). Focal
  // point is the Mon's face, so the 1:1 phone crop and the side-on crop keep it.
  'starter.1': fromCreature('squeaklet', starterSizes, { x: 0.5, y: 0.3 }),
  'starter.2': fromCreature('kittee-cee', starterSizes, { x: 0.5, y: 0.28 }),
  'starter.3': fromCreature('yotito', starterSizes, { x: 0.55, y: 0.33 }),
  // Reserved for the Mon reaction art (audit §11 CARE); not rendered until it exists (PS-021).
  care: fromPhoto('harlem-brownstone-stoops', sizes(40)),
  // The egg waiting at night (HANDOFF §HATCH, PS-028): an open case on a Harlem stoop, lit only by
  // the crack in the shell. Focal point on the egg, so the 4:5 phone crop keeps it; the dark left
  // half carries no detail.
  hatch: fromCreature('hatch-night', `${XL_UP} 80rem, 100vw`, { x: 0.7, y: 0.56 }),
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
