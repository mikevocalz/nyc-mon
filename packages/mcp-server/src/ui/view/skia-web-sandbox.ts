/**
 * Build alias for `react-native-skia/lib/module/web` in the MCP App views
 * (build.ts). The kit's SkiaWebGate loads CanvasKit through `LoadSkiaWeb`,
 * which fetches `/canvaskit/canvaskit.wasm` from the page origin. A sandboxed
 * MCP App has no such origin and its CSP blocks the fetch (`connect-src
 * 'none'`), so the real loader can only fail, with `RuntimeError: Aborted`.
 *
 * This stand-in never fetches and never resolves: SkiaWebGate keeps rendering
 * its empty fallback, and the request is recorded so the room backdrop can
 * drop the grid floor back to its placeholder sky and hide Pause.
 */
import { createStore } from 'zustand/vanilla';

export const skiaFallbackStore = createStore<{ requested: boolean }>(() => ({ requested: false }));

export function LoadSkiaWeb(_options?: unknown): Promise<void> {
  skiaFallbackStore.setState({ requested: true });
  return new Promise<void>(() => {});
}
