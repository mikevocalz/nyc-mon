'use client';

import { useMemo } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import { useLayoutSize } from '../use-layout-size';
import { View } from '../tw';
import { QuadWriter, type Layer, type Pointer } from './quad-writer';
import { appendQuads, MeshBuilder } from './skia-mesh';
import { QUAD_WINDOW } from './skia-quad-shader';
import { fallbackPixelRatio, SkiaQuadCanvas, type SkiaStep } from './SkiaQuadCanvas';

export interface QuadSceneSkiaProps {
  layers: readonly Layer[];
  /** Background fill as a CSS colour. */
  background: string;
  pointer: StoreApi<Pointer>;
  /** Advance time (false under reduced motion or for still scenes). */
  running: boolean;
}

/**
 * Consecutive static layers become one tessellated mesh, built here once
 * per size; consecutive moving layers become one paint step that the
 * canvas reruns per frame outside React.
 */
function buildSteps(layers: readonly Layer[], width: number, height: number, pointer: StoreApi<Pointer>, feather: number): SkiaStep[] {
  const runs: { layers: Layer[]; static: boolean }[] = [];
  for (const layer of layers) {
    const last = runs[runs.length - 1];
    if (last && last.static === !!layer.static) last.layers.push(layer);
    else runs.push({ layers: [layer], static: !!layer.static });
  }
  return runs.map((run): SkiaStep => {
    const writer = new QuadWriter();
    const paintRun = (mesh: MeshBuilder, time: number) => {
      writer.reset();
      const frame = { width, height, time, pointer: pointer.getState() };
      for (const layer of run.layers) layer.paint(writer, frame);
      appendQuads(mesh, writer.data, writer.count, feather);
    };
    if (!run.static) return { paint: paintRun, animated: true };
    const mesh = new MeshBuilder();
    paintRun(mesh, 0);
    return { chunks: mesh.finish() };
  });
}

/**
 * Skia fallback for every solid background, used where WebGPU is missing.
 * Draws the same quads as the TypeGPU scene: static layers are tessellated
 * once, moving layers per frame outside React, and the per-pixel parts
 * (window twinkle, glows, vignette) run in an SkSL shader. See
 * SkiaQuadCanvas for the frame loop.
 */
export default function QuadSceneSkia({ layers, background, pointer, running }: QuadSceneSkiaProps) {
  const { size, onLayout } = useLayoutSize();
  const { width, height } = size;
  const steps = useMemo(() => buildSteps(layers, width, height, pointer, 1 / fallbackPixelRatio()), [layers, width, height, pointer]);
  return (
    <View aria-hidden className="pointer-events-none absolute inset-0" onLayout={onLayout}>
      <SkiaQuadCanvas
        steps={steps}
        width={width}
        height={height}
        background={background}
        running={running}
        windowRect={QUAD_WINDOW}
        invalidate={pointer}
      />
    </View>
  );
}
