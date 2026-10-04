import type { CityBlocksProps } from './CityBlocks.types';
import CityBlocksSkia, { type CityBlocksSkiaProps } from './CityBlocks.skia';
import { CityBlocksShell } from './CityBlocks.shared';

// Native: Skia is linked in, so the fallback renders directly.
const renderFallback = (props: CityBlocksSkiaProps) => <CityBlocksSkia {...props} />;

export function CityBlocks(props: CityBlocksProps) {
  return <CityBlocksShell {...props} renderFallback={renderFallback} />;
}
