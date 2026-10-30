import { blockImage, type SiteSection } from '@acme/content/site-content';
import type { ArtEntry } from '../home/art';
import type { RouteArt } from '../how-it-works/art';

export function placement(section: SiteSection | undefined, slot: string) {
  return blockImage(section?.content.find((block) => block.blockType === 'image' && block.slot === slot));
}
export function placedArt(section: SiteSection | undefined, slot: string, fallback: ArtEntry): ArtEntry {
  const image = placement(section, slot);
  if (!image) return fallback;
  // Never retain a previous image's blur, place label, or district when replacing it.
  return { src: image.src, alt: image.alt, width: image.width, height: image.height, sizes: fallback.sizes, focalPoint: image.focalPoint,
    ...(image.caption ? { caption: { title: image.caption } } : {}) };
}
export function placedRouteArt(section: SiteSection | undefined, slot: string, fallback: RouteArt): RouteArt {
  const image = placement(section, slot);
  if (!image) return fallback;
  return { src: image.src, alt: image.alt, width: image.width, height: image.height, sizes: fallback.sizes,
    position: { left: `${image.focalPoint.x * 100}%`, top: `${image.focalPoint.y * 100}%` }, editorialCaption: image.caption };
}
