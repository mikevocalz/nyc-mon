// Adapted from mrdoob/slop-newyork @ be65d0a, js/tsl-materials.js canyonSkyAONode (MIT, © 2026 Mr.doob)
//
// Street-canyon sky visibility for the material aoNode: the sky closes in
// near the street floor and opens with height. Slop also opens it inside
// Central Park through hard-coded bounds (city-config.js
// CENTRAL_PARK_BOUNDS). That geography does not exist here, so the open-sky
// term is driven by the tile's own area polygons instead: park, garden,
// grass, pitch, playground, plaza, parking and water areas (city-dataset.ts
// AREA_KINDS) are rasterised into a small grid, box-blurred to Slop's
// 10–30 m edge ramps, and sampled by world x/z. Without a grid the term is
// left out and the AO is Slop's canyon term alone.
import type { Three } from '@acme/ui/three';
import { looseTsl, type TslNode } from './loose-tsl.ts';
import type { AreaKind, CityArea } from '../../city-dataset.ts';
import { pairs, pointInRing } from '../geometry.ts';
import { CANYON_AO, OPEN_SKY_GRID } from '../physical-materials-constants.ts';

/** Area kinds with nothing overhead: the sky opens over them like Slop's Central Park. */
export const OPEN_SKY_KINDS: ReadonlySet<AreaKind> = new Set([
  'park', 'garden', 'grass', 'pitch', 'playground', 'plaza', 'parking', 'water',
]);

/** Open-sky share per grid cell, 0..1, row-major from (minX, minZ). Pure data: no three, no DOM. */
export interface OpenSkyGrid {
  minX: number;
  minZ: number;
  cellMeters: number;
  width: number;
  height: number;
  values: Uint8Array;
}

/**
 * Rasterise the open area kinds over a square tile of half-size `extentMeters`
 * (cell centres tested against each ring, holes cut out), then box-blur.
 */
export function bakeOpenSkyGrid(
  areas: readonly CityArea[], extentMeters: number,
  cellMeters: number = OPEN_SKY_GRID.cellMeters, blurCells: number = OPEN_SKY_GRID.blurCells,
): OpenSkyGrid {
  const size = Math.max(1, Math.ceil((extentMeters * 2) / cellMeters));
  const minX = -extentMeters;
  const minZ = -extentMeters;
  const mask = new Float32Array(size * size);
  for (const area of areas) {
    if (!OPEN_SKY_KINDS.has(area.kind)) continue;
    const ring = pairs(area.ring);
    const holes = area.holes.map((h) => pairs(h));
    let x0 = Infinity; let x1 = -Infinity; let z0 = Infinity; let z1 = -Infinity;
    for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const i0 = Math.max(0, Math.floor((x0 - minX) / cellMeters)); const i1 = Math.min(size - 1, Math.floor((x1 - minX) / cellMeters));
    const j0 = Math.max(0, Math.floor((z0 - minZ) / cellMeters)); const j1 = Math.min(size - 1, Math.floor((z1 - minZ) / cellMeters));
    for (let j = j0; j <= j1; j++) {
      const cz = minZ + (j + 0.5) * cellMeters;
      for (let i = i0; i <= i1; i++) {
        const cx = minX + (i + 0.5) * cellMeters;
        if (pointInRing(cx, cz, ring) && !holes.some((h) => pointInRing(cx, cz, h))) mask[j * size + i] = 1;
      }
    }
  }
  const blurred = blurCells > 0 ? boxBlur(boxBlur(mask, size, blurCells, 1), size, blurCells, size) : mask;
  const values = new Uint8Array(size * size);
  for (let k = 0; k < values.length; k++) values[k] = Math.round(Math.max(0, Math.min(1, blurred[k]!)) * 255);
  return { minX, minZ, cellMeters, width: size, height: size, values };
}

/** One separable box-blur pass of radius `r` along a stride (1 = rows, size = columns), clamped at the edges. */
function boxBlur(src: Float32Array, size: number, r: number, stride: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let line = 0; line < size; line++) {
    // Rows start every `size` texels and step by 1; columns start every texel and step by `size`.
    const base = stride === 1 ? line * size : line;
    for (let k = 0; k < size; k++) {
      let sum = 0;
      for (let d = -r; d <= r; d++) {
        const kk = Math.max(0, Math.min(size - 1, k + d));
        sum += src[base + kk * stride]!;
      }
      out[base + k * stride] = sum / (2 * r + 1);
    }
  }
  return out;
}

/** The grid as a single-channel, linearly filtered DataTexture (no canvas, no DOM). */
export function openSkyTexture(THREE: Three, grid: OpenSkyGrid): InstanceType<Three['DataTexture']> {
  const texture = new THREE.DataTexture(grid.values, grid.width, grid.height, THREE.RedFormat, THREE.UnsignedByteType);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** What canyonSkyAO needs to open the sky over areas: the texture and the grid it was built from. */
export interface OpenSkyInput {
  texture: InstanceType<Three['DataTexture']>;
  grid: Pick<OpenSkyGrid, 'minX' | 'minZ' | 'cellMeters' | 'width' | 'height'>;
}

/**
 * Slop canyonSkyAONode with the park term from the area grid, or without it
 * when `openSky` is absent.
 */
export function canyonSkyAO(THREE: Three, openSky?: OpenSkyInput): TslNode {
  const T = looseTsl(THREE);
  const wp = T.positionWorld;
  const heightOpenness = T.smoothstep(0.0, CANYON_AO.openHeight, wp.y);
  const streetCrevice = T.smoothstep(0.0, CANYON_AO.creviceHeight, wp.y).mul(1 - CANYON_AO.creviceFloor).add(CANYON_AO.creviceFloor);
  const canyonAO = T.mix(T.float(CANYON_AO.streetFloor), T.float(1.0), heightOpenness).mul(streetCrevice);
  if (!openSky) return canyonAO;
  const { grid } = openSky;
  const uv = T.vec2(
    wp.x.sub(grid.minX).div(grid.cellMeters * grid.width),
    wp.z.sub(grid.minZ).div(grid.cellMeters * grid.height),
  );
  const open = T.texture(openSky.texture, uv).r;
  return T.mix(canyonAO, T.float(1.0), open);
}
