// The block packs' bytes, read once while the game scene loads (load-game-scene.ts) and kept compressed: the shell
// (4.7 MB) decodes when the world is built, each near cell (16.4 MB together; 9.2 MB for the lite level) when the
// streamer first builds it.
// buildCityWorld is synchronous, so the bytes must be here before it runs; without them lane A draws nothing and says so.

export interface VdBlockBytes {
  shell: Uint8Array;
  /** The near level's cells, of `level` (perf/tier-presets.ts vdPort.blocksNear.level: 'lite' on the iPad and phone). */
  near: ReadonlyMap<string, Uint8Array>;
  level: 'near' | 'lite';
  /**
   * Ring 1's packs (blocks/data-ring1): its resident shell and the home-overlap cells only — the rest of its cells
   * stream through the cell source as `ring1-<level>/<cell>` (world/cell-source, write-cells-manifest.mjs).
   */
  ring1?: { shell: Uint8Array; bundled: ReadonlyMap<string, Uint8Array> } | null;
  /** Ring 2's packs (blocks/data-ring2), same contract under `ring2-<level>/<cell>`. */
  ring2?: { shell: Uint8Array; bundled: ReadonlyMap<string, Uint8Array> } | null;
  /** Ring 3's packs (blocks/data-ring3), same contract under `ring3-<level>/<cell>`. */
  ring3?: { shell: Uint8Array; bundled: ReadonlyMap<string, Uint8Array> } | null;
  /** Ring 4's packs (blocks/data-ring4), same contract under `ring4-<level>/<cell>`. */
  ring4?: { shell: Uint8Array; bundled: ReadonlyMap<string, Uint8Array> } | null;
  /** Ring 5's packs (blocks/data-ring5), same contract under `ring5-<level>/<cell>`. */
  ring5?: { shell: Uint8Array; bundled: ReadonlyMap<string, Uint8Array> } | null;
  /** Ring 6's packs (blocks/data-ring6), same contract under `ring6-<level>/<cell>`. */
  ring6?: { shell: Uint8Array; bundled: ReadonlyMap<string, Uint8Array> } | null;
  /** Ring 7's packs (blocks/data-ring7), same contract under `ring7-<level>/<cell>`. */
  ring7?: { shell: Uint8Array; bundled: ReadonlyMap<string, Uint8Array> } | null;
  /** Ring 8's packs (blocks/data-ring8), same contract under `ring8-<level>/<cell>`. */
  ring8?: { shell: Uint8Array; bundled: ReadonlyMap<string, Uint8Array> } | null;
  /** Ring 9's packs (blocks/data-ring9), same contract under `ring9-<level>/<cell>`. */
  ring9?: { shell: Uint8Array; bundled: ReadonlyMap<string, Uint8Array> } | null;
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
      // Ring 1's packs: the shell is resident and bundled, its cells stream except the home-overlap ones. Missing
      // ring bytes degrade to the home tile only — lane A still draws the square.
      let ring1: VdBlockBytes['ring1'] = null;
      try {
        const r1 = await import('./data-ring1/assets.ts');
        const r1Entries = Object.entries(level === 'lite' ? r1.VD_LITE_ASSETS : r1.VD_NEAR_ASSETS);
        const [r1Shell, ...r1Cells] = await Promise.all([
          fetchAssetBytes(r1.VD_SHELL_ASSET),
          ...r1Entries.map(([key, src]) => vdCellFetch(`ring1-${level}/${key}`, () => fetchAssetBytes(src))),
        ]);
        ring1 = {
          shell: new Uint8Array(r1Shell!),
          bundled: new Map(r1Entries.map(([key], i) => [key, r1Cells[i]! instanceof Uint8Array ? r1Cells[i]! as Uint8Array : r1Cells[i]! ? new Uint8Array(r1Cells[i]!) : new Uint8Array(0)])),
        };
      } catch (cause) {
        console.warn('[vd-port] the ring-1 block packs did not load; its cells stay with the cell source', cause);
      }
      // Ring 2's packs: same contract — resident bundled shell, home-overlap cells bundled, the rest stream.
      let ring2: VdBlockBytes['ring2'] = null;
      try {
        const r2 = await import('./data-ring2/assets.ts');
        const r2Entries = Object.entries(level === 'lite' ? r2.VD_LITE_ASSETS : r2.VD_NEAR_ASSETS);
        const [r2Shell, ...r2Cells] = await Promise.all([
          fetchAssetBytes(r2.VD_SHELL_ASSET),
          ...r2Entries.map(([key, src]) => vdCellFetch(`ring2-${level}/${key}`, () => fetchAssetBytes(src))),
        ]);
        ring2 = {
          shell: new Uint8Array(r2Shell!),
          bundled: new Map(r2Entries.map(([key], i) => [key, r2Cells[i]! instanceof Uint8Array ? r2Cells[i]! as Uint8Array : r2Cells[i]! ? new Uint8Array(r2Cells[i]!) : new Uint8Array(0)])),
        };
      } catch (cause) {
        console.warn('[vd-port] the ring-2 block packs did not load; its cells stay with the cell source', cause);
      }
      // Ring 3's packs: same contract — resident bundled shell, home-overlap cells bundled, the rest stream.
      let ring3: VdBlockBytes['ring3'] = null;
      try {
        const r3 = await import('./data-ring3/assets.ts');
        const r3Entries = Object.entries(level === 'lite' ? r3.VD_LITE_ASSETS : r3.VD_NEAR_ASSETS);
        const [r3Shell, ...r3Cells] = await Promise.all([
          fetchAssetBytes(r3.VD_SHELL_ASSET),
          ...r3Entries.map(([key, src]) => vdCellFetch(`ring3-${level}/${key}`, () => fetchAssetBytes(src))),
        ]);
        ring3 = {
          shell: new Uint8Array(r3Shell!),
          bundled: new Map(r3Entries.map(([key], i) => [key, r3Cells[i]! instanceof Uint8Array ? r3Cells[i]! as Uint8Array : r3Cells[i]! ? new Uint8Array(r3Cells[i]!) : new Uint8Array(0)])),
        };
      } catch (cause) {
        console.warn('[vd-port] the ring-3 block packs did not load; its cells stay with the cell source', cause);
      }
      // Ring 4's packs: same contract — resident bundled shell, home-overlap cells bundled, the rest stream.
      let ring4: VdBlockBytes['ring4'] = null;
      try {
        const r4 = await import('./data-ring4/assets.ts');
        const r4Entries = Object.entries(level === 'lite' ? r4.VD_LITE_ASSETS : r4.VD_NEAR_ASSETS);
        const [r4Shell, ...r4Cells] = await Promise.all([
          fetchAssetBytes(r4.VD_SHELL_ASSET),
          ...r4Entries.map(([key, src]) => vdCellFetch(`ring4-${level}/${key}`, () => fetchAssetBytes(src))),
        ]);
        ring4 = {
          shell: new Uint8Array(r4Shell!),
          bundled: new Map(r4Entries.map(([key], i) => [key, r4Cells[i]! instanceof Uint8Array ? r4Cells[i]! as Uint8Array : r4Cells[i]! ? new Uint8Array(r4Cells[i]!) : new Uint8Array(0)])),
        };
      } catch (cause) {
        console.warn('[vd-port] the ring-4 block packs did not load; its cells stay with the cell source', cause);
      }
      // Ring 5's packs: same contract — resident bundled shell, home-overlap cells bundled, the rest stream.
      let ring5: VdBlockBytes['ring5'] = null;
      try {
        const r5 = await import('./data-ring5/assets.ts');
        const r5Entries = Object.entries(level === 'lite' ? r5.VD_LITE_ASSETS : r5.VD_NEAR_ASSETS);
        const [r5Shell, ...r5Cells] = await Promise.all([
          fetchAssetBytes(r5.VD_SHELL_ASSET),
          ...r5Entries.map(([key, src]) => vdCellFetch(`ring5-${level}/${key}`, () => fetchAssetBytes(src))),
        ]);
        ring5 = {
          shell: new Uint8Array(r5Shell!),
          bundled: new Map(r5Entries.map(([key], i) => [key, r5Cells[i]! instanceof Uint8Array ? r5Cells[i]! as Uint8Array : r5Cells[i]! ? new Uint8Array(r5Cells[i]!) : new Uint8Array(0)])),
        };
      } catch (cause) {
        console.warn('[vd-port] the ring-5 block packs did not load; its cells stay with the cell source', cause);
      }
      // Ring 6's packs: same contract — resident bundled shell, home-overlap cells bundled, the rest stream.
      let ring6: VdBlockBytes['ring6'] = null;
      try {
        const r6 = await import('./data-ring6/assets.ts');
        const r6Entries = Object.entries(level === 'lite' ? r6.VD_LITE_ASSETS : r6.VD_NEAR_ASSETS);
        const [r6Shell, ...r6Cells] = await Promise.all([
          fetchAssetBytes(r6.VD_SHELL_ASSET),
          ...r6Entries.map(([key, src]) => vdCellFetch(`ring6-${level}/${key}`, () => fetchAssetBytes(src))),
        ]);
        ring6 = {
          shell: new Uint8Array(r6Shell!),
          bundled: new Map(r6Entries.map(([key], i) => [key, r6Cells[i]! instanceof Uint8Array ? r6Cells[i]! as Uint8Array : r6Cells[i]! ? new Uint8Array(r6Cells[i]!) : new Uint8Array(0)])),
        };
      } catch (cause) {
        console.warn('[vd-port] the ring-6 block packs did not load; its cells stay with the cell source', cause);
      }
      // Ring 7's packs: same contract — resident bundled shell, home-overlap cells bundled, the rest stream.
      let ring7: VdBlockBytes['ring7'] = null;
      try {
        const r7 = await import('./data-ring7/assets.ts');
        const r7Entries = Object.entries(level === 'lite' ? r7.VD_LITE_ASSETS : r7.VD_NEAR_ASSETS);
        const [r7Shell, ...r7Cells] = await Promise.all([
          fetchAssetBytes(r7.VD_SHELL_ASSET),
          ...r7Entries.map(([key, src]) => vdCellFetch(`ring7-${level}/${key}`, () => fetchAssetBytes(src))),
        ]);
        ring7 = {
          shell: new Uint8Array(r7Shell!),
          bundled: new Map(r7Entries.map(([key], i) => [key, r7Cells[i]! instanceof Uint8Array ? r7Cells[i]! as Uint8Array : r7Cells[i]! ? new Uint8Array(r7Cells[i]!) : new Uint8Array(0)])),
        };
      } catch (cause) {
        console.warn('[vd-port] the ring-7 block packs did not load; its cells stay with the cell source', cause);
      }
      // Ring 8's packs: same contract — resident bundled shell, home-overlap cells bundled, the rest stream.
      let ring8: VdBlockBytes['ring8'] = null;
      try {
        const r8 = await import('./data-ring8/assets.ts');
        const r8Entries = Object.entries(level === 'lite' ? r8.VD_LITE_ASSETS : r8.VD_NEAR_ASSETS);
        const [r8Shell, ...r8Cells] = await Promise.all([
          fetchAssetBytes(r8.VD_SHELL_ASSET),
          ...r8Entries.map(([key, src]) => vdCellFetch(`ring8-${level}/${key}`, () => fetchAssetBytes(src))),
        ]);
        ring8 = {
          shell: new Uint8Array(r8Shell!),
          bundled: new Map(r8Entries.map(([key], i) => [key, r8Cells[i]! instanceof Uint8Array ? r8Cells[i]! as Uint8Array : r8Cells[i]! ? new Uint8Array(r8Cells[i]!) : new Uint8Array(0)])),
        };
      } catch (cause) {
        console.warn('[vd-port] the ring-8 block packs did not load; its cells stay with the cell source', cause);
      }
      // Ring 9's packs: same contract — resident bundled shell, home-overlap cells bundled, the rest stream.
      let ring9: VdBlockBytes['ring9'] = null;
      try {
        const r9 = await import('./data-ring9/assets.ts');
        const r9Entries = Object.entries(level === 'lite' ? r9.VD_LITE_ASSETS : r9.VD_NEAR_ASSETS);
        const [r9Shell, ...r9Cells] = await Promise.all([
          fetchAssetBytes(r9.VD_SHELL_ASSET),
          ...r9Entries.map(([key, src]) => vdCellFetch(`ring9-${level}/${key}`, () => fetchAssetBytes(src))),
        ]);
        ring9 = {
          shell: new Uint8Array(r9Shell!),
          bundled: new Map(r9Entries.map(([key], i) => [key, r9Cells[i]! instanceof Uint8Array ? r9Cells[i]! as Uint8Array : r9Cells[i]! ? new Uint8Array(r9Cells[i]!) : new Uint8Array(0)])),
        };
      } catch (cause) {
        console.warn('[vd-port] the ring-9 block packs did not load; its cells stay with the cell source', cause);
      }
      bytes = {
        shell: new Uint8Array(shell!),
        near: new Map(entries.map(([key], i) => [key, near[i]! instanceof Uint8Array ? near[i]! as Uint8Array : new Uint8Array(near[i]!)])),
        level,
        ring1,
        ring2,
        ring3,
        ring4,
        ring5,
        ring6,
        ring7,
        ring8,
        ring9,
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
