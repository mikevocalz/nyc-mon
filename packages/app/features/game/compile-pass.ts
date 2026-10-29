// The pass the post pipeline renders the scene through, by scene. The START compile (load-game-scene.ts) must run in
// that pass's render target and MRT (three r186 PassNode.compileAsync): renderer.compileAsync(scene, camera) builds
// every program for the canvas context, which no frame draws to once the post pipeline is mounted, and frame 0 then
// compiled every lit program a second time (one pipeline and module per material twice over: 46 of 114 pipelines on the
// all-lanes walk, world/vd-port/budget.test.ts). Kept apart from city-scene.ts so the loader does not pull the scene in.
export interface CompilePass {
  compileAsync(renderer: unknown): Promise<void>;
  options: { samples?: number };
  renderTarget: { samples: number; texture: { type: number }; depthTexture: { type: number } | null };
}

/** three's FloatType (constants.js); the depth texture's type under a reversed depth buffer. */
const FLOAT_TYPE = 1015;

export const cityCompilePass = new WeakMap<object, CompilePass>();

/** Compiles `scene` the way its frames render it: through its post pass when it has one. */
export function compileForFrames(
  renderer: { compileAsync(scene: never, camera: never): Promise<unknown>; samples: number; reversedDepthBuffer?: boolean; getOutputBufferType(): number },
  scene: object,
  camera: object,
): Promise<unknown> {
  const pass = cityCompilePass.get(scene);
  if (!pass) return renderer.compileAsync(scene as never, camera as never);
  // What PassNode.setup sets on the pass's target at its first render; set before the compile, or the pipelines it builds
  // carry the defaults (depth24plus, no MSAA) and frame 0 builds them again for depth32float.
  const rt = pass.renderTarget;
  rt.samples = pass.options.samples === undefined ? renderer.samples : pass.options.samples;
  rt.texture.type = renderer.getOutputBufferType();
  if (renderer.reversedDepthBuffer === true && rt.depthTexture !== null) rt.depthTexture.type = FLOAT_TYPE;
  return pass.compileAsync(renderer);
}
