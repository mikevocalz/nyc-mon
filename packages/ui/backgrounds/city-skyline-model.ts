import { brand, palette } from '@acme/theme';
import { mixColor, type NeonColorInput } from '../neon/colors.ts';
import { skyBands, THEMES } from './district-theme.ts';
import { hash, rgba, type Layer, type QuadWriter } from './quad-writer.ts';
import {
  buildSkyline, paintBeacons, paintSky, paintSkyline, panoramaSpans,
  type Skyline, type SkylineDistrict,
} from './skyline-model.ts';

export interface CitySkylineOptions {
  district: SkylineDistrict;
  seed: number;
  /** Depth layers, 1 to 3. */
  depth: number;
  light: NeonColorInput;
  vehicleColor: NeonColorInput;
  beaconColor: NeonColorInput;
  /** Sky top colour override. */
  skyColor: string | null;
  windowLights: boolean;
  showVehicles: boolean;
  blinkingLights: boolean;
  speed: number;
}

interface City {
  width: number;
  height: number;
  ground: number;
  layers: { skyline: Skyline; fog: number }[];
}

/** Road height under the skyline. */
export const roadHeight = (height: number) => Math.max(10, Math.min(28, height * 0.06));

function buildCityLayers(o: CitySkylineOptions, width: number, height: number): City {
  const ground = height - roadHeight(height);
  const depth = Math.max(1, Math.min(3, Math.round(o.depth)));
  const layers: City['layers'] = [];
  const spans = (district: SkylineDistrict) =>
    district === 'all' ? panoramaSpans(width) : [{ district, x0: 0, x1: width }];
  const layer = (district: SkylineDistrict, maxHeight: number, fog: number, windowScale: number, seed: number, back = false) => {
    const parts: Skyline = { parts: [], beacons: [], top: ground };
    for (const span of spans(district)) {
      const s = buildSkyline({ ...span, ground, maxHeight, seed, windowScale, back });
      parts.parts.push(...s.parts);
      parts.beacons.push(...s.beacons);
      parts.top = Math.min(parts.top, s.top);
    }
    layers.push({ skyline: parts, fog });
  };
  // Back to front. In the panorama, Mega City looms behind the three
  // districts: the future the city grows into.
  if (depth >= 3) layer(o.district === 'all' ? 'megacity' : o.district, ground * 0.92, 0.74, 0.7, o.seed + 2, true);
  if (depth >= 2) layer(o.district, ground * 0.8, 0.44, 0.85, o.seed + 1, o.district === 'harlem');
  layer(o.district, ground * 0.66, 0, 1, o.seed);
  return { width, height, ground, layers };
}

/**
 * Layers for the CitySkyline hero: a stepped solid sky, up to three skyline
 * depths (back ones fogged into the horizon), the street, then the moving
 * parts on top: blinking beacons, street traffic and Mega City sky lanes.
 */
export function citySkylineLayers(o: CitySkylineOptions): Layer[] {
  const theme = THEMES[o.district === 'all' ? 'midtown' : o.district];
  let memo: City | null = null;
  const city = (width: number, height: number) => {
    if (!memo || memo.width !== width || memo.height !== height) memo = buildCityLayers(o, width, height);
    return memo;
  };
  const bands = o.skyColor ? skyBands({ ...theme, sky: [o.skyColor, mixColor(o.skyColor, theme.sky.at(-1)!, 0.7)] }, 7) : skyBands(theme, 7);
  const horizon = rgba(bands.at(-1)!);
  const accent = rgba(theme.accent);
  const light = rgba(o.light);

  const scenery: Layer = {
    static: true,
    paint(w, f) {
      const c = city(f.width, f.height);
      paintSky(w, f.width, c.ground, bands);
      for (const { skyline, fog } of c.layers) {
        paintSkyline(w, skyline, { fog, fogColor: horizon, light, lit: o.windowLights ? 0.34 - fog * 0.3 : 0, accent });
      }
      // The street: kerb, asphalt and a dashed centre line.
      const road = roadHeight(f.height);
      w.rect(0, c.ground, f.width, road, rgba(theme.ground));
      w.rect(0, c.ground, f.width, Math.max(2, road * 0.12), rgba(palette.ink[800]));
      const dash = rgba(theme.accent, 0.55);
      for (let x = 8; x < f.width; x += 34) w.rect(x, c.ground + road * 0.56, 16, Math.max(1.5, road * 0.07), dash);
    },
  };

  const moving: Layer = {
    paint(w: QuadWriter, f) {
      const c = city(f.width, f.height);
      const beacon = rgba(o.beaconColor);
      c.layers.forEach(({ skyline, fog }) =>
        paintBeacons(w, skyline, [beacon[0], beacon[1], beacon[2], 1 - fog * 0.6], f.time, o.blinkingLights, 7 - fog * 4));
      if (!o.showVehicles) return;
      const road = roadHeight(f.height);
      const t = f.time * o.speed;
      // Street traffic: headlights heading east in the near lane, taillights west.
      const cars = Math.max(3, Math.floor(f.width / 110));
      const body = rgba(palette.ink[800]);
      const head = rgba(brand.white);
      const tail = rgba(palette.apple[400]);
      for (let i = 0; i < cars; i++) {
        const east = i % 2 === 0;
        const v = 60 + hash(i, 3) * 50;
        const span = f.width + 80;
        const x = ((hash(i, 1) * span + t * v) % span) - 40;
        const px = east ? x : f.width - x;
        const y = c.ground + road * (east ? 0.78 : 0.34);
        const len = Math.max(10, road * 0.9);
        w.round(px - len / 2, y - road * 0.13, len, road * 0.26, body, road * 0.08);
        const lx = east ? px + len / 2 : px - len / 2;
        w.glow(lx, y, road * 0.55, east ? withAlpha(head, 0.8) : withAlpha(tail, 0.8));
      }
      // Sky lanes: Mega City's flying traffic, in front of the back layer.
      if (o.district !== 'megacity' && o.district !== 'all') return;
      const vehicle = rgba(o.vehicleColor);
      const lanes = [c.ground * 0.32, c.ground * 0.46, c.ground * 0.58];
      lanes.forEach((ly, lane) => {
        const dir = lane % 2 === 0 ? 1 : -1;
        const count = 2 + lane;
        for (let i = 0; i < count; i++) {
          const v = 90 + hash(i, lane, 7) * 70;
          const span = f.width + 120;
          const x = ((hash(i, lane) * span + t * v) % span) - 60;
          const px = dir > 0 ? x : f.width - x;
          const len = 16;
          w.streak(px - dir * 46, ly, px - dir * len * 0.5, ly, 3, withAlpha(vehicle, 0.45), 0);
          w.round(px - len / 2, ly - 3, len, 6, rgba(palette.royal[800]), 3);
          w.glow(px + (dir * len) / 2, ly, 7, withAlpha(vehicle, 0.9));
        }
      });
    },
  };

  return [scenery, moving];
}

function withAlpha(c: readonly number[], a: number): [number, number, number, number] {
  return [c[0]!, c[1]!, c[2]!, c[3]! * a];
}
