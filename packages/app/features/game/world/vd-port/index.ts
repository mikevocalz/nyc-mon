import type { InitialAssetProgress } from '../../scene-build-progress.ts';
import type { SourceLook } from '../source-look.ts';
import { aggregatePreparationAssets } from '../../scene-preparation.ts';
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
import { prepare as prepareBlocks } from './blocks/index.ts';
import { build as buildStorefronts } from './storefronts/index.ts';
import { build as buildFurniture } from './furniture/index.ts';
import { build as buildFarTier } from './far-tier/index.ts';
import { buildGen, EXPERIMENTAL_WORLD_GEN } from '../gen/layer.ts';
import { valdradaToScene } from './transform.ts';
import { EMPTY_PART } from './types.ts';
import type { VdEnv, VdLayerBudget, VdPortCtx, VdPortPart, VdStreamLayer } from './types.ts';
import type { CellPackage } from '../cells/cell-rules.ts';
import type { CellStream, ExternalLayer, Vec3 } from '../cells/cell-stream.ts';
import type { WorldPreset } from '../../perf/tier-presets.ts';

export type { VdEnv, VdLayerBudget, VdPortCtx, VdPortPart, VdStreamLayer } from './types.ts';

type Mesh = InstanceType<Three['Mesh']>;

export interface VdPortOptions {
  onAssetProgress?(event:InitialAssetProgress):void;
  /** Capabilities of this scene renderer's initialized GPUDevice, never adapter-only support. */
  hasTextureFeature?(name: string): boolean;
  /** Optional build timing evidence, using the host's existing stream logger. */
  log?: (line: string, data: Record<string, unknown>) => void;
  physical: boolean;
  /** Valdrada's ENV.night: 0 by day, 0.92 under its night skies (sky.js isNight). */
  night: number;
  groundY(x: number, z: number): number;
  /** Unit vector toward the sun, scene axes. */
  sunDirection: readonly [number, number, number];
  /** Linear RGB, unit scale, as Valdrada's ENV.sunColor and ENV.fogColor. */
  sunColor: readonly [number, number, number];
  horizon: readonly [number, number, number];
  skyAmbient?: readonly [number, number, number];
  /** The vd lane's weather uniforms (vd-materials.ts VdWeather), or none. */
  weather?: { wet: { value: number }; snow: { value: number } } | null;
  /** The streaming preset, or null when the world is built whole. */
  preset?: WorldPreset | null;
  wake?(): void;
}

