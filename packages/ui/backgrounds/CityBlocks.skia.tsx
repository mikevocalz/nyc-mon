'use client';

import { useMemo } from 'react';
import {
  BlurMask, Canvas, Fill, Group, LinearGradient, Points, RadialGradient, Rect, vec, Vertices,
} from 'react-native-skia';
import type { StoreApi } from 'zustand/vanilla';
import { brand } from '@acme/theme';
import { withAlpha } from '../neon/colors';
import { useStore } from '../use-instance-store';
import { useLayoutSize } from '../use-layout-size';
import { View } from '../tw';
import {
  blockAt, buildCity, hoverQuad, litWindows, QuadKind, trafficAt,
  type CityLayout, type District, type Quad,
} from './city-blocks-model';
import type { CityParams } from './CityBlocks.gpu';
import type { CityPointer } from './CityBlocks.types';
import { useFrameTime } from './use-frame-time';

export interface CityBlocksSkiaProps {
  params: CityParams;
  pointer: StoreApi<CityPointer>;
  running: boolean;
}

const rgba = ([r, g, b, a]: Quad['color']) =>
  `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;

/** All solid quads as one triangle list with per-vertex colours. */
function triangles(quads: Quad[]) {
  const vertices: { x: number; y: number }[] = [];
  const colors: string[] = [];
  for (const q of quads) {
    if (q.win[0] === QuadKind.GLOW || q.win[0] === QuadKind.VIGNETTE || q.color[3] === 0) continue;
    const [ax, ay, bx, by, cx, cy, dx, dy] = q.p;
    const c = rgba(q.color);
    vertices.push(vec(ax, ay), vec(bx, by), vec(cx, cy), vec(ax, ay), vec(cx, cy), vec(dx, dy));
    for (let i = 0; i < 6; i++) colors.push(c);
  }
  return { vertices, colors };
}

function Traffic({ city, params, running }: { city: CityLayout; params: CityParams; running: boolean }) {
  const time = useFrameTime(running);
  const cars = trafficAt(city, params.city.district as District, time, params.traffic);
  const byColor = new Map<string, { x: number; y: number }[]>();
  for (const car of cars) {
    const key = rgba(car.color);
    const list = byColor.get(key) ?? [];
    list.push(vec((car.p[0] + car.p[2]) / 2, (car.p[1] + car.p[5]) / 2));
    byColor.set(key, list);
  }
  return (
    <>
      {[...byColor].map(([color, points]) => (
        <Group key={color}>
          <Points points={points} mode="points" color={color} strokeWidth={7} strokeCap="round" opacity={0.5}>
            <BlurMask blur={4} style="normal" />
          </Points>
          <Points points={points} mode="points" color={color} strokeWidth={2.6} strokeCap="round" />
        </Group>
      ))}
    </>
  );
}

/**
 * Skia fallback for CityBlocks, used where WebGPU is missing. Draws the same
 * city as the GPU scene from the same model: one Vertices call for every
 * solid face, Points for the lit windows (static here; the GPU path
 * twinkles them), and blurred Points for traffic. Roof bevels are left out.
 */
export default function CityBlocksSkia({ params, pointer, running }: CityBlocksSkiaProps) {
  const { size, onLayout } = useLayoutSize();
  const { width, height } = size;
  const city = useMemo(() => buildCity({ ...params.city, width, height }), [params.city, width, height]);
  const solid = useMemo(() => triangles(city.quads), [city]);
  const windows = useMemo(() => litWindows(city).map((p) => vec(p.x, p.y)), [city]);
  const hovered = useStore(pointer, (s) => (params.hoverEffect && s.inside ? blockAt(city, s.x, s.y) : -1));
  const hover = hovered >= 0 ? hoverQuad(city, hovered, params.hoverColor) : null;

  return (
    <View aria-hidden className="pointer-events-none absolute inset-0" onLayout={onLayout}>
      {/* Skia surface: Canvas takes a style, not a className. */}
      <Canvas style={{ flex: 1 }}>
        <Fill color={params.streetColor} />
        {hover ? (
          <Rect x={hover.p[0]} y={hover.p[1]} width={hover.p[2] - hover.p[0]} height={hover.p[5] - hover.p[1]} color={rgba(hover.color)} />
        ) : null}
        {solid.vertices.length ? <Vertices vertices={solid.vertices} colors={solid.colors} mode="triangles" /> : null}
        {windows.length ? (
          <Points points={windows} mode="points" color={rgba(city.light)} strokeWidth={1.6} strokeCap="square" />
        ) : null}
        {params.traffic.density > 0 ? <Traffic city={city} params={params} running={running} /> : null}
        {params.overlay ? (
          <>
            <Rect x={0} y={0} width={width} height={height}>
              <RadialGradient
                c={vec(width / 2, height / 2)}
                r={Math.hypot(width, height) / 2}
                colors={[withAlpha(brand.night, 0), withAlpha(brand.night, 0), withAlpha(brand.night, 1)]}
                positions={[0, 0.55, 1]}
              />
            </Rect>
            <Rect x={0} y={0} width={width} height={height}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, height)}
                colors={[withAlpha(brand.night, 0.8), withAlpha(brand.night, 0), withAlpha(brand.night, 0), withAlpha(brand.night, 1)]}
                positions={[0, 0.3, 0.6, 1]}
              />
            </Rect>
          </>
        ) : null}
      </Canvas>
    </View>
  );
}
