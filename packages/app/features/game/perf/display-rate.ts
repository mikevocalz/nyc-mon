// Display-rate vote (performance-pass PR4.2). Opt-in:
// EXPO_PUBLIC_WORLD_FRAME_RATE=1 — default off.
//
// The game canvas is a TextureView (packages/ui/three/surface.native.tsx
// renders <Canvas opaque={false}>), so Surface#setFrameRate — the path
// react-native-webgpu's SurfaceFrameRateVote uses — does not apply: a
// TextureView's buffer is handed to the RenderThread/compositor, not bound to
// a Surface the app can vote on. Instead this votes through the app Window's
// LayoutParams (preferredDisplayModeId + preferredRefreshRate) via the local
// GamePerf module, which applies to every surface in the window.
//
// Per Android guidance the request targets the display's top supported rate;
// passing an explicit rateHz requests the smallest supported rate that
// reaches it (a future tier→rate mapping can request 60 on 90/120Hz devices
// when the tier cannot hold more).
import { gamePerf, type GamePerfDisplayMode } from '@acme/ui/game-perf';
import { parseSkyRigFlag } from '../world/sky-rig.ts';

export const EXPERIMENTAL_WORLD_FRAME_RATE = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_FRAME_RATE);

/**
 * Smallest supported refresh rate >= rateHz; falls back to the top rate.
 * Only modes at the current resolution qualify: a resolution switch is a
 * non-seamless mode change that can blank the screen and re-layout.
 */
export function pickDisplayMode(
  modes: readonly GamePerfDisplayMode[],
  rateHz: number,
): GamePerfDisplayMode | null {
  const current = modes.find((m) => m.current);
  const sameSize = current
    ? modes.filter((m) => m.width === current.width && m.height === current.height)
    : modes;
  if (sameSize.length === 0) return null;
  const sorted = [...sameSize].sort((a, b) => a.refreshRate - b.refreshRate);
  return sorted.find((m) => m.refreshRate >= rateHz - 0.5) ?? sorted[sorted.length - 1] ?? null;
}

export function mountDisplayRate(requestedRateHz?: number): () => void {
  const native = gamePerf();
  if (!native) {
    console.warn('[NYC-Mon/perf] display rate vote skipped: GamePerf module unavailable');
    return () => {};
  }
  let disposed = false;
  void native.displayModes().then((modes) => {
    if (disposed || modes.length === 0) return;
    const mode = pickDisplayMode(modes, requestedRateHz ?? Number.POSITIVE_INFINITY);
    if (!mode) return;
    if (mode.current) {
      console.info('[NYC-Mon/perf] display rate already at requested mode', {
        refreshRate: mode.refreshRate,
        supported: modes.map((m) => m.refreshRate),
      });
      return;
    }
    void native.requestDisplayMode(mode.id).then((applied) => {
      console.info('[NYC-Mon/perf] display rate vote', {
        requestedId: mode.id,
        refreshRate: mode.refreshRate,
        applied: applied !== null,
        supported: modes.map((m) => m.refreshRate),
      });
    });
  });
  return () => {
    disposed = true;
    void native.requestDisplayMode(0);
  };
}
