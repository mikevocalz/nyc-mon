'use client';
// PLATFORM FORK (web). Decision: DEFER the web artboard. The kit's web Rive
// runtime is @rive-app/react-webgl2 (packages/spatial/rive/RiveStage.web.tsx),
// which loads from a `src` URL, not from the native `RiveFile` object this
// surface is typed on, and the asset path for the controller artboards is
// lane B's call. Until then the web surface reports no binding and renders
// nothing, so the touch and keyboard paths work and Storybook renders the
// component tree without a .riv.
import { useEffect } from 'react';
import type { ArcadeRiveSurfaceProps } from './ArcadeRiveSurface.types.ts';

export function ArcadeRiveSurface({ onBinding }: ArcadeRiveSurfaceProps) {
  useEffect(() => {
    onBinding(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
