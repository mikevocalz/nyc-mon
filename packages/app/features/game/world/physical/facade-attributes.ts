// Adapted from mrdoob/slop-newyork @ be65d0a, js/tsl-materials.js WALL_KINDS and createFacadeBoxes (MIT, © 2026 Mr.doob)
//
// Slop's facade shaders lay windows out per wall: each instanced unit box
// carries `box` (width, height, depth, seed + tone) and `faces` (the wall
// kind of each side), and the shader reads its position inside the box.
// nyc-mon walls are not boxes: city-mesh.ts merges every footprint ring of
// the tile into one masonry and one glass buffer (one draw each). So the
// same facts travel per vertex instead, written beside the existing
// attributes when city-mesh.ts is asked for them:
//
//   aFacadeWall vec4  (along m, wall width m, wall height m, wall kind)
//   aFacadeGrid vec4  (floor height m, window width m, seed + tone, family * 4 + corner pier m)
//
// `along` runs from the wall's start corner in ring order, which is the
// viewer's left seen from the street (the outward normal is right of
// travel), so it is Slop's `wallS` with no flip. Vertices that are not wall
// quads (cornices share the masonry buffer) get a one-metre blank stone
// wall, which the shader draws as trim with no windows.
//
// 8 floats, 32 bytes per vertex, on the masonry and glass buffers only.
// city-mesh-physical.test.ts measures the total on the real tile.
import type { Three } from '@acme/ui/three';
import type { BufferGeometry } from 'three/webgpu';
import type { BuildingFacade } from './class-family.ts';

/** Slop WALL_KINDS: the treatment of one wall. */
export const WALL_KINDS = { shop: 0, entry: 1, rear: 2, lotLine: 3, blankStone: 4 } as const;
export type WallKind = (typeof WALL_KINDS)[keyof typeof WALL_KINDS];

export const FACADE_WALL_ATTRIBUTE = 'aFacadeWall';
export const FACADE_GRID_ATTRIBUTE = 'aFacadeGrid';
/** Floats per vertex across both attributes. */
export const FACADE_FLOATS_PER_VERTEX = 8;

/** Corner piers are packed under 4 m so the family index survives in the same float. */
const PIER_PACK = 4;

/** Pack a masonry family index and a corner pier (m, < 4) into one float. */
export function packFamilyPier(masonryIndex: number, cornerPier: number): number {
  return Math.max(0, masonryIndex) * PIER_PACK + Math.min(PIER_PACK - 0.01, Math.max(0, cornerPier));
}

const PAD_WALL = [0, 1, 1, WALL_KINDS.blankStone] as const;

/** One writer per city-mesh VertexBuffer; it keeps its arrays in step with the buffer's vertex count. */
export class FacadeAttributeWriter {
  private wall: Float32Array;
  private grid: Float32Array;
  private count = 0;
  private cur: [number, number, number, number] = [3.5, 2.4, 0.5, 0];

  constructor(capacity = 1024) {
    this.wall = new Float32Array(4 * Math.max(16, capacity));
    this.grid = new Float32Array(4 * Math.max(16, capacity));
  }

  get vertexCount(): number { return this.count; }
  get walls(): Float32Array { return this.wall.subarray(0, this.count * 4); }
  get grids(): Float32Array { return this.grid.subarray(0, this.count * 4); }

  /** Start a building: vertices written since the last call keep the previous building's grid. */
  building(facade: BuildingFacade, bufferVertexCount: number): void {
    this.padTo(bufferVertexCount);
    this.cur = [facade.floorHeight, facade.windowWidth, facade.seedTone, packFamilyPier(facade.masonryIndex, facade.cornerPier)];
  }

  /**
   * The six vertices city-mesh's emitWalls just wrote for one wall quad
   * (a, b, c, a, c, d with a and d at the start corner). `bufferVertexCount`
   * is the buffer's count after the quad.
   */
  wallQuad(bufferVertexCount: number, length: number, height: number, kind: WallKind): void {
    this.padTo(bufferVertexCount - 6);
    for (const along of [0, length, length, 0, length, 0]) this.push(along, length, height, kind);
  }

  /** Pad to the buffer's final count; call before attach. */
  finish(bufferVertexCount: number): void {
    this.padTo(bufferVertexCount);
  }

  attach(THREE: Three, geometry: BufferGeometry): void {
    const n = geometry.getAttribute('position').count;
    if (n !== this.count) throw new Error(`facade attributes cover ${this.count} vertices, geometry has ${n}`);
    geometry.setAttribute(FACADE_WALL_ATTRIBUTE, new THREE.BufferAttribute(this.wall.slice(0, n * 4), 4));
    geometry.setAttribute(FACADE_GRID_ATTRIBUTE, new THREE.BufferAttribute(this.grid.slice(0, n * 4), 4));
  }

  private padTo(target: number): void {
    while (this.count < target) this.push(PAD_WALL[0], PAD_WALL[1], PAD_WALL[2], PAD_WALL[3]);
  }

  private push(along: number, width: number, height: number, kind: number): void {
    if ((this.count + 1) * 4 > this.wall.length) {
      const grow = (a: Float32Array) => { const b = new Float32Array(a.length * 2); b.set(a); return b; };
      this.wall = grow(this.wall);
      this.grid = grow(this.grid);
    }
    const i = this.count * 4;
    this.wall[i] = along; this.wall[i + 1] = width; this.wall[i + 2] = height; this.wall[i + 3] = kind;
    this.grid[i] = this.cur[0]; this.grid[i + 1] = this.cur[1]; this.grid[i + 2] = this.cur[2]; this.grid[i + 3] = this.cur[3];
    this.count++;
  }
}
