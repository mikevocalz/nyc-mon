// The far tier's byte supply. Chunks are not bundled whole (the set is ~700 MB): they stream through the cell
// source (world/cell-source), hash-pinned per `far/<file>` in vd-cells-manifest.ts. The home subset — the chunks
// write-far.mjs marked `home` and copied into data/chunks as Metro assets — is the bundled fallback copy the source
// prefers for those keys, and is preloaded here while the game scene loads so the silhouettes over home are in for
// the first frames. Everything else fetches on demand inside the far layer's reach (far-tier/index.ts).
//
// The eager map is also the test seam: setVdFarBytes hands bytes in directly (load-from-disk.test-support.ts),
// which the lazy packages (on-demand.ts) then read before the cell source.

export interface VdFarBytes {
  /** Bytes already held for a chunk file (the preloaded home subset, or a test's whole set). */
  chunks: ReadonlyMap<string, Uint8Array>;
  /** The landmark file's bytes, when already held (a test's injection; normally fetched on demand). */
  landmarks: Uint8Array | null;
}

let bytes: VdFarBytes | null = null;
let pending: Promise<VdFarBytes | null> | null = null;
let bundled: Readonly<Record<string, () => Promise<ArrayBuffer>>> = {};

/** The eagerly held bytes, or null before preloadVdFar resolves (and after setVdFarBytes(null)). */
export function vdFarBytes(): VdFarBytes | null {
  return bytes;
}

/** Tests and tools hand the bytes in directly (read from the bake output or the bundled copies on disk). */
export function setVdFarBytes(value: VdFarBytes | null): void {
  bytes = value;
}

/** The bundled loader for a chunk file when it is one of the home Metro assets, else undefined (fetch-only). */
export function vdFarBundled(file: string): (() => Promise<ArrayBuffer>) | undefined {
  return bundled[file];
}

/**
 * Reads the bundled home chunks through the cell source (the bundled Metro asset wins first; the disk cache and the
 * hash-pinned host back it). Resolves null on failure: the far city then streams what it can fetch, and without a
 * source stays empty — never a crash.
 */
export function preloadVdFar(): Promise<VdFarBytes | null> {
  if (bytes) return Promise.resolve(bytes);
  pending ??= (async () => {
    try {
      const [{ VD_FAR_ASSETS }, { fetchAssetBytes }, { vdCellFetch }] = await Promise.all([
        import('./data/assets.ts'),
        import('@acme/ui/three/asset-bytes'),
        import('../../cell-source/index.ts'),
      ]);
      bundled = Object.fromEntries(
        Object.entries(VD_FAR_ASSETS).map(([f, id]) => [f, () => fetchAssetBytes(id)] as const),
      );
      const files = Object.keys(VD_FAR_ASSETS);
      const bufs = await Promise.all(files.map((f) => vdCellFetch(`far/${f}`, bundled[f])));
      const chunks = new Map<string, Uint8Array>();
      files.forEach((f, i) => {
        const b = bufs[i];
        if (b) chunks.set(f, b instanceof Uint8Array ? b : new Uint8Array(b));
      });
      bytes = { chunks, landmarks: null };
      return bytes;
    } catch (cause) {
      console.warn('[vd-port] the far-tier home packs did not load; the far city streams on demand only', cause);
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}
