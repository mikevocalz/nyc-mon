import { sectionFor, type SitePage } from '@acme/content/site-content';
import { sectionArt } from '../home/cms';
import { artPosition } from '../home/art';
import type { RouteArt } from '../how-it-works/art';
/** Adapt the existing art contract, retaining no stale caption or blur after replacement. */
export function routeArt(page: SitePage | null | undefined, section: string, slot: string, original: RouteArt): RouteArt {
 const replacement = sectionArt(sectionFor(page, section), slot, {...original, caption: original.place});
 if (replacement.src === original.src) return original;
 return {src: replacement.src, width: replacement.width, height: replacement.height, alt: replacement.alt,
 sizes: original.sizes, position: artPosition(replacement), place: replacement.caption};
}
