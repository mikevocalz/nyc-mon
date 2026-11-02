// The cell source's front door for the world lanes. Configuration is explicit: a baseUrl is handed in (or the
// EXPO_PUBLIC_VD_CELL_BASE env), never invented here; with none the source still serves the bundled and cached
// copies. Platform IO and the store resolve through platform.ts / platform.native.ts (Metro picks the native file).
import { createCellSource, type CellSource } from './cell-source.ts';
import { VD_CELL_MANIFEST } from './data/vd-cells-manifest.ts';
import { VD_SYSTEM_MANIFEST } from './data/vd-systems-manifest.ts';
import { platformIo, platformStore } from './platform.ts';
import type { CellIo, CellManifest, CellStore } from './types.ts';

export type { CellSource } from './cell-source.ts';
export type { CellManifest, CellRef } from './types.ts';
export { VD_CELL_MANIFEST, VD_SYSTEM_MANIFEST };

/**
 * The runtime manifest: geometry cells plus the game-system packs. The two generated manifests key on
 * disjoint namespaces (`far/`/`lite/`/`near/`/`ringN-*`/`structures/` against `colliders/`/`pednet/`/
 * `traffic/`/`spawns/`/`labels/`), so the spread is a union, never an overwrite — asserted by
 * vd-systems-manifest.test.ts. Until this merge existed the system packs fell through to the
 * unmanifested-bundled fallback in cell-source.ts, served without their sha256 + bytes pin; merged,
 * they verify exactly like geometry cells.
 */
export const VD_MANIFEST: CellManifest = {
  version: 1,
  cells: { ...VD_CELL_MANIFEST.cells, ...VD_SYSTEM_MANIFEST.cells },
};

export interface VdCellSourceConfig {
  /** Remote root the manifest's paths hang under; undefined disables downloads (bundled + cache only). */
  baseUrl?: string;
  manifest?: CellManifest;
  io?: CellIo;
  store?: CellStore;
  capacityBytes?: number;
  maxConcurrent?: number;
}

let configured: CellSource | null | undefined;

/**
 * Installs the shared source. Call once with the app's host root; returns null when neither the argument nor the
 * env names one — the lanes then read bundled copies only.
 */
export function configureVdCellSource(config: VdCellSourceConfig = {}): CellSource | null {
  // A literal `process.env.EXPO_PUBLIC_*` member access: Metro and Next inline it at build time, and neither matches
  // an optional-chained `process.env?.X`.
  const env = typeof process !== 'undefined' && process.env ? process.env.EXPO_PUBLIC_VD_CELL_BASE : undefined;
  const baseUrl = config.baseUrl ?? (env || undefined);
  configured = createCellSource({
    manifest: config.manifest ?? VD_MANIFEST,
    io: config.io ?? platformIo(),
    store: config.store ?? platformStore(),
    baseUrl,
    ...(config.capacityBytes !== undefined ? { capacityBytes: config.capacityBytes } : {}),
    ...(config.maxConcurrent !== undefined ? { maxConcurrent: config.maxConcurrent } : {}),
  });
  return configured;
}

/** The shared source, lazily configured from the env on first use (null while configuration threw). */
export function vdCellSource(): CellSource | null {
  if (configured === undefined) {
    try {
      configureVdCellSource();
    } catch (cause) {
      console.warn('[cell-source] platform store unavailable; bundled copies only', cause);
      configured = null;
    }
    if (configured === undefined) configured = null;
  }
  return configured;
}

/**
 * The cell bytes for `key` (a manifest key like 'structures/-1_0'): bundled for home cells, then the disk cache,
 * then the hash-pinned host. Bundled-only cells pass a `bundled` loader and are served without a manifest entry.
 * Always resolves; null means the caller keeps its fallback (the far shell) and retries on a later prefetch.
 */
export function vdCellFetch(key: string, bundled?: () => Promise<Uint8Array | ArrayBuffer>): Promise<Uint8Array | ArrayBuffer | null> {
  const s = vdCellSource();
  if (!s) return bundled ? bundled().catch(() => null) : Promise.resolve(null);
  return s.fetch(key, bundled);
}

/**
 * The fetch for a game-system pack: `kind` is the VGC1 kind name ('colliders', 'pednet', 'traffic',
 * 'spawns', 'labels' — cell-pack.ts PACK_KIND) and `key` its cell part ('<cx>_<cz>'). The manifest key
 * is `<kind>/<key>`; every emitted pack is `bundled: true`, so the caller's `bundled` loader (the
 * VD_SYSTEM_ASSETS require id through fetchAssetBytes) is preferred and verified against the pin —
 * an unmanifested key never reaches the unverified fallback here, only a caller that hands in no
 * loader at all. Null resolves to "skip this cell", same contract as vdCellFetch.
 */
export function vdSystemFetch(kind: string, key: string, bundled?: () => Promise<Uint8Array | ArrayBuffer>): Promise<Uint8Array | ArrayBuffer | null> {
  return vdCellFetch(`${kind}/${key}`, bundled);
}
