import { record, safeRoute, sectionKeysAreUnique } from './core.ts';
export interface SeedCopy { key: string; label: string; value: string }
export interface SeedSection { sectionKey: string; label: string; hidden: boolean; copy: SeedCopy[]; content: Record<string, unknown>[] }
export interface SeedAsset { sectionKey: string; slot: string; source: string; alt: string; decorative: boolean; width: number; height: number; focalX: number; focalY: number; caption: string }
export interface SeedPage { page: { title: string; route: string; _status: 'draft'; seo: { title: string; description: string }; sections: SeedSection[] }; assets: SeedAsset[] }
export function validateWebsiteSeed(manifest: unknown, sourceOrigin: string, allowLocal = false): SeedPage[] {
  const origin = new URL(sourceOrigin);
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || (origin.protocol !== 'https:' && !(allowLocal && origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname)))) throw new Error('The source must be one explicit HTTPS origin');
  if (!record(manifest) || manifest.schemaVersion !== 2 || !Array.isArray(manifest.pages) || !manifest.pages.length || manifest.pages.length > 100) throw new Error('Invalid website seed manifest');
  const routes = new Set<string>();
  const finite = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const string = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
  for (const entry of manifest.pages) {
    if (!record(entry) || !record(entry.page) || entry.page._status !== 'draft' || (!safeRoute(entry.page.route) || safeRoute(entry.page.route) !== entry.page.route) || routes.has(String(entry.page.route)) || !string(entry.page.title, 160) || !entry.page.title || !sectionKeysAreUnique(entry.page.sections) || !Array.isArray(entry.page.sections) || !entry.page.sections.length || entry.page.sections.length > 40 || !Array.isArray(entry.assets) || entry.assets.length > 200) throw new Error('Invalid or duplicate seed page');
    if (!record(entry.page.seo) || !string(entry.page.seo.title, 200) || !string(entry.page.seo.description, 500)) throw new Error('Invalid SEO copy');
    routes.add(String(entry.page.route));
    for (const section of entry.page.sections) {
      if (!record(section) || !string(section.label, 160) || !Array.isArray(section.copy) || section.copy.length > 100 || !Array.isArray(section.content) || section.content.length) throw new Error('Seed sections must contain labeled copy and no existing media or executable blocks');
      const keys = new Set<string>();
      for (const row of section.copy) {
        if (!record(row) || !string(row.key, 100) || !/^[a-zA-Z][a-zA-Z0-9.-]{0,99}$/.test(row.key) || keys.has(row.key) || !string(row.label, 160) || !string(row.value, 20000)) throw new Error('Invalid or duplicate copy field');
        keys.add(row.key);
      }
    }
    const placements = new Set<string>();
    for (const asset of entry.assets) {
      if (!record(asset) || !string(asset.source, 4096) || !string(asset.slot, 100) || !/^[a-z][a-z0-9.-]{0,99}$/.test(asset.slot) || !string(asset.sectionKey, 64) || !string(asset.alt, 500) || !string(asset.caption, 500) || !finite(asset.width, 1, 30000) || !finite(asset.height, 1, 30000) || !finite(asset.focalX, 0, 1) || !finite(asset.focalY, 0, 1)) throw new Error('Invalid image placement');
      const url = new URL(asset.source);
      if (url.origin !== origin.origin || url.username || url.password || url.hash || !/^\/(?:_next\/static\/media\/|home\/)/.test(url.pathname) || /%2f|%5c|%2e/i.test(url.pathname)) throw new Error('Asset source must be a shipped file on the approved origin');
      if (!entry.page.sections.some((section) => record(section) && section.sectionKey === asset.sectionKey)) throw new Error('Unknown image section');
      const key = `${asset.sectionKey}:${asset.slot}`;
      if (placements.has(key)) throw new Error('Duplicate image slot');
      placements.add(key);
    }
  }
  return structuredClone(manifest.pages) as SeedPage[];
}
