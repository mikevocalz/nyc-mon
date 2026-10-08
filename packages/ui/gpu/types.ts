/// <reference types="@webgpu/types" />
import type { ComponentType, ReactNode, Ref } from 'react';
import type { TgpuRoot } from 'typegpu';

/**
 * The handle both canvas hosts expose: react-native-webgpu's Canvas on
 * native, WebGpuCanvasElement on web. `present` is required after submit on
 * native and a no-op on web.
 */
export interface GpuCanvasRef {
  getContext(kind: 'webgpu'): (GPUCanvasContext & { present?: () => void }) | null;
}

/** What the loader hands back: the platform's canvas host. */
export interface WebGpuModule {
  Canvas: ComponentType<{ ref?: Ref<GpuCanvasRef> }>;
}

/**
 * `pending` until the first check finishes (and always during server
 * rendering), then `supported` or `unsupported`.
 */
export type GpuSupport = 'pending' | 'supported' | 'unsupported';

/** One frame's timing and size. Sizes are layout px (CSS px on web, dp on native). */
export interface GpuFrame {
  /** Seconds since the scene started. Frozen while paused or under reduced motion. */
  time: number;
  /** Seconds since the previous drawn frame; 0 for a one-off redraw. */
  delta: number;
  width: number;
  height: number;
  /** Device pixels per layout px, after the canvas's `maxPixelRatio` cap. */
  pixelRatio: number;
  /** True when the OS asks for reduced motion. The loop is stopped; draw a still frame. */
  reducedMotion: boolean;
}

/** Everything a scene needs from the surface. Handed to `setup` once per canvas. */
export interface GpuContext {
  /** The shared TypeGPU root (one device for every GpuCanvas in the app). */
  root: TgpuRoot;
  device: GPUDevice;
  /** Configured for `format` with premultiplied alpha. Pass as `view` in withColorAttachment. */
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  /** Ask for one more frame. Use it when input changes while the loop is stopped. */
  invalidate: () => void;
}

/** A scene: built once, rendered every frame with the latest params. */
export interface GpuScene<P> {
  render: (frame: GpuFrame, params: P) => void;
  dispose?: () => void;
}

/**
 * Builds the scene's pipelines and buffers. Keep it a module-level function
 * (a stable identity): a new function rebuilds the scene. Anything that
 * changes at runtime belongs in `params`. It may return a promise, so a
 * setup can import its scene module (and TypeGPU with it) on demand.
 */
export type GpuSetup<P> = (gpu: GpuContext) => GpuScene<P> | Promise<GpuScene<P>>;

export interface GpuCanvasHandle {
  /** Draw one frame now, even while the loop is stopped. */
  invalidate: () => void;
}

export interface GpuCanvasProps<P> {
  setup: GpuSetup<P>;
  /**
   * Passed to `render` every frame. While the loop is stopped (paused or
   * reduced motion), a change of params identity draws one new frame.
   */
  params: P;
  /**
   * Rendered instead of the GPU canvas when WebGPU is unavailable, when
   * `setup` or `render` throws, or when `forceFallback` is set. Usually the
   * Skia version of the same drawing.
   */
  fallback?: ReactNode;
  /** Render the fallback even when WebGPU works. For stories and tests. */
  forceFallback?: boolean;
  /** Stop the frame loop; the last frame stays on screen. */
  paused?: boolean;
  /** Cap on device pixel ratio, to bound fill cost on 3x phones. Default 2. */
  maxPixelRatio?: number;
  /** Accessible name. Leave unset for decorative canvases, which are hidden from assistive tech. */
  accessibilityLabel?: string;
  /** Classes for the surface. It fills its parent (absolute inset-0) unless you override. */
  className?: string;
  /** Called when the canvas switches between GPU and fallback. */
  onSupportChange?: (supported: boolean) => void;
  ref?: Ref<GpuCanvasHandle>;
}
