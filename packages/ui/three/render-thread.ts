// Which thread draws a ThreeCanvas. Pure, so node tests cover it.
//
// `js` is the default and the only mode most builds can run: three.js, the
// scene update and the draw submission all run on the React Native JS thread.
// `worklet` hands them to a dedicated worklet runtime (its own thread), which
// needs react-native-worklets Bundle Mode so three.js can load there
// (docs/implementation/worklet-rendering.md). A worklet request that cannot be
// honoured falls back to `js` and says why; it never leaves the canvas blank.

export type RenderThread = 'js' | 'worklet';

/** `EXPO_PUBLIC_WORKLET_RENDER`: `1`, `true` or `worklet` ask for the worklet runtime; anything else, or unset, is `js`. */
export function parseRenderThreadFlag(value: string | undefined | null): RenderThread {
  if (typeof value !== 'string') return 'js';
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'worklet' ? 'worklet' : 'js';
}

export interface RenderThreadInputs {
  /** What the caller asked for (ThreeCanvas `renderThread`). */
  requested: RenderThread | undefined;
  /** `Platform.OS`. Web has no worklet runtimes that can reach a canvas. */
  platform: string;
  /** A worklet host was passed. */
  hasHost: boolean;
  /** The host's own check: Bundle Mode on and the runtime APIs present. */
  hostAvailable: boolean;
}

export type RenderThreadReason = 'web' | 'no-host' | 'host-unavailable' | null;

/** The thread to use, and why a worklet request fell back to `js` (null when it did not). */
export function resolveRenderThread(inputs: RenderThreadInputs): { thread: RenderThread; reason: RenderThreadReason } {
  if (inputs.requested !== 'worklet') return { thread: 'js', reason: null };
  if (inputs.platform === 'web') return { thread: 'js', reason: 'web' };
  if (!inputs.hasHost) return { thread: 'js', reason: 'no-host' };
  if (!inputs.hostAvailable) return { thread: 'js', reason: 'host-unavailable' };
  return { thread: 'worklet', reason: null };
}
