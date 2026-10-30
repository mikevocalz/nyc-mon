import { blockImage, type SiteSection } from '@acme/content/site-content';
import type { ArtEntry } from './art';

export type CmsSectionProps = { cms?: SiteSection };
export { sectionText } from '@acme/content/site-content';

/** A replacement never inherits the old photograph's caption, location, or blur thumbnail. */
export function sectionArt(section: SiteSection | undefined, slot: string, fallback: ArtEntry): ArtEntry {
  const block = section?.content.find((item) => item.blockType === 'image' && item.slot === slot);
  const image = blockImage(block);
  if (!image) return fallback;
  return { src: image.src, width: image.width, height: image.height, alt: image.alt,
    sizes: fallback.sizes, focalPoint: image.focalPoint,
    ...(image.alt === '' ? { decorative: { reason: 'Marked decorative by the website editor.' } } : {}),
    ...(image.caption ? { caption: { title: image.caption } } : {}) };
}
