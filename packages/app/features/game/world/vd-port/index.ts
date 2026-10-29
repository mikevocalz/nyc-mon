// The vd port: Valdrada's kits and data on the bundled tile (github.com/mkturkcan/valdrada @ 2724c79, MIT).
//
// Three lanes build against one context (types.ts):
//   ./blocks       lane A: the 125th Street blocks and the landmarks in bounds
//   ./storefronts  lane B: every storefront in bounds
//   ./furniture    lane C: street furniture, props and the elevated structures in bounds
//
// buildCityWorld calls this behind the vd flag. Meshes a lane registers with a stream layer are handed to the cell
// streamer (world/cells/cell-stream.ts, PR #128) through `streamMeshes`; the rest stay resident.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import type { CityDatasetV3 } from '../../city-dataset.ts';
import { build as buildBlocks } from './blocks/index.ts';
import { build as buildStorefronts } from './storefronts/index.ts';
import { build as buildFurniture } from './furniture/index.ts';
import { valdradaToScene } from './transform.ts';
import type { VdPortCtx, VdPortPart, VdStreamLayer } from './types.ts';

export type { VdPortCtx, VdPortPart, VdStreamLayer } from './types.ts';

type Mesh = InstanceType<Three['Mesh']>;

export interface VdPortOptions {
  physical: boolean;
  /** 0 by day … 1 after dark; the world's time-of-day share. */
  night: number;
  groundY(x: number, z: number): number;
}

export interface VdPort {
  group: InstanceType<Three['Group']>;
  /** Meshes registered with a stream layer (userData.cellLayer set), for createCellStream. */
  streamMeshes: Mesh[];
  /** Sets Valdrada's ENV.night. */
  setNight(value: number): void;
  update(timeS: number): void;
  dispose(): void;
  stats: { meshes: number; triangles: number; structures: number; streamed: number };
}

export function buildVdPort(THREE: Three, dataset: CityDatasetV3, options: VdPortOptions): VdPort {
  const group = new THREE.Group();
  group.name = 'city:vd-port';
  const night = THREE.TSL.uniform(options.night) as unknown as Node<'float'> & { value: number };
  const toScene = valdradaToScene(dataset.origin);
  const half = dataset.extentMeters;
  const streamMeshes: Mesh[] = [];
  const ctx: VdPortCtx = {
    THREE,
    group,
    night,
    physical: options.physical,
    groundY: options.groundY,
    toScene,
    inBounds: (x, z) => Math.abs(x) <= half && Math.abs(z) <= half,
    register(mesh: Mesh, layer: VdStreamLayer | null) {
      if (!layer) return;
      mesh.userData.cellLayer = layer;
      streamMeshes.push(mesh);
    },
  };
  const parts: VdPortPart[] = [buildBlocks(ctx), buildStorefronts(ctx), buildFurniture(ctx)];
  const stats = { meshes: 0, triangles: 0, structures: 0, streamed: streamMeshes.length };
  for (const p of parts) {
    stats.meshes += p.stats.meshes;
    stats.triangles += p.stats.triangles;
    stats.structures += p.stats.structures;
  }
  return {
    group,
    streamMeshes,
    setNight(value: number) {
      night.value = Math.max(0, Math.min(1, value));
    },
    update(timeS: number) {
      for (const p of parts) p.update?.(timeS);
    },
    dispose() {
      for (const p of parts) p.dispose();
    },
    stats,
  };
}
