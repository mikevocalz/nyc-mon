// The contract every vd-port sub-builder (./blocks, ./storefronts, ./furniture) builds against.
//
// The vd port puts Valdrada's own kits and data (github.com/mkturkcan/valdrada @ 2724c79, MIT) on the bundled tile:
// geometry and numbers come from Valdrada's files, translated, never approximated. What Valdrada does not have is left
// out and listed in the sub-builder's header, not invented.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import type { CellPackage } from '../cells/cell-rules.ts';
import type { WorldPreset } from '../../perf/tier-presets.ts';

type Group = InstanceType<Three['Group']>;
type Mesh = InstanceType<Three['Mesh']>;

/**
 * How a mesh streams (world/cells/cell-stream.ts): its geometric error (metres, the smallest feature it carries), the
 * chunk edge it is packaged at (CELL * 2^n) and whether it fades in with the dither. A mesh registered without a layer
 * is the persistent tier: it stays whole and resident (Valdrada never evicts a landmark).
 */
export interface VdStreamLayer {
  errorM: number;
  chunk: number;
  fade: boolean;
  /**
   * false: never pinned resident by the landmark rule (cell-stream.ts `pinned`), so detail streamed around a landmark
   * (storefronts, furniture, the blocks' near level) still evicts. Default: pinned where it overlaps a landmark.
   */
  pin?: boolean;
}

export interface VdPortCtx {
  THREE: Three;
  /** Add every mesh here (it is `city:vd-port` under the world group). */
  group: Group;
  /**
   * Valdrada's ENV.night (client/src/world/env.js): 0 by day, 1 after dark. Translate `onBeforeCompile` uniforms that
   * read ENV.night to this node. One uniform for the port; the world drives it from the time of day.
   */
  night: Node<'float'>;
  /**
   * Valdrada's ENV (client/src/world/materials.js) as TSL nodes, shared by every lane: the sun direction and colour, the
   * horizon (ENV.fogColor), the sky ambient (sky.js: fogColor x (0.6 + 0.4 dayL), dayL = 1 - night), the reflection gain
   * and the weather bus (wet, snow).
   */
  env: VdEnv;
  /**
   * The streaming and budget preset (perf/tier-presets.ts: residentRadiusM, the vd port's own budgets in `vdPort`), or
   * null when the world is built whole (no streaming): then each lane uses the ipad-a12x row.
   */
  preset: WorldPreset | null;
  /** True when the physical stack is on: colours then decode to linear (sRGB output, ACES in the pipeline). */
  physical: boolean;
  /**
   * The walking surface under a scene point, metres: 0 on a carriageway, CURB_HEIGHT on a sidewalk or block. Valdrada's
   * pieces are placed over its local pavement (padYNear, 3.52 in its datum); the port keeps every height relative to
   * that pavement and adds this.
   */
  groundY(x: number, z: number): number;
  /** Valdrada world metres (shared/geo.js project: x east, z south) to scene metres (tooling/city/valdrada/decode.mjs toScene). */
  toScene(vx: number, vz: number): [number, number];
  /** Inside the bundled tile's playable bounds (scene metres). */
  inBounds(x: number, z: number): boolean;
  /**
   * Hands a mesh to the cell streamer from PR #128 under `layer`, or keeps it resident when `layer` is null. Call once
   * per mesh, after it is in `group`. Merge by material first: the streamer cuts one mesh into chunks, and every mesh is a
   * draw.
   */
  register(mesh: Mesh, layer: VdStreamLayer | null): void;
  /**
   * Hands the streamer a layer already cut into packages (cells/cell-rules.ts CellPackage: indexed or not, decoded on
   * first read and released on eviction if the package says so). `template` is in `group`: the layer's material and
   * attribute layout over one triangle, drawn by the START compile so a streamed cell never compiles a pipeline.
   * `budget` holds the layer to its own triangles, bytes and draws, outside the preset's near-detail budget.
   */
  registerChunks(template: Mesh, layer: VdStreamLayer, packages: readonly CellPackage[], budget?: VdLayerBudget): void;
}

export interface VdEnv {
  night: Node<'float'>;
  wet: Node<'float'>;
  snow: Node<'float'>;
  sunDir: Node<'vec3'>;
  sunColor: Node<'vec3'>;
  skyAmbient: Node<'vec3'>;
  fogColor: Node<'vec3'>;
  reflGain: Node<'float'>;
}

export interface VdLayerBudget {
  geometryBytes: number;
  cellDraws: number;
  triangles: number;
}

/** What a sub-builder hands back: per-frame work, disposal and counts for the budget tests. */
export interface VdPortPart {
  /** Called each frame with the scene time in seconds (marquee chasers, LED sweeps). Optional. */
  update?(timeS: number): void;
  dispose(): void;
  stats: { meshes: number; triangles: number; structures: number };
}

export const EMPTY_PART: VdPortPart = { dispose() {}, stats: { meshes: 0, triangles: 0, structures: 0 } };
