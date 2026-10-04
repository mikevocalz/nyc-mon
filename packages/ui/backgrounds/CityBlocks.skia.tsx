'use client';

import { useMemo } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import { useLayoutSize } from '../use-layout-size';
import { View } from '../tw';
import { blockAt, buildCity, hoverQuad, trafficAt, vignetteQuad, type District } from './city-blocks-model';
import type { CityParams } from './CityBlocks.gpu';
import type { CityPointer } from './CityBlocks.types';
import { appendCityQuads, MeshBuilder } from './skia-mesh';
import { CITY_WINDOW } from './skia-quad-shader';
import { SkiaQuadCanvas, type SkiaStep } from './SkiaQuadCanvas';

export interface CityBlocksSkiaProps {
  params: CityParams;
  pointer: StoreApi<CityPointer>;
  running: boolean;
}

const tessellate = (fill: (mesh: MeshBuilder) => void) => {
  const mesh = new MeshBuilder();
  fill(mesh);
  return { chunks: mesh.finish() };
};

/**
 * Skia fallback for CityBlocks, used where WebGPU is missing. Draws the
 * same quads as the GPU scene, in the same order: the street plates, the
 * hover highlight, then every building face (tessellated once per size,
 * windows twinkling in the SkSL shader), traffic per frame and the
 * vignette on top. See SkiaQuadCanvas for the frame loop.
 */
export default function CityBlocksSkia({ params, pointer, running }: CityBlocksSkiaProps) {
  const { size, onLayout } = useLayoutSize();
  const { width, height } = size;
  const city = useMemo(() => buildCity({ ...params.city, width, height }), [params.city, width, height]);

  const steps = useMemo<SkiaStep[]>(() => {
    const out: SkiaStep[] = [tessellate((mesh) => appendCityQuads(mesh, city.quads.slice(0, city.hoverSlot), city.light))];
    if (params.hoverEffect) {
      out.push({
        animated: false,
        paint: (mesh) => {
          const s = pointer.getState();
          const hovered = s.inside ? blockAt(city, s.x, s.y) : -1;
          if (hovered >= 0) appendCityQuads(mesh, [hoverQuad(city, hovered, params.hoverColor)], city.light);
        },
      });
    }
    out.push(tessellate((mesh) => appendCityQuads(mesh, city.quads.slice(city.hoverSlot + 1), city.light)));
    if (params.traffic.density > 0) {
      out.push({
        animated: true,
        paint: (mesh, time) => appendCityQuads(mesh, trafficAt(city, params.city.district as District, time, params.traffic), city.light),
      });
    }
    if (params.overlay) out.push(tessellate((mesh) => appendCityQuads(mesh, [vignetteQuad(width, height)], city.light)));
    return out;
  }, [city, params.hoverEffect, params.hoverColor, params.traffic, params.city.district, params.overlay, pointer, width, height]);

  return (
    <View aria-hidden className="pointer-events-none absolute inset-0" onLayout={onLayout}>
      <SkiaQuadCanvas
        steps={steps}
        width={width}
        height={height}
        background={params.streetColor}
        running={running}
        windowRect={CITY_WINDOW}
        invalidate={pointer}
      />
    </View>
  );
}
