/// <reference types="@webgpu/types" />
import type { ReactNode, Ref } from 'react';
import type * as ThreeWebGpu from 'three/webgpu';
import type { RenderThread } from './render-thread';
import type { NativeCanvasContext, WorkletRenderHost } from './worklet-host';

/**
 * The Android view react-native-webgpu backs the canvas with — the values of
 * its `android.surfaceType` prop. 'auto' (the default, spelled by leaving the
 * prop unset) picks SurfaceView for an opaque canvas and TextureView for a
 * non-opaque one. 'HardwareBufferView' (API 29+, experimental upstream)
 * presents through an AHardwareBuffer pool instead of the surface swapchain:
 * mailbox semantics — the producer never blocks on the window's buffer queue,
 * and the view draws the latest GPU-finished frame.
 */
export type AndroidSurfaceType = 'SurfaceView' | 'TextureView' | 'HardwareBufferView';

/** The `three/webgpu` module namespace, loaded on demand. */
export type Three = typeof ThreeWebGpu;

/**
 * Which backend WebGPURenderer runs on. `webgpu` is WebGPU (the browser's, or
 * Dawn through react-native-webgpu on native); `webgl2` is WebGPURenderer's
 * WebGL2 backend, the web fallback when WebGPU is missing. Native has no
 * WebGL2 path.
 */
export type ThreeBackend = 'webgpu' | 'webgl2';
/** JS-thread submission cost, not GPU completion or Android UI frame time. */
export interface ThreeFrameTiming {
  cpuMs: number;
  intervalMs: number | null;
  backend: ThreeBackend;
  /** Scene update() cost — G1 stage attribution, set when the probe timed stages. */
  updateMs?: number;
  /** advanceNodeFrame() cost (info.reset + nodeFrame.update). */
  nodeMs?: number;
  /** renderer.render() cost: traversal, node/binding updates, encode + queue submit. */
  renderMs?: number;
  /** Surface present() cost — the swapchain hand-off; can block on buffer availability. */
  presentMs?: number;
  /** renderer.info.render.drawCalls / .triangles for this frame. */
  drawCalls?: number;
  triangles?: number;
  /** Drawing-buffer pixels after this frame's pixel ratio (canvas.width/height). */
  bufferW?: number;
  bufferH?: number;
}

/** The pointer over the canvas, in normalised device coordinates (-1..1, y up). */
export interface ThreePointer {
  x: number;
  y: number;
  /** True while a mouse hovers or a finger touches the canvas. */
  inside: boolean;
  /** True between pointerdown and pointerup — a click/tap in progress. */
  pressed: boolean;
}

/** One frame's clock, size and input. Sizes are layout px (CSS px on web, dp on native). */
export interface ThreeFrame {
  /** Seconds since the scene started. Frozen while paused, offscreen or under reduced motion. */
  time: number;
  /** Seconds since the previous drawn frame; 0 for a one-off redraw. */
  delta: number;
  width: number;
  height: number;
  pixelRatio: number;
  /** True when the OS asks for reduced motion. The loop is stopped; draw a still frame. */
  reducedMotion: boolean;
  pointer: ThreePointer;
}

/** What a scene gets from the canvas, once per renderer. */
export interface ThreeContext {
  THREE: Three;
  renderer: ThreeWebGpu.WebGPURenderer;
  backend: ThreeBackend;
  /** Ask for one more frame while the loop is stopped (e.g. after a pointer move). */
  invalidate: () => void;
}

/** A built scene. `update` runs before every render with the latest frame and params. */
export interface ThreeScene<P> {
  scene: ThreeWebGpu.Scene;
  camera: ThreeWebGpu.Camera;
  update?: (frame: ThreeFrame, params: P) => void;
  /** Called when the canvas size changes, before the next update. */
  resize?: (width: number, height: number) => void;
  dispose?: () => void;
}

/**
 * Builds a scene for a renderer. Called once per renderer (a backend change,
 * a lost device or a remount builds a new one). Anything that changes at
 * runtime belongs in params, read in `update`.
 */
