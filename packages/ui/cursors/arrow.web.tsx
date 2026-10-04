'use client';

import { SkiaWebGate } from '../backgrounds/SkiaWebGate';
import type { ArrowCanvasProps } from './arrow.skia';

const loadSkia = () => import('./arrow.skia');

/** Web: the arrow loads behind CanvasKit (SkiaWebGate). */
export function Arrow(props: ArrowCanvasProps) {
  return <SkiaWebGate load={loadSkia} props={props} />;
}
