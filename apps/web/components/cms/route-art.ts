import { sectionFor, type SitePage } from '@acme/content/site-content';
import { sectionImage } from '../home/cms';
import { artPosition } from '../home/art';
import type { RouteArt } from '../how-it-works/art';

/**
 * Adapt the existing art contract, retaining no stale caption or blur after
 * replacement. A null original (a Baby with no art yet) stays null unless the
 * editor placed an image in the slot.
 */
export function routeArt(page: SitePage | null | undefined, section: string, slot: string, original: RouteArt, sizes?: string): RouteArt;
export function routeArt(page: SitePage | null | undefined, section: string, slot: string, original: RouteArt | null, sizes?: string): RouteArt | null;
export function routeArt(page: SitePage | null | undefined, section: string, slot: string, original: RouteArt | null, sizes = '100vw'): RouteArt | null {
  const replacement = sectionImage(sectionFor(page, section), slot, original?.sizes ?? sizes);
  if (!replacement) return original;
  return {src: replacement.src, width: replacement.width, height: replacement.height, alt: replacement.alt,
    sizes: replacement.sizes, position: artPosition(replacement), place: replacement.caption};
}
