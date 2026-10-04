'use client';

import { SkiaWebGate } from '../backgrounds/SkiaWebGate';
import type { FaceCanvasProps } from './face.skia';

const loadSkia = () => import('./face.skia');

/** Web: the face loads behind CanvasKit (SkiaWebGate). */
export function Face(props: FaceCanvasProps) {
  return <SkiaWebGate load={loadSkia} props={props} />;
}
