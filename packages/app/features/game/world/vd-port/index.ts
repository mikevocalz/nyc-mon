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
import { build as buildFarTier } from './far-tier/index.ts';
import { valdradaToScene } from './transform.ts';
import type { VdEnv, VdLayerBudget, VdPortCtx, VdPortPart, VdStreamLayer } from './types.ts';
import type { CellPackage } from '../cells/cell-rules.ts';
import type { CellStream, ExternalLayer } from '../cells/cell-stream.ts';
import type { WorldPreset } from '../../perf/tier-presets.ts';

export type { VdEnv, VdLayerBudget, VdPortCtx, VdPortPart, VdStreamLayer } from './types.ts';

type Mesh = InstanceType<Three['Mesh']>;

export interface VdPortOptions {
  physical: boolean;
  /** Valdrada's ENV.night: 0 by day, 0.92 under its night skies (sky.js isNight). */
  night: number;
  groundY(x: number, z: number): number;
  /** Unit vector toward the sun, scene axes. */
  sunDirection: readonly [number, number, number];
  /** Linear RGB, unit scale, as Valdrada's ENV.sunColor and ENV.fogColor. */
  sunColor: readonly [number, number, number];
  horizon: readonly [number, number, number];
  /** The vd lane's weather uniforms (vd-materials.ts VdWeather), or none. */
  weather?: { wet: { value: number }; snow: { value: number } } | null;
  /** The streaming preset, or null when the world is built whole. */
  preset?: WorldPreset | null;
}

export interface VdPort {
  group: InstanceType<Three['Group']>;
  /** Meshes registered with a stream layer (userData.cellLayer set), for createCellStream. */
  streamMeshes: Mesh[];
  /** Layers registered already cut (registerChunks), for createCellStream's `external`. */
  streamLayers: ExternalLayer[];
  /** The streamer made from streamLayers: a layer registered later (lane C, once its assets are in) goes straight to it. */
  attachStream(stream: CellStream): void;
  /** Sets Valdrada's ENV.night. */
  setNight(value: number): void;
  update(timeS: number): void;
  dispose(): void;
  stats: { meshes: number; triangles: number; structures: number; streamed: number };
}

/**
 * Valdrada's ENV.night from the world's lit-room share (index.ts TOD_BY_SKY: morning 0.15, dusk 0.8, night 1): 0 by day
 * and 0.92 at night, sky.js's value under its night skies. Dusk sits on the line between (0.75 at the world's 0.8): the
 * dusk HDRI's luminance, which Valdrada derives it from, is not in the port.
 */
export function vdNight(timeOfDay: number): number {
  return Math.max(0, Math.min(0.92, ((timeOfDay - 0.15) / 0.85) * 0.92));
}

export function buildVdPort(THREE: Three, dataset: CityDatasetV3, options: VdPortOptions): VdPort {
  const group = new THREE.Group();
  group.name = 'city:vd-port';
  const T = THREE.TSL;
  const night = T.uniform(options.night) as unknown as Node<'float'> & { value: number };
  const v3 = (a: readonly [number, number, number]) => T.uniform(new THREE.Vector3(a[0], a[1], a[2])) as unknown as Node<'vec3'>;
  const fogColor = v3(options.horizon);
  const env: VdEnv = {
    night,
    // the weather bus: the vd lane's own uniforms when it has them, so the port and the vd materials stay in step
    wet: (options.weather?.wet ?? T.uniform(0)) as unknown as Node<'float'>,
    snow: (options.weather?.snow ?? T.uniform(0)) as unknown as Node<'float'>,
    sunDir: v3(options.sunDirection),
    sunColor: v3(options.sunColor),
    fogColor,
    // sky.js: ENV.skyAmbient = fogColor x (0.6 + 0.4 dayL)
    skyAmbient: fogColor.mul(T.float(0.6).add(T.float(1).sub(night).mul(0.4))) as unknown as Node<'vec3'>,
    // materials.js ENV.reflGain default
    reflGain: T.float(1) as unknown as Node<'float'>,
  };
  const toScene = valdradaToScene(dataset.origin);
  const half = dataset.extentMeters;
  const streamMeshes: Mesh[] = [];
  const streamLayers: ExternalLayer[] = [];
  let stream: CellStream | null = null;
  const ctx: VdPortCtx = {
    THREE,
    group,
    night,
    env,
    preset: options.preset ?? null,
    physical: options.physical,
    groundY: options.groundY,
    toScene,
    inBounds: (x, z) => Math.abs(x) <= half && Math.abs(z) <= half,
    register(mesh: Mesh, layer: VdStreamLayer | null) {
      if (!layer) return;
      mesh.userData.cellLayer = layer;
      streamMeshes.push(mesh);
    },
    registerChunks(template: Mesh, layer: VdStreamLayer, packages: readonly CellPackage[], budget?: VdLayerBudget) {
      const ext: ExternalLayer = { template, spec: layer, packages, ...(budget ? { budget } : {}) };
      streamLayers.push(ext);
      stream?.addExternal(ext);
    },
  };
  const parts: VdPortPart[] = [buildBlocks(ctx), buildStorefronts(ctx), buildFurniture(ctx), buildFarTier(ctx)];
  const stats = { meshes: 0, triangles: 0, structures: 0, streamed: streamMeshes.length + streamLayers.reduce((a, l) => a + l.packages.length, 0) };
  for (const p of parts) {
    stats.meshes += p.stats.meshes;
    stats.triangles += p.stats.triangles;
    stats.structures += p.stats.structures;
  }
  return {
    group,
    streamMeshes,
    streamLayers,
    attachStream(s: CellStream) {
      stream = s;
    },
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
