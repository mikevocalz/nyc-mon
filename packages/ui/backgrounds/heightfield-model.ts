import { brand } from '@acme/theme';
import type { NeonColorInput, Rgba } from '../neon/colors.ts';
import { skyBands, THEMES, type District } from '../district/index.ts';
import { mixRgba, rgba, type Layer, type Pointer } from './quad-writer.ts';
import { paintSky } from './skyline-model.ts';

export interface HeightfieldOptions {
  district: District;
  /** NeonBlade name: tallest-block accent (roof caps). */
  lineColor: NeonColorInput;
  bgColor: string;
  waveAmplitude: number;
  waveFrequency: number;
  waveSpeed: number;
  /** Pointer lift radius, in blocks. */
  bumpRadius: number;
  /** Pointer lift height, in floors x 4. */
  bumpStrength: number;
  /** Blocks across the near edge. */
  gridSegments: number;
  /** NeonBlade name: higher camera, lower horizon. */
  cameraHeight: number;
  fog: boolean;
  hoverEffect: boolean;
  windowLights: boolean;
}

/** Floors per block of height; heights snap to whole floors, so blocks step. */
export const FLOORS_PER_BLOCK = 4;

const PROFILE: Record<District, { base: number; peak: number; centre: number }> = {
  downtown: { base: 0.5, peak: 2.6, centre: 1.4 },
  midtown: { base: 0.6, peak: 1.8, centre: 0.6 },
  harlem: { base: 0.3, peak: 0.6, centre: 0 },
  megacity: { base: 1.1, peak: 3.2, centre: 0.8 },
};

/**
 * Height of the block at world (X, Z), in blocks, snapped to floors. A slow
 * swell rolls through the district's own height profile, and the pointer
 * lifts the blocks under it.
 */
export function blockHeight(o: Pick<HeightfieldOptions, 'district' | 'waveAmplitude' | 'waveFrequency' | 'waveSpeed' | 'bumpRadius' | 'bumpStrength'>, X: number, Z: number, time: number, lift: { x: number; z: number } | null): number {
  const p = PROFILE[o.district];
  const f = o.waveFrequency * 0.22;
  const wave = 0.5 + 0.5 * Math.sin(X * f + time * o.waveSpeed) * Math.cos(Z * f * 0.8 - time * o.waveSpeed * 0.7);
  const ridge = Math.exp(-(X * X) / 40) * p.centre;
  let h = p.base + wave * p.peak * o.waveAmplitude + ridge;
  // Harlem: occasional project slabs standing over the rows.
  if (o.district === 'harlem' && (((Math.round(X) * 7 + Math.round(Z) * 13) % 11) + 11) % 11 === 0) h += 1.6;
  if (lift) {
    const d2 = (X - lift.x) ** 2 + (Z - lift.z) ** 2;
    h += o.bumpStrength * 0.6 * Math.exp(-d2 / Math.max(0.5, o.bumpRadius * o.bumpRadius * 0.5));
  }
  return Math.max(1, Math.round(h * FLOORS_PER_BLOCK)) / FLOORS_PER_BLOCK;
}

/**
 * A stepped city heightfield in perspective: rows of solid blocks rising and
 * falling like terrain, each block a lit front facade, a shaded inner side
 * and a roof. Painted far to near and outside in, so nearer blocks cover
 * the ones behind. The port of NeonBlade UI's Holographic Terrain.
 */
