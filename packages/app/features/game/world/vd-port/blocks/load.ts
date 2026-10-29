// The block packs' bytes, read once while the game scene loads (load-game-scene.ts) and kept compressed: the shell
// (4.7 MB) decodes when the world is built, each near cell (16.4 MB together) when the streamer first builds it.
// buildCityWorld is synchronous, so the bytes must be here before it runs; without them lane A draws nothing and says so.

export interface VdBlockBytes {
  shell: Uint8Array;
  near: ReadonlyMap<string, Uint8Array>;
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
      const [{ VD_SHELL_ASSET, VD_NEAR_ASSETS }, { fetchAssetBytes }] = await Promise.all([
        import('./data/assets.ts'),
        import('@acme/ui/three/asset-bytes'),
      ]);
      const entries = Object.entries(VD_NEAR_ASSETS);
      const [shell, ...near] = await Promise.all([
        fetchAssetBytes(VD_SHELL_ASSET),
        ...entries.map(([, src]) => fetchAssetBytes(src)),
      ]);
      bytes = {
        shell: new Uint8Array(shell!),
        near: new Map(entries.map(([key], i) => [key, new Uint8Array(near[i]!)])),
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
