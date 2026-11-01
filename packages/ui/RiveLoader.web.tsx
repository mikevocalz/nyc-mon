'use client';
// PLATFORM FORK (web). The .riv is not drawn on web yet, matching
// game-controls/ArcadeRiveSurface.web.tsx and lobby/LobbyRiveSurface.web.tsx:
// the web Rive runtime (@rive-app/react-webgl2) is a dependency of apps/web
// and @acme/spatial, not of this package, and it loads from a `src` URL that
// no public/ path serves yet. Until both land, web shows the kit's
// CircularProgress in the scanner red so the page still says it is busy.
import { CircularProgress, type CircularProgressSize } from './progress/CircularProgress';
import { View } from './tw';
import { clampRiveLoaderProgress } from './rive-loader-bindings';
import type { RiveLoaderProps } from './RiveLoader.types';

const PRESETS: readonly (readonly [number, CircularProgressSize])[] = [
  [64, 'sm'],
  [96, 'md'],
  [128, 'lg'],
  [160, 'xl'],
];

/** The largest CircularProgress preset that fits inside `size`. */
function presetFor(size: number): CircularProgressSize {
  let pick: CircularProgressSize = 'sm';
  for (const [px, name] of PRESETS) if (px <= size) pick = name;
  return pick;
}

export function RiveLoader({
  size = 160,
  phase = 'loading',
  progress,
  label = 'Loading',
  className,
}: RiveLoaderProps) {
  const value = progress === undefined ? undefined : clampRiveLoaderProgress(progress) * 100;
  return (
    <View
      className={`items-center justify-center ${className ?? ''}`}
      // Square px size from the prop, so web and native reserve the same box.
      style={{ width: size, height: size }}
    >
      {phase === 'complete' ? null : (
        <CircularProgress
          size={presetFor(size)}
          color="apple"
          value={phase === 'error' ? (value ?? 0) : value}
          indeterminate={phase !== 'error' && value === undefined}
          showValue={false}
          glowIntensity={phase === 'error' ? 'none' : 'medium'}
          accessibilityLabel={label}
          className={phase === 'error' ? 'opacity-40' : undefined}
        />
      )}
    </View>
  );
}
