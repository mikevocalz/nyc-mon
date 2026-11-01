import type { AdminStill } from '../components/mons/still-art.ts';

interface MonArtDoc { speciesId?: unknown; url?: unknown; width?: unknown; height?: unknown; alt?: unknown }

/** Approved console stills, as the public REST API returns them (access: approved only for visitors). */
export function parseMonArt(body: unknown): AdminStill[] {
  const docs = (body as { docs?: MonArtDoc[] } | null)?.docs ?? [];
  return docs.flatMap((doc) => {
    const { speciesId, url, width, height, alt } = doc;
    if (typeof speciesId !== 'string' || typeof url !== 'string' || !url.startsWith('https://')) return [];
    if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) return [];
    if (typeof alt !== 'string' || !alt.trim()) return [];
    return [{ speciesId, src: url, width, height, alt }];
  });
}

