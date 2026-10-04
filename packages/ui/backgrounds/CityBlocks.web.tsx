'use client';

import type { CityBlocksProps } from './CityBlocks.types';
import type { CityBlocksSkiaProps } from './CityBlocks.skia';
import { CityBlocksShell } from './CityBlocks.shared';
import { SkiaWebGate } from './SkiaWebGate';

const loadSkia = () => import('./CityBlocks.skia');

// Web: the Skia fallback needs CanvasKit, so it loads through SkiaWebGate and
// only when WebGPU is missing (or forced off).
const renderFallback = (props: CityBlocksSkiaProps) => <SkiaWebGate load={loadSkia} props={props} />;

export function CityBlocks(props: CityBlocksProps) {
  return <CityBlocksShell {...props} renderFallback={renderFallback} />;
}
