import QuadSceneSkia, { type QuadSceneSkiaProps } from './QuadScene.skia';
import { QuadBackgroundShell, type QuadBackgroundProps } from './QuadBackground.shared';

// Native: Skia is linked in, so the fallback renders directly.
const renderFallback = (props: QuadSceneSkiaProps) => <QuadSceneSkia {...props} />;

export function QuadBackground(props: QuadBackgroundProps) {
  return <QuadBackgroundShell {...props} renderFallback={renderFallback} />;
}
