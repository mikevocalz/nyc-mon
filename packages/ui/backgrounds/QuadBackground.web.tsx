'use client';

import type { QuadSceneSkiaProps } from './QuadScene.skia';
import { QuadBackgroundShell, type QuadBackgroundProps } from './QuadBackground.shared';
import { SkiaWebGate } from './SkiaWebGate';

const loadSkia = () => import('./QuadScene.skia');

// Web: the Skia fallback needs CanvasKit, so it loads through SkiaWebGate and
// only when WebGPU is missing (or forced off).
const renderFallback = (props: QuadSceneSkiaProps) => <SkiaWebGate load={loadSkia} props={props} />;

export function QuadBackground(props: QuadBackgroundProps) {
  return <QuadBackgroundShell {...props} renderFallback={renderFallback} />;
}
