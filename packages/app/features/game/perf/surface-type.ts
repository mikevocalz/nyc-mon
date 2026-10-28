// Android backing view for the game canvas (present-tail lane,
// docs/performance/present-tail-2026-10-18.md). Opt-in:
// EXPO_PUBLIC_GAME_SURFACE — unset = 'auto', the current default
// (TextureView for the non-opaque canvas).
//
// Why this exists: the Duo's present tail (presentP90 ≈ 16–20 ms) is swapchain
// back-pressure — the canvas presents through the TextureView's BufferQueue,
// which only frees a slot when the RenderThread latches it during a traversal.
// When the window's own queue is already back-pressured (U1's dequeueBuffer
// stalls), the canvas queue stays full a whole vsync and Dawn's present()
// parks the render thread for ~one frame. The on-demand canvas can also just
// produce faster than 60 Hz (one draw per camera write), which fills the same
// fifo.
//
// 'ahb' / 'hardwarebuffer' selects react-native-webgpu's experimental
// WebGPUHardwareBufferView (API 29+; below that it is a TextureView). Present
// goes through a pool of AHardwareBuffers imported as Dawn
// SharedTextureMemory — latest-wins, no BufferQueue, so a frame that misses
// the vsync is superseded rather than stalling the producer; the UI thread
// draws the newest fence-signaled buffer inline via Bitmap.wrapHardwareBuffer.
// Requires the Dawn device's SharedTextureMemoryAHardwareBuffer feature; if
// the device lacks it the canvas stays blank, which is why this stays
// flag-gated until a device run proves it on the Duo.
//
// 'surfaceview' selects a SurfaceView: the canvas presents on its own
// SurfaceFlinger layer instead of inside the window, and react-native-webgpu's
// SurfaceFrameRateVote (Surface.setFrameRate, seamless only) can vote the
// refresh rate while it animates. Stacking caveat: the surface sits behind
// the window, the view punches a hole for it, and window opacity no longer
// fades the canvas.
import type { AndroidSurfaceType } from '@acme/ui/three';

/** Parse EXPO_PUBLIC_GAME_SURFACE; undefined keeps the default TextureView. */
export function parseGameSurfaceFlag(value: string | undefined | null): AndroidSurfaceType | undefined {
  if (typeof value !== 'string') return undefined;
  switch (value.trim().toLowerCase()) {
    case 'ahb':
    case 'hardwarebuffer':
    case 'hardwarebufferview':
      return 'HardwareBufferView';
    case 'surface':
    case 'surfaceview':
      return 'SurfaceView';
    case 'texture':
    case 'textureview':
      return 'TextureView';
    default:
      return undefined;
  }
}

/** Opt-in present-path flag — default off (auto/TextureView). */
export const GAME_SURFACE_TYPE = parseGameSurfaceFlag(process.env.EXPO_PUBLIC_GAME_SURFACE);