export type ThreeSetup<P> = (context: ThreeContext, params: P) => ThreeScene<P>;

export interface ThreeCanvasHandle {
  /** Draw one frame now, even while the loop is stopped. */
  invalidate: () => void;
}

/** Extra WebGPURenderer constructor options the app asks for (the physical city sets reversed depth). */
export interface ThreeRendererParams {
  reversedDepthBuffer?: boolean;
}

export interface ThreeCanvasProps<P> {
  /**
   * Loads the scene's setup. A module-level function with a stable identity,
   * usually `() => import('./my-scene').then((m) => m.setup)`, so three.js and
   * the scene's TSL stay out of the first bundle chunk on web.
   */
  load: () => Promise<ThreeSetup<P>>;
  /** Handed to `update` every frame. While the loop is stopped, a new params identity draws one frame. */
  params: P;
  /** Web only: use WebGPURenderer's WebGL2 backend even where WebGPU works. For stories and tests. */
  forceWebGL?: boolean;
  /** Stop the frame loop; the last frame stays on screen. */
  paused?: boolean;
  /** Cap on device pixel ratio, to bound fill cost on 3x phones. Default 2. */
  maxPixelRatio?: number;
  /**
   * Rendered instead of the canvas when no backend works here (native without
   * WebGPU) or when the scene fails to build or render.
   */
  fallback?: ReactNode;
  /** Track the pointer (mouse hover, touch) and hand it to the scene. Default true. */
  tracksPointer?: boolean;
  /** Accessible name. Unset means decorative, hidden from assistive tech. */
  accessibilityLabel?: string;
  /** Classes for the outer view. It fills its parent unless overridden. */
  className?: string;
  /** Opacity of the canvas over the view's background, 0..1. */
  opacity?: number;
  /** The fill behind the canvas, visible before the first frame. */
  background?: string;
  /**
   * Native only: which Android view backs the canvas (see AndroidSurfaceType).
   * Unset keeps the default auto choice — TextureView for this canvas, which
   * is non-opaque. Ignored on web and iOS.
   */
  androidSurfaceType?: AndroidSurfaceType;
  /**
   * Native only: pace the running loop on a zero-delay timer instead of
   * requestAnimationFrame. Only useful on a superseding present path
   * (androidSurfaceType 'HardwareBufferView'); on a fifo surface the present
   * stall throttles the loop the same way rAF pacing does. Ignored on web
   * and on the worklet thread.
   */
  freeRun?: boolean;
  /** Spread into the native WebGPURenderer constructor; read once per renderer. */
  rendererParams?: ThreeRendererParams;
  /** Called with the backend once the renderer is up, or null when falling back. */
  onBackendChange?: (backend: ThreeBackend | null) => void;
  /** Opt-in JS renderer metrics. Worklet runtimes use their own reporting channel. */
  onFrameTiming?: (sample: ThreeFrameTiming) => void;
  /** Laid over the canvas. */
  children?: ReactNode;
  ref?: Ref<ThreeCanvasHandle>;
  /**
   * Native only. `js` (default): three.js renders on the JS thread. `worklet`:
   * `workletHost` renders on its own worklet runtime and `load`/`params` are
   * not used (the host owns the scene). Falls back to `js`, with a warning,
   * on web, without a host, or when the host reports it cannot run
   * (worklets Bundle Mode off). See docs/implementation/worklet-rendering.md.
   */
  renderThread?: RenderThread;
  /** The scene owner for `renderThread="worklet"`. */
  workletHost?: WorkletRenderHost;
}

/** What the platform surface hands ThreeCanvas: a way to build a renderer on its canvas, and to present a frame. */
export interface ThreeSurfaceHandle {
  createRenderer: (THREE: Three, options: { backend: ThreeBackend; device: GPUDevice | null; rendererParams?: ThreeRendererParams }) => ThreeWebGpu.WebGPURenderer;
  /** Native swaps the frame explicitly after each render; web presents on its own. */
  present: () => void;
  /** Native only: the raw react-native-webgpu context, for a worklet render runtime. Null on web. */
  getContext?: () => NativeCanvasContext | null;
}
