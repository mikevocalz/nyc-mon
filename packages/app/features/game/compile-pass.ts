// The pass the post pipeline renders the scene through, by scene. The START compile (load-game-scene.ts) must run in
// that pass's render target and MRT (three r186 PassNode.compileAsync): renderer.compileAsync(scene, camera) builds
// every program for the canvas context, which no frame draws to once the post pipeline is mounted, and frame 0 then
// compiled every lit program a second time (one pipeline and module per material twice over: 46 of 114 pipelines on the
// all-lanes walk, world/vd-port/budget.test.ts). Kept apart from city-scene.ts so the loader does not pull the scene in.
export interface CompilePass {
  compileAsync(renderer: unknown): Promise<void>;
  options: { samples?: number };
  renderTarget: { samples: number; texture: { type: number }; depthTexture: { type: number } | null };
  /** PassNode's own scene, camera and MRT: what its compileAsync sets before the renderer's compile. */
  scene?: object;
  camera?: object;
  _mrt?: unknown;
}

/** compileAsync's per-object progress report (three r186 Renderer.compileAsync `onProgress`). */
export type CompileProgress = (event: { loaded?: number; total?: number }) => void;

type CompileRenderer = {
  compileAsync(scene: never, camera: never, targetScene?: null, onProgress?: never): Promise<unknown>;
  samples: number;
  reversedDepthBuffer?: boolean;
  getOutputBufferType(): number;
  getRenderTarget?(): unknown;
  setRenderTarget?(target: unknown): void;
  getMRT?(): unknown;
  setMRT?(mrt: unknown): void;
};

/** three's FloatType (constants.js); the depth texture's type under a reversed depth buffer. */
const FLOAT_TYPE = 1015;

export const cityCompilePass = new WeakMap<object, CompilePass>();

/**
 * Compiles `scene` the way its frames render it: through its post pass when it has one. With `onProgress`, the
 * renderer reports each render object it builds. PassNode.compileAsync takes no callback, so with one its steps run
 * here (target and MRT set, the renderer's compile, both restored after), the same as three r186's.
 * The render list is collected synchronously in either case, before the first await, so a caller may change object
 * layers as soon as this returns (load-game-scene.ts planWarmUp).
 */
export function compileForFrames(
  renderer: CompileRenderer,
  scene: object,
  camera: object,
  onProgress: CompileProgress | null = null,
): Promise<unknown> {
  const pass = cityCompilePass.get(scene);
  if (!pass) return renderer.compileAsync(scene as never, camera as never, null, onProgress as never);
  // What PassNode.setup sets on the pass's target at its first render; set before the compile, or the pipelines it builds
  // carry the defaults (depth24plus, no MSAA) and frame 0 builds them again for depth32float.
  const rt = pass.renderTarget;
  rt.samples = pass.options.samples === undefined ? renderer.samples : pass.options.samples;
  rt.texture.type = renderer.getOutputBufferType();
  if (renderer.reversedDepthBuffer === true && rt.depthTexture !== null) rt.depthTexture.type = FLOAT_TYPE;
  if (!onProgress || !pass.scene || !pass.camera || !renderer.setRenderTarget || !renderer.setMRT) return pass.compileAsync(renderer);
  const previousTarget = renderer.getRenderTarget?.() ?? null;
  const previousMRT = renderer.getMRT?.() ?? null;
  renderer.setRenderTarget(rt);
  renderer.setMRT(pass._mrt ?? null);
  const compiling = renderer.compileAsync(pass.scene as never, pass.camera as never, null, onProgress as never);
  const restore = () => {
    renderer.setRenderTarget?.(previousTarget);
    renderer.setMRT?.(previousMRT);
  };
  return compiling.then(
    (value) => { restore(); return value; },
    (error: unknown) => { restore(); throw error; },
  );
}
