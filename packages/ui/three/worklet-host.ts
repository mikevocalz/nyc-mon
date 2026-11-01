/// <reference types="@webgpu/types" />
// The seam between ThreeCanvas in `renderThread="worklet"` mode and whoever
// owns the scene on the render runtime. @acme/ui does not depend on
// react-native-worklets, so the host is passed in by the app (the Game screen's
// is `packages/app/features/game/render-runtime/worklet-host.ts`). The canvas
// owns the native surface, its size, visibility and the fallback; the host
// owns the runtime, three.js, the scene and the state it mirrors there.
//
// Pure types: no three.js or react-native import, so node tests and a worklet
// runtime can both depend on it.

/** What the render runtime reports back to the canvas (delivered on the JS thread). */
export type WorkletRenderEvent =
  | { kind: 'backend'; backend: 'webgpu' }
  | { kind: 'failed'; message: string };

/** react-native-webgpu's canvas context: a GPUCanvasContext that presents explicitly. */
export type NativeCanvasContext = GPUCanvasContext & { present: () => void };

export interface WorkletRenderStart {
  /** react-native-webgpu's canvas context. Serializable into a worklet runtime (registerWebGPUForReanimated). */
  context: NativeCanvasContext;
  /** The app's shared GPUDevice, or null to let the runtime create one. */
  device: GPUDevice | null;
  /** Layout size in dp and the capped pixel ratio. */
  width: number;
  height: number;
  pixelRatio: number;
  reducedMotion: boolean;
  /** Delivered on the JS thread. */
  onEvent: (event: WorkletRenderEvent) => void;
}

export interface WorkletRenderSession {
  /** Layout size or pixel ratio changed. */
  resize: (width: number, height: number, pixelRatio: number) => void;
  /** Continuous loop on (unpaused, on screen, motion allowed) or off (draw on demand). */
  setRunning: (running: boolean) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  /** One more frame while the loop is off (ThreeCanvasHandle.invalidate). */
  invalidate: () => void;
  /** Dispose the scene and renderer on the runtime. Idempotent. */
  dispose: () => void;
}

export interface WorkletRenderHost {
  /** Bundle Mode on and the runtime APIs present. Read once per mount; false keeps the canvas on the JS thread. */
  available: () => boolean;
  start: (options: WorkletRenderStart) => WorkletRenderSession;
}
