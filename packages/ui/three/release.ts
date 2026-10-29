/**
 * Module-level 3D caches that can be emptied on demand. Each cache registers
 * itself when its module first loads (the GLB parse caches, the Skia font
 * cache), so this module never imports them: a cache whose module never
 * loaded holds nothing.
 */
export interface Releasable {
  readonly name: string;
  /** Frees what nothing uses now; what is still in use goes when its last user lets go. */
  releaseAll(): ReleaseCount;
}

export interface ReleaseCount {
  /** Entries freed on the spot. */
  readonly freed: number;
  /** Entries still held by a mounted stage: dropped from the cache now, freed when that stage lets go. */
  readonly deferred: number;
}

const releasables = new Set<Releasable>();

export function registerReleasable(releasable: Releasable): void {
  releasables.add(releasable);
}

/**
 * Empties every 3D asset cache the H-Lynk stages share: the Baby and egg GLB
 * parses (geometry, materials, textures and their decoded images), the raw
 * GLB bytes kept for a reparse, and the Skia fonts the glass draws with.
 * Call it when the H-Lynk's renderer goes away for a while (the city is up).
 * The next stage to mount fetches and parses again, under its usual loader.
 */
export function releaseHLynkResources(): Readonly<Record<string, ReleaseCount>> {
  const report: Record<string, ReleaseCount> = {};
  for (const releasable of releasables) report[releasable.name] = releasable.releaseAll();
  return report;
}
