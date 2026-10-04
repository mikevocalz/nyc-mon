import { Skia, type SkRuntimeEffect } from 'react-native-skia';
import { LIT_BAND, LIT_LEVELS } from './skia-mesh';

/**
 * The per-pixel half of the Skia fallback, the SkSL twin of the TypeGPU
 * fragment shaders (QuadScene.gpu.ts, CityBlocks.gpu.ts). It shades the
 * meshes from skia-mesh.ts, reading everything from the texture coordinate
 * (the bands are documented there), and is drawn with BlendMode.Modulate so
 * it multiplies the vertex colour:
 *
 * - solids return 1;
 * - a window overlay returns 1 on a lit window (vertex colour = the light),
 *   black at 0.45 on an unlit one (darkening the facade to 0.55, as the GPU
 *   does) and nothing between windows. Lights flip on the same hash clock
 *   as the GPU path, so `time` is the only per-frame input;
 * - glow, core and vignette quads return their falloff.
 *
 * `win` is the lit window's rect inside its cell: x0, x1, y0, y1.
 */
export const QUAD_SKSL = `
uniform float time;
uniform float4 win;

float hash2(float2 v) {
  return fract(sin(dot(v, float2(12.9898, 78.233))) * 43758.5453);
}

half4 main(float2 t) {
  if (t.y >= -0.5) {
    float band = floor(t.y / ${LIT_BAND.toFixed(1)});
    float2 grid = float2(t.x, t.y - band * ${LIT_BAND.toFixed(1)});
    float2 cell = floor(grid);
    float2 local = grid - cell;
    if (local.x < win.x || local.x > win.y || local.y < win.z || local.y > win.w) {
      return half4(0.0);
    }
    float epoch = floor(time * 0.15 + hash2(cell + float2(0.0, 3.7)) * 9.0);
    float lit = hash2(cell + float2(0.0, epoch * 0.37)) <= band / ${LIT_LEVELS.toFixed(1)} ? 1.0 : 0.0;
    return lit > 0.5 ? half4(1.0) : half4(0.0, 0.0, 0.0, 0.45);
  }
  if (t.y > -1.5) {
    return half4(1.0);
  }
  if (t.y > -10.5) {
    float d = distance(float2(t.x, t.y + 10.0), float2(0.5)) * 2.0;
    float core = 1.0 - smoothstep(0.1, 0.32, d);
    float halo = exp(-d * d * 5.0) * 0.5;
    return half4(clamp(core + halo, 0.0, 1.0));
  }
  if (t.y > -20.5) {
    float d = distance(float2(t.x, t.y + 20.0), float2(0.5)) * 2.0;
    return half4(1.0 - smoothstep(0.1, 0.32, d));
  }
  if (t.y > -30.5) {
    float2 uv = float2(t.x, t.y + 30.0);
    float radial = smoothstep(0.42, 0.8, distance(uv, float2(0.5)));
    float vertical = max(smoothstep(0.62, 1.05, uv.y), smoothstep(0.3, -0.05, uv.y) * 0.8);
    return half4(clamp(max(radial, vertical), 0.0, 1.0));
  }
  float2 uv = float2(t.x, t.y + 40.0);
  float radial = smoothstep(0.42, 0.8, distance(uv, float2(0.5)));
  float vertical = max(smoothstep(0.6, 1.05, uv.y), smoothstep(0.32, -0.05, uv.y) * 0.8);
  return half4(clamp(max(radial, vertical), 0.0, 1.0));
}
`;

/** Window rect of the solid backgrounds (QuadScene.gpu.ts). */
export const QUAD_WINDOW: readonly [number, number, number, number] = [0.2, 0.8, 0.24, 0.76];
/** Window rect of CityBlocks (CityBlocks.gpu.ts). */
export const CITY_WINDOW: readonly [number, number, number, number] = [0.22, 0.78, 0.28, 0.74];

let effect: SkRuntimeEffect | null = null;

/** Compiled once per JS runtime, after Skia (CanvasKit on web) is loaded. */
export function quadEffect(): SkRuntimeEffect {
  if (!effect) {
    effect = Skia.RuntimeEffect.Make(QUAD_SKSL);
    if (!effect) throw new Error('[skia-quad-shader] SkSL failed to compile.');
  }
  return effect;
}
