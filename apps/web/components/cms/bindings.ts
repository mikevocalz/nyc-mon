import { sectionFor, type SitePage } from '@acme/content/site-content';
import { sectionImage } from '../home/cms';
import type { ArtEntry } from '../home/art';
export { copyTree, copyGroups, copyRows, sectionKey } from '@acme/content/site-content-bindings';

/**
 * The editor's image for a slot, else the shipped art. A null fallback is art
 * that does not exist yet (a Coming Soon Baby): an editor image fills it,
 * otherwise it stays null and the page draws Coming Soon.
 */
export function pageArt(page: SitePage | null | undefined, section: string, slot: string, fallback: ArtEntry, sizes?: string): ArtEntry;
export function pageArt(page: SitePage | null | undefined, section: string, slot: string, fallback: ArtEntry | null, sizes?: string): ArtEntry | null;
export function pageArt(page: SitePage | null | undefined, section: string, slot: string, fallback: ArtEntry | null, sizes = '100vw'): ArtEntry | null {
  return sectionImage(sectionFor(page, section), slot, fallback?.sizes ?? sizes) ?? fallback;
}
export function artMap<T extends Record<string, ArtEntry>>(defaults: T, page: SitePage | null | undefined, sections: Record<string, string> = {}): T {
  return Object.fromEntries(Object.entries(defaults).map(([slot, entry]) => [slot,
    pageArt(page, sections[slot] ?? slot, slot.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), entry)])) as T;
}
