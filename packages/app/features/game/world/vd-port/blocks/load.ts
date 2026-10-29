// The block packs' bytes, read once while the game scene loads (load-game-scene.ts) and kept compressed: the shell
// (4.7 MB) decodes when the world is built, each near cell (16.4 MB together; 9.2 MB for the lite level) when the
// streamer first builds it.
// buildCityWorld is synchronous, so the bytes must be here before it runs; without them lane A draws nothing and says so.

export interface VdBlockBytes {
  shell: Uint8Array;
  /** The near level's cells, of `level` (perf/tier-presets.ts vdPort.blocksNear.level: 'lite' on the iPad and phone). */
  near: ReadonlyMap<string, Uint8Array>;
  level: 'near' | 'lite';
}

let bytes: VdBlockBytes | null = null;
let pending: Promise<VdBlockBytes | null> | null = null;

/** The preloaded bytes, or null when preloadVdBlocks has not finished (or failed). */
export function vdBlockBytes(): VdBlockBytes | null {
  return bytes;
}

/** Tests and tools hand the bytes in directly (read from tooling's output on disk). */
export function setVdBlockBytes(value: VdBlockBytes | null): void {
  bytes = value;
}

/**
 * Reads every pack through the platform asset loader. Resolves null (and logs) on failure: the world then builds
 * without lane A's blocks, and the bundled tile keeps its own buildings for them.
 */
export function preloadVdBlocks(): Promise<VdBlockBytes | null> {
  if (bytes) return Promise.resolve(bytes);
  pending ??= (async () => {
    try {
      const [{ VD_SHELL_ASSET, VD_NEAR_ASSETS, VD_LITE_ASSETS }, { fetchAssetBytes }, { worldPresetWithoutCanvas }, { vdCellFetch }] = await Promise.all([
        import('./data/assets.ts'),
        import('@acme/ui/three/asset-bytes'),
        import('../../../perf/tier-presets.ts'),
        import('../../cell-source/index.ts'),
      ]);
      // only the level this device draws is read: the iPad and phone rows take the lite cells, 'high' the full ones
      const level = worldPresetWithoutCanvas().vdPort.blocksNear.level;
      const entries = Object.entries(level === 'lite' ? VD_LITE_ASSETS : VD_NEAR_ASSETS);
      // The cells read through the cell source: the bundled Metro asset is the home copy and wins first; the disk
      // cache and the hash-pinned host cover a bundled read that fails. A cell nothing can produce rejects here,
      // which the catch below turns into the tile keeping its own buildings (no half-drawn lane A).
      const [shell, ...near] = await Promise.all([
        fetchAssetBytes(VD_SHELL_ASSET),
        ...entries.map(([key, src]) => vdCellFetch(`${level}/${key}`, () => fetchAssetBytes(src)).then((b) => {
          if (!b) throw new Error(`vd-port: cell ${level}/${key} is in the manifest but no source produced it`);
          return b;
        })),
      ]);
      bytes = {
        shell: new Uint8Array(shell!),
        near: new Map(entries.map(([key], i) => [key, near[i]! instanceof Uint8Array ? near[i]! as Uint8Array : new Uint8Array(near[i]!)])),
        level,
      };
      return bytes;
    } catch (cause) {
      console.warn('[vd-port] the block packs did not load; the bundled tile keeps its own buildings', cause);
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}
