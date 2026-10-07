/**
 * Temporary art direction for the W01 home page (premium-site pass).
 *
 * Every image slot on the page reads through this one file. Until final
 * NYC-MON key art, Baby Mon renders, egg art and H-Lynk product photography
 * exist, each slot maps to a bundled, licensed NYC photograph from
 * `@acme/assets/photos` (1200x800 WebP, blurDataURL included — no hotlinks).
 *
 * To swap in final art later: replace the entry here. Components read only
 * `NycPhoto` fields (`source`, `alt`, `title`, `place`, `blurDataURL`),
 * so no layout changes are needed.
 */
import { NYC_PHOTOS, type NycPhoto } from '@acme/assets/photos';

function photoById(id: string): NycPhoto {
  const photo = NYC_PHOTOS.find((p) => p.id === id);
  if (!photo) throw new Error(`@acme/assets/photos has no bundled photo "${id}"`);
  return photo;
}

/** Hero: the environmental frame beside the seal — deco crown, city scale. */
export const TEMP_HERO_ART: NycPhoto = photoById('midtown-chrysler-spire');

/**
 * World: four districts as places, not features. Harlem, Midtown, Downtown
 * and the Mega City edge — one dominant frame plus offset companions.
 */
export const TEMP_WORLD_ART: readonly NycPhoto[] = [
  photoById('midtown-empire-sunset'),
  photoById('harlem-apollo'),
  photoById('downtown-one-wtc'),
  photoById('harlem-lenox-rowhouses'),
];

/**
 * Starters: one environment per egg, slot order. Harlem streets for the
 * Hood Ratti line, Midtown for the Bodega Baddiee Cee line, the Mega City
 * bridge deck for the Yote line. Stands in for Baby Mon renders.
 */
export const TEMP_STARTER_ART: readonly NycPhoto[] = [
  photoById('harlem-brownstone-stoops'),
  photoById('midtown-times-square'),
  photoById('megacity-bridge-deck'),
];

/** Hatch: the darkest bundled frame — the bridge lit at night. */
export const TEMP_HATCH_ART: NycPhoto = photoById('megacity-brooklyn-bridge-night');
