import { record, safeRoute } from './core.ts';

export type SiteBlock = Record<string, unknown> & { blockType: string; id?: string };
export interface SiteSection {
  sectionKey: string;
  label: string;
  hidden: boolean;
  copy: { key: string; label: string; value: string }[];
  content: SiteBlock[];
}
export interface SitePage {
  id: string | number;
  title: string;
  route: string;
  seo: { title?: string; description?: string };
  sections: SiteSection[];
}

/** Keep untrusted REST data out of the rendering and layout contracts. */
export function parseSitePage(value: unknown): SitePage | null {
  if (!record(value) || value._status !== 'published' ||
      (typeof value.id !== 'string' && typeof value.id !== 'number') ||
      typeof value.title !== 'string' || !safeRoute(value.route) || !Array.isArray(value.sections)) return null;
  const keys = new Set<string>();
  const sections: SiteSection[] = [];
  for (const item of value.sections.slice(0, 40)) {
    if (!record(item) || typeof item.sectionKey !== 'string' ||
        !/^[a-z][a-z0-9-]{0,63}$/.test(item.sectionKey) || keys.has(item.sectionKey)) return null;
    keys.add(item.sectionKey);
    sections.push({
      sectionKey: item.sectionKey, label: typeof item.label === 'string' ? item.label : item.sectionKey,
      hidden: item.hidden === true,
      copy: Array.isArray(item.copy) ? item.copy.slice(0, 100).flatMap((row) =>
        record(row) && typeof row.key === 'string' && typeof row.value === 'string'
          ? [{ key: row.key, label: typeof row.label === 'string' ? row.label : row.key, value: row.value.slice(0, 20000) }]
          : []) : [],
      content: Array.isArray(item.content) ? item.content.slice(0, 40).filter((block): block is SiteBlock =>
        record(block) && typeof block.blockType === 'string' && ['text', 'image', 'gallery', 'youtube', 'iframe'].includes(block.blockType)) : [],
    });
  }
  const seo = record(value.seo) ? value.seo : {};
  return { id: value.id, title: value.title, route: safeRoute(value.route)!, sections,
    seo: { title: typeof seo.title === 'string' ? seo.title : undefined, description: typeof seo.description === 'string' ? seo.description : undefined } };
}

export function sectionFor(page: SitePage | null | undefined, key: string): SiteSection | undefined {
  return page?.sections.find((section) => section.sectionKey === key);
}
export function sectionText(section: SiteSection | undefined, key: string, fallback: string): string {
  return section?.copy.find((row) => row.key === key)?.value ?? fallback;
}
export function orderedSectionKeys(page: SitePage | null | undefined, fallback: readonly string[]): string[] {
  const edited = page?.sections.map((section) => section.sectionKey) ?? [];
  // A partial record which edits only World must not accidentally move World above Hero.
  if (!fallback.every((key) => edited.includes(key))) return [...fallback, ...edited.filter((key) => !fallback.includes(key))];
  return edited;
}

/** Anonymous, published-only REST reader; never imports Payload's server config. */
export async function readSitePage(baseURL: string, route: string, request: typeof fetch = fetch): Promise<SitePage | null> {
  const path = safeRoute(route);
  if (!path) throw new Error('Invalid website path');
  const base = new URL(baseURL);
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) throw new Error('CMS origin must use HTTPS');
  if (base.username || base.password || base.search || base.hash) throw new Error('Invalid CMS API base');
  const url = new URL(`${base.href.replace(/\/$/, '')}/site-pages`);
  url.search = new URLSearchParams({ 'where[route][equals]': path, 'where[_status][equals]': 'published', draft: 'false', depth: '1', limit: '1' }).toString();
  const response = await request(url, { headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Website CMS returned ${response.status}`);
  const result: unknown = await response.json();
  if (!record(result) || !Array.isArray(result.docs)) throw new Error('Invalid website CMS response');
  if (!result.docs.length) return null;
  const page = parseSitePage(result.docs[0]);
  if (!page || page.route !== path) throw new Error('Invalid published website page');
  return page;
}

export interface SiteImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
  focalPoint: { x: number; y: number };
}
export function blockImage(block: unknown): SiteImage | null {
  if (!record(block) || !record(block.image)) return null;
  const media = block.image;
  if (typeof media.mimeType !== 'string' || !['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(media.mimeType)) return null;
  const source = typeof media.url === 'string' ? media.url : media.bunnyUrl;
  if (typeof source !== 'string') return null;
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    // Some upload pipelines do not extract dimensions. The slot still supplies a stable frame; inline images use a 3:2 layout fallback.
    const dimension = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
    const alt = block.decorative === true ? '' : typeof block.alt === 'string' && block.alt.trim() ? block.alt : typeof media.alt === 'string' ? media.alt : '';
    if (!alt && block.decorative !== true) return null;
    const point = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
    return { src: url.href, alt, width: dimension(media.width, 1200), height: dimension(media.height, 800),
      caption: typeof block.caption === 'string' && block.caption ? block.caption : undefined,
      focalPoint: { x: point(block.focalX), y: point(block.focalY) } };
  } catch { return null; }
}
export * from './core.ts';