export function heightfieldLayers(o: HeightfieldOptions): Layer[] {
  const theme = THEMES[o.district];
  const bands = skyBands({ ...theme, sky: [o.bgColor, ...theme.sky.slice(2)] }, 5);
  const fogColor = rgba(bands[bands.length - 1]!);
  const bodies = theme.bodies.map((b) => rgba(b));
  const night = rgba(brand.night);
  const white = rgba(brand.white);
  const accent = rgba(o.lineColor);
  const light = rgba(theme.light);

  const sky: Layer = {
    static: true,
    paint(w, f) {
      const horizonY = f.height * Math.max(0.06, Math.min(0.42, 0.36 - o.cameraHeight * 0.018));
      paintSky(w, f.width, horizonY + 1, bands);
      w.rect(0, horizonY, f.width, f.height - horizonY, rgba(theme.ground));
    },
  };

  const field: Layer = {
    paint(w, f) {
      const horizonY = f.height * Math.max(0.06, Math.min(0.42, 0.36 - o.cameraHeight * 0.018));
      const focal = f.height;
      const cx = f.width / 2;
      const N = Math.max(4, o.gridSegments);
      // Near edge spans the width with N blocks; the camera height follows.
      const zNear = (N * focal) / f.width;
      const camH = ((f.height - horizonY) * zNear) / focal;
      const zFar = zNear + Math.min(zNear * 4, 80);
      const gap = 0.14;
      const project = (X: number, Z: number, h: number): [number, number] => [cx + (X * focal) / Z, horizonY + ((camH - h) * focal) / Z];
      // Pointer to a ground position, for the lift.
      let lift: { x: number; z: number } | null = null;
      const pointer: Pointer = f.pointer;
      if (o.hoverEffect && pointer.inside && pointer.y > horizonY + 2) {
        const z = (camH * focal) / (pointer.y - horizonY);
        lift = { x: ((pointer.x - cx) * z) / focal, z };
      }
      const rows = Math.ceil(zFar - zNear);
      for (let r = rows; r >= 0; r--) {
        const Z0 = zNear + r;
        const Z1 = Z0 + 1;
        const fog = o.fog ? Math.min(1, ((Z0 - zNear) / (zFar - zNear)) ** 1.1) : 0;
        const half = Math.ceil((f.width / 2) * (Z1 / focal)) + 1;
        // Outside in: left edge to centre, right edge to centre.
        const order: number[] = [];
        for (let X = -half; X < 0; X++) order.push(X);
        for (let X = half - 1; X >= 0; X--) order.push(X);
        for (const X of order) {
          const h = blockHeight(o, X + 0.5, Z0 + 0.5, f.time, lift);
          const x0 = X + gap;
          const x1 = X + 1 - gap;
          const z0 = Z0 + gap;
          const z1 = Z1 - gap;
          const body = bodies[(((X * 3 + r * 5) % bodies.length) + bodies.length) % bodies.length]!;
          const shade = (c: Rgba, t: number) => mixRgba(mixRgba(c, t > 0 ? white : night, Math.abs(t)), fogColor, fog);
          const tall = h >= 2.2;
          // Inner side face: visible on the side facing the centre line.
          if (x1 <= 0 || x0 >= 0) {
            const sx = x1 <= 0 ? x1 : x0;
            const a = project(sx, z1, h);
            const b = project(sx, z0, h);
            const c = project(sx, z0, 0);
            const d = project(sx, z1, 0);
            w.quad(a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1], shade(body, -0.4));
          }
          // Front facade with windows, one row per floor.
          const fa = project(x0, z0, h);
          const fb = project(x1, z0, h);
          const fc = project(x1, z0, 0);
          const fd = project(x0, z0, 0);
          const floors = Math.round(h * FLOORS_PER_BLOCK);
          const lit = o.windowLights ? 0.4 * (1 - fog) : 0;
          w.facadeQuad([fa[0], fa[1], fb[0], fb[1], fc[0], fc[1], fd[0], fd[1]], shade(body, 0), fb[0] - fa[0] > 14 ? 3 : 0, floors, X * 31 + r * 17, lit, mixRgba(light, fogColor, fog * 0.7));
          // Roof, seen from above while the block is below the camera.
          if (h < camH) {
            const ra = project(x0, z1, h);
            const rb = project(x1, z1, h);
            w.quad(ra[0], ra[1], rb[0], rb[1], fb[0], fb[1], fa[0], fa[1], tall ? mixRgba(accent, fogColor, fog) : shade(body, 0.22));
          }
        }
      }
    },
  };

  return [sky, field];
}
