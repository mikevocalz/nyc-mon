import { sectionFor, type SitePage } from '@acme/content/site-content';
import { sectionArt } from '../home/cms';
import type { ArtEntry } from '../home/art';
export { copyTree, copyGroups, copyRows, sectionKey } from '@acme/content/site-content-bindings';
export function pageArt(page: SitePage | null | undefined, section: string, slot: string, fallback: ArtEntry): ArtEntry {
  return sectionArt(sectionFor(page, section), slot, fallback);
}
export function artMap<T extends Record<string, ArtEntry>>(defaults: T, page: SitePage | null | undefined, sections: Record<string, string> = {}): T {
  return Object.fromEntries(Object.entries(defaults).map(([slot, entry]) => [slot,
    pageArt(page, sections[slot] ?? slot, slot.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), entry)])) as T;
}
