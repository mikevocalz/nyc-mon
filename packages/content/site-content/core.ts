/** Shared, dependency-free validation. Never render stored iframe HTML. */
export type UnknownRecord = Record<string, unknown>;
export const record = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function safeRoute(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/?)*$/.test(value)) return null;
  const route = value === '/' ? '/' : value.replace(/\/$/, '');
  if (/^\/(admin|api|payload-api|auth|_next|cms-preview)(\/|$)/.test(route)) return null;
  return route;
}

export function safeLink(value: unknown): string | null {
  if (typeof value !== 'string' || !value || /[\u0000-\u0020\\]/.test(value)) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (/^#[A-Za-z][A-Za-z0-9_-]*$/.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function youtubeEmbed(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === 'youtu.be') id = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1] ?? null;
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(host)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else id = /^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1] ?? null;
    }
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    const target = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
    const start = url.searchParams.get('start');
    if (start && /^\d{1,5}$/.test(start) && Number(start) <= 86400) target.searchParams.set('start', start);
    return target.href;
  } catch { return null; }
}

export function iframeEmbed(value: unknown, allowedOrigins: readonly string[]): string | null {
  if (typeof value !== 'string' || /[\u0000-\u0020\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const origins = allowedOrigins.flatMap((entry) => {
      try {
        const allowed = new URL(entry.trim());
        return allowed.protocol === 'https:' && !allowed.username && !allowed.password &&
          allowed.pathname === '/' && !allowed.search && !allowed.hash ? [allowed.origin] : [];
      } catch { return []; }
    });
    const pathname = decodeURIComponent(url.pathname);
    if (!origins.includes(url.origin) || /[\\\u0000-\u001f]/.test(pathname) ||
        /^\/(admin|api|payload-api|auth|_next|cms-preview)(\/|$)/i.test(pathname)) return null;
    return url.href;
  } catch { return null; }
}

export interface MediaPlacement {
  pageId: string | number;
  route: string;
  page: string;
  section: string;
  sectionKey: string;
  field: string;
}

function mediaID(value: unknown): unknown { return record(value) ? value.id : value; }

/** Derive placement from actual upload relationships, not hand-maintained tags. */
export function mediaPlacements(page: unknown, mediaId: string | number): MediaPlacement[] {
  if (!record(page) || !Array.isArray(page.sections) ||
      (typeof page.id !== 'string' && typeof page.id !== 'number')) return [];
  const matches: MediaPlacement[] = [];
  for (const section of page.sections) {
    if (!record(section)) continue;
    const visit = (value: unknown, path: string) => {
      if (Array.isArray(value)) { value.forEach((child, i) => visit(child, `${path}[${i}]`)); return; }
      if (!record(value)) return;
      for (const [key, child] of Object.entries(value)) {
        const field = path ? `${path}.${key}` : key;
        if (key === 'image' && String(mediaID(child)) === String(mediaId)) {
          matches.push({
            pageId: page.id as string | number,
            route: typeof page.route === 'string' ? page.route : '',
            page: typeof page.title === 'string' ? page.title : '',
            section: typeof section.label === 'string' ? section.label : '',
            sectionKey: typeof section.sectionKey === 'string' ? section.sectionKey : '',
            field,
          });
        } else if (key !== 'image') visit(child, field);
      }
    };
    visit(section.content, 'content');
  }
  return matches;
}

export function sectionKeysAreUnique(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  for (const item of value) {
    if (!record(item) || typeof item.sectionKey !== 'string' ||
        !/^[a-z][a-z0-9-]{0,63}$/.test(item.sectionKey) || seen.has(item.sectionKey)) return false;
    seen.add(item.sectionKey);
  }
  return true;
}
