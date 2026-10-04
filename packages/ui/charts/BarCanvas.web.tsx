'use client';

import { SkiaWebGate } from '../backgrounds/SkiaWebGate';
import type { BarCanvasProps } from './BarCanvas.skia';

const loadSkia = () => import('./BarCanvas.skia');

/** Web: the Skia drawing loads behind CanvasKit (SkiaWebGate). */
export function BarCanvas(props: BarCanvasProps) {
  return <SkiaWebGate load={loadSkia} props={props} />;
}
