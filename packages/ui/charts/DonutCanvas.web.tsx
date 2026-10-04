'use client';

import { SkiaWebGate } from '../backgrounds/SkiaWebGate';
import type { DonutCanvasProps } from './DonutCanvas.skia';

const loadSkia = () => import('./DonutCanvas.skia');

/** Web: the Skia drawing loads behind CanvasKit (SkiaWebGate). */
export function DonutCanvas(props: DonutCanvasProps) {
  return <SkiaWebGate load={loadSkia} props={props} />;
}
