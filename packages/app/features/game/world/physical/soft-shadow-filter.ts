// The sun shadow filter for the physical lane: a fixed 3x3 tent of
// hardware-compared taps, in place of three@0.186.1's PCFShadowFilter.
//
// Why: three's PCF (src/nodes/lighting/ShadowFilterNode.js) takes 5 Vogel-disk
// taps rotated per pixel by interleaved gradient noise. With no TAA to
// average the rotation away, every partly lit pixel lands on a different
// fraction of 5, so a shadow whose edge is busy reads as a dot screen. The
// tree canopy is all edge: alpha-cut leaf cards at shadow-map resolution, so
// the crowns' shadows on the road came out dithered (iPad, 2026-10-28).
//
// Here every pixel takes the same nine taps, 1-2-1 weighted, `radius` atlas
// texels apart. Each tap is a comparison sample, which the depth texture's
// LinearFilter turns into a 2x2 bilinear PCF in hardware (SunShadowNode sets
// that when the backend supports texture compare), so the result is a smooth
// gradient over about 2 * radius + 2 texels with no noise. Cost: 9 taps for
// the cascade a fragment falls in, against 5.
//
// SunShadowNode insets each cascade tile by ceil(radius) + 1 texels so a
// filter cannot read a neighbour tile; the outermost tap here sits at exactly
// `radius` texels plus the one-texel bilinear footprint, inside that inset.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';

/** Tap spacing, shadow-atlas texels (LightShadow.radius): the stock PCF's footprint (radius 1), so the receiver bias it was tuned with still holds. */
export const SOFT_SHADOW_RADIUS = 1;

/** The 1-2-1 tent's taps as [dx, dy, weight]; the weights sum to 16. */
export const SOFT_SHADOW_TAPS: readonly (readonly [number, number, number])[] = [
  [-1, -1, 1], [0, -1, 2], [1, -1, 1],
  [-1, 0, 2], [0, 0, 4], [1, 0, 2],
  [-1, 1, 1], [0, 1, 2], [1, 1, 1],
];

interface FilterInputs {
  readonly depthTexture: { readonly isArrayTexture?: boolean };
  readonly shadowCoord: Node<'vec3'>;
  readonly shadow: object;
  readonly depthLayer?: unknown;
}

type Loose = {
  Fn(body: (inputs: FilterInputs) => unknown): unknown;
  texture(t: unknown, uv: unknown): { depth(layer: unknown): unknown; compare(z: unknown): unknown };
  reference(name: string, type: string, object: object): { setGroup(group: unknown): unknown };
  renderGroup: unknown;
  vec2(...a: unknown[]): { div(v: unknown): { mul(v: unknown): unknown } };
  float(v: number): unknown;
};
type N = { add(v: unknown): N; mul(v: unknown): N; xy: N; z: N };

/** A `LightShadow.filterNode` for SunLight (and a plain DirectionalLight): the noise-free 3x3 tent above. */
export function createSoftShadowFilter(THREE: Three): unknown {
  const T = THREE.TSL as unknown as Loose;
  return T.Fn(({ depthTexture, shadowCoord, shadow, depthLayer }) => {
    const coord = shadowCoord as unknown as N;
    const mapSize = T.reference('mapSize', 'vec2', shadow).setGroup(T.renderGroup);
    const radius = T.reference('radius', 'float', shadow).setGroup(T.renderGroup);
    const step = T.vec2(1).div(mapSize).mul(radius) as N;
    const tap = (dx: number, dy: number) => {
      const uv = dx === 0 && dy === 0 ? coord.xy : coord.xy.add(step.mul(T.vec2(dx, dy)));
      const sample = T.texture(depthTexture, uv);
      const depth = depthTexture.isArrayTexture ? (sample.depth(depthLayer) as typeof sample) : sample;
      return depth.compare(coord.z) as N;
    };
    let sum: N | null = null;
    for (const [dx, dy, w] of SOFT_SHADOW_TAPS) {
      const term = w === 1 ? tap(dx, dy) : tap(dx, dy).mul(w);
      sum = sum === null ? term : sum.add(term);
    }
    return sum!.mul(1 / 16);
  });
}
