/**
 * The public `mon-art` REST read (approved docs only) and its validation.
 * No imports, so the MCP server can share it without the app's store.
 */

/** One approved console still, keyed by species id (`dex-021`). */
export interface AdminStill {
  readonly speciesId: string;
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

interface MonArtDoc { speciesId?: unknown; url?: unknown; width?: unknown; height?: unknown; alt?: unknown }

/** The usable stills in a `mon-art` REST body; a doc with a bad field is dropped, never thrown on. */
export function parseMonArt(body: unknown): AdminStill[] {
  const docs = (body as { docs?: unknown } | null)?.docs;
  if (!Array.isArray(docs)) return [];
  return docs.flatMap((doc: MonArtDoc | null) => {
    if (doc === null || typeof doc !== 'object') return [];
    const { speciesId, url, width, height, alt } = doc;
    if (typeof speciesId !== 'string' || !speciesId.trim()) return [];
    if (typeof url !== 'string' || !url.startsWith('https://')) return [];
    if (typeof width !== 'number' || typeof height !== 'number' || !(width > 0) || !(height > 0)) return [];
    if (typeof alt !== 'string' || !alt.trim()) return [];
    return [{ speciesId, url, width, height, alt }];
  });
}

/** The REST read for approved stills under a Payload origin (`<origin>/payload-api/mon-art?...`). */
export function monArtUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}/payload-api/mon-art?where[status][equals]=approved&depth=0&limit=200`;
}