export interface VdPort {
  /** Explicit prerequisites for reveal, never the future streaming world. */
  ready?: Promise<void>;
  group: InstanceType<Three['Group']>;
  applySourceLook(look: SourceLook): void;
  /** Meshes registered with a stream layer (userData.cellLayer set), for createCellStream. */
  streamMeshes: Mesh[];
  /** Layers registered already cut (registerChunks), for createCellStream's `external`. */
  streamLayers: ExternalLayer[];
  /** The streamer made from streamLayers: a layer registered later (lane C, once its assets are in) goes straight to it. */
  attachStream(stream: CellStream): void;
  setPrepareTemplates(prepare: NonNullable<VdPortCtx['prepareTemplates']>): void;
  prime(camera: Vec3, k: number, startRadius: number): void;
  demand(camera: Vec3, k: number): boolean;
  /** Sets Valdrada's ENV.night. */
  setNight(value: number): void;
  readonly animated: boolean;
  update(timeS: number,reducedMotion?: boolean): void;
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

export function* prepareVdPort(THREE: Three, dataset: CityDatasetV3, options: VdPortOptions): Generator<number, VdPort> {
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
    // Legacy seed remains compatible; analytic sourceLook replaces this distinct uniform before reveal.
    skyAmbient: v3(options.skyAmbient ?? options.horizon.map(c => c * (0.6 + 0.4 * (1 - options.night))) as [number,number,number]),
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
    collisionExtent: half,
    group,
    wake: options.wake,
    log: options.log,
    night,
    env,
    preset: options.preset ?? null,
    physical: options.physical,
    onAssetProgress: options.onAssetProgress,
    ...(options.hasTextureFeature ? { hasTextureFeature: options.hasTextureFeature } : {}),
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
  const parts: VdPortPart[] = [];
  const ownPart = (part: VdPortPart) => {
    parts.push(part);
    void part.ready?.catch(() => {});
  };
  let completed = false;
  try {
  const now = () => performance.now();
  let laneStart = now();
  const recordLane = (lane: string) => {
    options.log?.('prepare-lane', { lane, wallMs: +(now() - laneStart).toFixed(2) });
    laneStart = now();
  };
  const blocks = prepareBlocks(ctx);
  let stepStart = now();
  let step = blocks.next();
  let blockMs = now() - stepStart, maxStepMs = blockMs;
  try {
    while (!step.done) {
      yield step.value * 0.7;
      stepStart = now(); step = blocks.next();
      const elapsed = now() - stepStart;
      blockMs += elapsed; maxStepMs = Math.max(maxStepMs, elapsed);
    }
    ownPart(step.value);
  } finally { if (!step.done) blocks.return(EMPTY_PART); }
  options.log?.('prepare-lane', { lane: 'blocks', activeMs: +blockMs.toFixed(2), maxStepMs: +maxStepMs.toFixed(2) }); yield 0.7;
  laneStart = now(); ownPart(buildStorefronts(ctx)); recordLane('storefronts'); yield 0.8;
  laneStart = now(); ownPart(buildFurniture(ctx)); recordLane('furniture'); yield 0.9;
  laneStart = now(); ownPart(buildFarTier(ctx)); recordLane('far'); yield 0.98;
  // The gen lane (world/gen): seeded procedural infill on the cell stack, opt-in only
  // (EXPO_PUBLIC_WORLD_GEN). Off, the parts list — and the render — is unchanged.
  if (EXPERIMENTAL_WORLD_GEN) ownPart(buildGen(ctx, dataset));
  const stats = { meshes: 0, triangles: 0, structures: 0, streamed: streamMeshes.length + streamLayers.reduce((a, l) => a + l.packages.length, 0) };
  for (const p of parts) {
    stats.meshes += p.stats.meshes;
    stats.triangles += p.stats.triangles;
    stats.structures += p.stats.structures;
  }
  const prerequisites = aggregatePreparationAssets(parts.map(part => part.ready));
  const ready = prerequisites?.then(() => {
    stats.streamed = streamMeshes.length + streamLayers.reduce((sum, layer) => sum + layer.packages.length, 0);
  });
  void ready?.catch(() => {});
  completed = true;
  return {
    group,
    applySourceLook(look: SourceLook) {
      night.value = look.night;
      for (const [node, value] of [[env.sunDir, look.sunDirection], [env.sunColor, look.sunColor], [env.fogColor, look.horizon], [env.skyAmbient, look.skyAmbient]] as const) {
        const uniform = node as unknown as { value?: { set(x:number,y:number,z:number): unknown } };
        uniform.value?.set(...value);
      }
    },
    ready,
    streamMeshes,
    streamLayers,
    setPrepareTemplates(prepare) { ctx.prepareTemplates = prepare; },
    prime(camera, k, startRadius) { for (const part of parts) void part.prime?.(camera,k,startRadius).catch(() => {}); },
    demand(camera,k) { let busy=false; for (const part of parts) busy = part.demand?.(camera,k) === true || busy; return busy; },
    attachStream(s: CellStream) {
      stream = s;
    },
    setNight(value: number) {
      night.value = Math.max(0, Math.min(1, value));
    },
    get animated(){return parts.some(part=>part.animated===true);},
    update(timeS: number,reducedMotion=false) {
      for (const p of parts) p.update?.(timeS,reducedMotion);
    },
    dispose() {
      for (const p of parts) p.dispose();
    },
    stats,
  };
  } finally {
    if (!completed) for (const part of parts) part.dispose();
  }
}

/** Synchronous builder for worklet/host callers that own their scheduling. */
export function buildVdPort(THREE: Three, dataset: CityDatasetV3, options: VdPortOptions): VdPort {
  const steps = prepareVdPort(THREE, dataset, options);
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value;
}
