// The contract every vd-port sub-builder (./blocks, ./storefronts, ./furniture) builds against.
//
// The vd port puts Valdrada's own kits and data (github.com/mkturkcan/valdrada @ 2724c79, MIT) on the bundled tile:
// geometry and numbers come from Valdrada's files, translated, never approximated. What Valdrada does not have is left
// out and listed in the sub-builder's header, not invented.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';

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
}

/** What a sub-builder hands back: per-frame work, disposal and counts for the budget tests. */
export interface VdPortPart {
  /** Called each frame with the scene time in seconds (marquee chasers, LED sweeps). Optional. */
  update?(timeS: number): void;
  dispose(): void;
  stats: { meshes: number; triangles: number; structures: number };
}

export const EMPTY_PART: VdPortPart = { dispose() {}, stats: { meshes: 0, triangles: 0, structures: 0 } };
