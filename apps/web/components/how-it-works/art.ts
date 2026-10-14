/**
 * Art for the How it works route (W04) and the waitlist page (W05). Every
 * picture is an existing repo asset: the generated concept art in
 * `@acme/assets/creatures` (eggs, Baby forms, the hatch night; PS-028), the
 * bundled NYC photographs in `@acme/assets/photos`, and the H-Lynk Core
 * renders in `public/home`. Alt text comes from the asset packages; the
 * H-Lynk render's alt is the home page's stage caption. No form past Baby.
 */
import { breakpoints } from '@acme/theme';
import { creatureArt } from '@acme/assets/creatures';
import { NYC_PHOTOS, type PhotoDistrict, type PhotoSource } from '@acme/assets/photos';
import type { StarterId } from '../home/art';
import { W01_COPY } from '../home/copy';

export interface RouteArt {
  src: PhotoSource;
  width: number;
  height: number;
  alt: string;
  blurDataURL?: string;
  sizes: string;
  /** Content position for a crop, as CSS percentages. */
  position?: { left: `${number}%`; top: `${number}%` };
  district?: PhotoDistrict;
  /** The photograph's title and cross streets, for a place caption. */
  place?: { title: string; place?: string };
}

const MD_UP = `(min-width: ${breakpoints.md})`;
const LG_UP = `(min-width: ${breakpoints.lg})`;

const at = (x: number, y: number) => ({ left: `${x}%`, top: `${y}%` }) as const;

function creature(id: string, sizes: string, position?: RouteArt['position']): RouteArt {
  const a = creatureArt(id);
  return { src: a.source, width: a.width, height: a.height, alt: a.alt, blurDataURL: a.blurDataURL, sizes, position };
}

function photo(id: string, sizes: string, position?: RouteArt['position']): RouteArt {
  const p = NYC_PHOTOS.find((entry) => entry.id === id);
  if (!p) throw new Error(`@acme/assets/photos has no bundled photo "${id}"`);
  return {
    src: p.source,
    width: p.width,
    height: p.height,
    alt: p.alt,
    blurDataURL: p.blurDataURL,
    sizes,
    position,
    district: p.district,
    place: { title: p.title, place: p.place },
  };
}

/** The egg and Baby art per starter slot (the order of `starterBloodlines`). */
const EGG_ID: Record<StarterId, string> = { 1: 'metro-egg', 2: 'corner-egg', 3: 'prism-egg' };
const BABY_ID: Record<StarterId, string> = { 1: 'squeaklet', 2: 'kittee-cee', 3: 'yotito' };

/** An egg tile: a third of a route stop's art column. */
export const eggArt = (slot: StarterId, sizes = `${LG_UP} 14rem, ${MD_UP} 22vw, 30vw`) =>
  creature(EGG_ID[slot], sizes, at(50, 55));

/** A Baby form, face kept in view by the crop. */
export const babyArt = (slot: StarterId, sizes: string) => creature(BABY_ID[slot], sizes, at(50, 30));

/** The egg in its open case on a Harlem stoop at night. */
export const hatchNightArt = (sizes: string) => creature('hatch-night', sizes, at(70, 56));

/** The H-Lynk Core render at rest on ink (public/home, as on the home page's stage). */
export const hlynkArt = (sizes: string): RouteArt => ({
  src: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/home/h-lynk-core-v2.png`,
  width: 896,
  height: 1120,
  alt: W01_COPY.hlynk.caption,
  sizes,
});

export const photoArt = photo;
