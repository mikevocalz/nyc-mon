/**
 * The /mons art map (W02). Every picture on the roster and the Mon pages
 * reads through `monsArt(slug)`, so final renders replace concept art in one
 * place.
 *
 * - `baby` is the home page's starter plate (`starterArt(N)` in ../home/art.ts):
 *   the same concept art, the same focal point. Null where the Baby has no art
 *   yet (slot 4, Fye Dot): the pages draw Coming Soon in its place.
 * - `egg` is the concept art of the egg the Baby hatches from
 *   (`@acme/assets/creatures`, PS-028).
 * - `street` is a bundled NYC photograph of the street the Baby's concept art
 *   is set on (art.ts: Harlem stoop, the 125th St bodega, Times Square). It is
 *   art direction, not canon: the page captions it with its place only and
 *   never calls it the Mon's home. Null where no street was art-directed
 *   (slot 4): the pages leave the tile out.
 *
 * The tone is the starter slot's kit tone, in the order the W02 cards have
 * always used (orange, royal, leaf), then apple for LanternFye's scarlet line.
 */
import { breakpoints } from '@acme/theme';
import { creatureArt } from '@acme/assets/creatures';
import type { ControlTone, District } from '@acme/ui';
import { art, starterArt, type ArtEntry, type StarterId } from '../home/art';
import { NYC_PHOTOS } from '@acme/assets/photos';

const MD_UP = `(min-width: ${breakpoints.md})`;
const LG_UP = `(min-width: ${breakpoints.lg})`;

export interface MonsArt {
  tone: ControlTone;
  /** Null until the Baby's art exists (Coming Soon). */
  baby: ArtEntry | null;
  egg: ArtEntry;
  /** Null where no street photo was art-directed for this starter. */
  street: ArtEntry | null;
  /** The skyline drawn behind this Mon's page: the district of the street photo, midtown without one. */
  district: District;
}

interface SlotArt {
  tone: ControlTone;
  egg: { id: string; focal: { x: number; y: number } };
  street: { id: string; focal: { x: number; y: number } } | null;
}

const SLOT_ART: Record<StarterId, SlotArt> = {
  1: { tone: 'orange', egg: { id: 'metro-egg', focal: { x: 0.5, y: 0.55 } }, street: { id: 'harlem-brownstone-stoops', focal: { x: 0.5, y: 0.6 } } },
  2: { tone: 'royal', egg: { id: 'corner-egg', focal: { x: 0.5, y: 0.55 } }, street: { id: 'harlem-apollo', focal: { x: 0.5, y: 0.45 } } },
  3: { tone: 'leaf', egg: { id: 'prism-egg', focal: { x: 0.5, y: 0.55 } }, street: { id: 'midtown-times-square', focal: { x: 0.5, y: 0.5 } } },
  // The Signal Egg is creator reference art on white, with no street behind it, and no street was art-directed.
  4: { tone: 'apple', egg: { id: 'signal-egg', focal: { x: 0.5, y: 0.55 } }, street: null },
};

/** Egg tiles: a third of the 80rem grid at most, half the row on tablets, the full column on phones. */
const EGG_SIZES = `${LG_UP} 26rem, ${MD_UP} 45vw, 100vw`;
/** Street tiles: up to seven twelfths of the grid. */
const STREET_SIZES = `${LG_UP} 46rem, ${MD_UP} 60vw, 100vw`;
/** Portraits: the hero and roster plates run to seven twelfths of the grid. */
const PORTRAIT_SIZES = `${LG_UP} 44rem, ${MD_UP} 70vw, 100vw`;

function eggEntry(id: string, focalPoint: { x: number; y: number }): ArtEntry {
  const a = creatureArt(id);
  return { src: a.source, width: a.width, height: a.height, alt: a.alt, blurDataURL: a.blurDataURL, sizes: EGG_SIZES, focalPoint };
}

function photoEntry(id: string, sizes: string, focalPoint: { x: number; y: number }): ArtEntry {
  const photo = NYC_PHOTOS.find((p) => p.id === id);
  if (!photo) throw new Error(`@acme/assets/photos has no bundled photo "${id}"`);
  return {
    src: photo.source,
    width: photo.width,
    height: photo.height,
    alt: photo.alt,
    blurDataURL: photo.blurDataURL,
    sizes,
    focalPoint,
    district: photo.district,
    caption: { title: photo.title, place: photo.place },
  };
}

export function monsArt(slot: StarterId): MonsArt {
  const s = SLOT_ART[slot];
  const street = s.street === null ? null : photoEntry(s.street.id, STREET_SIZES, s.street.focal);
  const baby = starterArt(slot);
  return {
    tone: s.tone,
    baby: baby === null ? null : { ...baby, sizes: PORTRAIT_SIZES },
    egg: eggEntry(s.egg.id, s.egg.focal),
    street,
    district: street?.district ?? 'midtown',
  };
}

/** The hatch night scene, reused from the home page's hatch band. */
export function hatchArt(sizes: string): ArtEntry {
  return { ...art('hatch'), sizes };
}
