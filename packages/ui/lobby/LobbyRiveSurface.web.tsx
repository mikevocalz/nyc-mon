'use client';
// PLATFORM FORK (web). Decision: DEFER the web artboard, as
// ../game-controls/ArcadeRiveSurface.web.tsx does: the kit's web Rive runtime
// loads from a `src` URL, not from the native `RiveFile` this surface is
// typed on. The web surface reports no binding and renders nothing, so the
// kit housings carry the lobby and Storybook renders without a .riv.
import { useEffect } from 'react';
import type { LobbyRiveSurfaceProps } from './LobbyRiveSurface.types.ts';

export function LobbyRiveSurface({ onBinding }: LobbyRiveSurfaceProps) {
  useEffect(() => {
    onBinding(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
