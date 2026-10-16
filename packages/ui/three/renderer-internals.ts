// WebGPURenderer internals that ThreeCanvas drives itself, shared by the JS
// path (ThreeCanvas.tsx) and the worklet render runtime. This module imports
// nothing at run time, so a worklet runtime can evaluate it without pulling in
// react-native (exported as `@acme/ui/three/internals`).
import type { WebGPURenderer } from 'three/webgpu';

/**
 * three's `Renderer.init()` starts `Animation.start()`, a requestAnimationFrame
 * loop that runs until dispose and only advances `nodeFrame`
 * (three/src/renderers/common/Animation.js, r186). ThreeCanvas already owns a
 * frame loop gated on visibility, so the internal one is stopped after init and
 * each draw advances `nodeFrame` itself. Neither member is public API: if a
 * three upgrade renames them, `stopInternalLoop` warns and the site-qa motion
 * check fails on the idle loop.
 */
type RendererInternals = {
  _animation?: { stop?: () => void } | null;
  _nodes?: { nodeFrame?: { update?: () => void; frameId?: number } } | null;
};
export const stopInternalLoop = (renderer: WebGPURenderer) => {
  const animation = (renderer as unknown as RendererInternals)._animation;
  if (typeof animation?.stop !== 'function') {
    console.warn('[ThreeCanvas] three renamed Renderer._animation; its internal frame loop keeps running.');
    return;
  }
  animation.stop();
};
let warnedNodeFrame = false;
const warnNodeFrame = () => {
  if (warnedNodeFrame) return;
  warnedNodeFrame = true;
  console.warn('[ThreeCanvas] three renamed Renderer._nodes.nodeFrame; node-time animation will not advance.');
};
// What Animation.start()'s loop did per frame besides the user callback.
export const advanceNodeFrame = (renderer: WebGPURenderer) => {
  const nodeFrame = (renderer as unknown as RendererInternals)._nodes?.nodeFrame;
  if (typeof nodeFrame?.update !== 'function') warnNodeFrame();
  if (renderer.info.autoReset) renderer.info.reset();
  nodeFrame?.update?.();
  if (nodeFrame?.frameId !== undefined) (renderer.info as { frame: number }).frame = nodeFrame.frameId;
};
