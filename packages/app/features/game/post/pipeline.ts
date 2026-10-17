// post/pipeline.ts — lane L5, "finishing pass". Behind
// EXPO_PUBLIC_WORLD_POST (default OFF, the same truthy set as the L1–L3
// flags) the canvas renderer is mounted on a three RenderPipeline: the scene
// renders into a pass texture and a full-screen quad carries the output
// transform plus whichever effects are flagged. Flag OFF leaves
// renderer.render untouched — the direct path is byte-identical to today,
// which is the black-frame regression invariant this lane has to hold.
//
// Every effect has its own default-off flag:
// - bloom   EXPO_PUBLIC_WORLD_POST_BLOOM — luminance bloom added over the
//           frame (BloomNode, strength is the Flying Roadster measured value).
// - ao      EXPO_PUBLIC_WORLD_POST_AO — screen-space ambient occlusion
//           (SSAONode). Chosen over GTAONode: GTAO needs a separate geometry
//           pre-pass for normals (the scene renders twice), while SSAO
//           piggybacks on the scene pass's MRT. High tier only — the phone
//           tier relies on the baked aOcclusion vertex attributes from L2.
// - aa      EXPO_PUBLIC_WORLD_POST_AA — FXAA, last in the chain. Chosen over
//           SMAANode: SMAA's constructor loads its area/search LUTs through
//           DOM `new Image()`, which does not exist under Metro — FXAA is a
//           single texture pass with no DOM dependency.
// - grade   EXPO_PUBLIC_WORLD_POST_GRADE — contrast, saturation and vignette
//           in display space (after renderOutput), measured values from the
//           design look constants.
//
// Tone mapping is a selector, not a flag:
// EXPO_PUBLIC_WORLD_POST_TONEMAPPING = aces | agx | neutral | none (default
// none — today's NoToneMapping). The mount writes it onto
// renderer.toneMapping and the RenderPipeline applies it inside the output
// quad's renderOutput node, not per material. The ACES/AgX/Neutral
// comparison happens on device; this just exposes the switch.
//
// DEVICE-PENDING — verify on rn-webgpu before unflagging anything here:
// - RenderPipeline itself: react-native-webgpu renders black through three's
//   output pass (docs/implementation/city-world.md, DECISIONS.md). The
//   pass-texture + quad path is plain WebGPU render-to-texture, but only a
//   device frame proves it — this whole lane is the black-frame risk.
// - Any toneMapping other than 'none': the toneMapping node inside
//   renderOutput is exactly the path the metro-live README blamed for the
//   black frame. 'none' leaves renderOutput an identity transform.
// - MRT normals on the Dawn backend, FXAA's sRGB-input ordering, and the
//   actual look of every measured value below.

import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { ssao } from 'three/examples/jsm/tsl/display/SSAONode.js';
import { fxaa } from 'three/examples/jsm/tsl/display/FXAANode.js';
import { parseSkyRigFlag } from '../world/sky-rig.ts';

type RendererT = InstanceType<Three['WebGPURenderer']>;
type SceneT = InstanceType<Three['Scene']>;
type CameraT = InstanceType<Three['Camera']>;
type Object3DT = InstanceType<Three['Object3D']>;
type PipelineT = InstanceType<Three['RenderPipeline']>;
type PassT = ReturnType<Three['TSL']['pass']>;
type BloomT = ReturnType<typeof bloom>;
type SsaoT = ReturnType<typeof ssao>;
type FxaaT = ReturnType<typeof fxaa>;

/**
 * The pinned look constants — the Flying Roadster measured values from the
 * design look table (docs/design/, mirrored in lane-design-seq's look.ts,
 * which is not in this stack: each lane keeps its own copy, same as L1
 * re-pinning FOG_DENSITY in sky-rig.ts). TODO(tune) marks the unmeasured
 * ones — the on-device pass gets final numbers.
 */
export const POST = {
  /** Bloom strength — Flying Roadster measured: halo on lit windows/neon without fogging the frame. */
  bloomStrength: 0.045,
  /** Grade exposure, 1 = neutral. TODO(tune) per time of day. */
  exposure: 1,
  /** Mid-pivot contrast — Flying Roadster measured. */
  contrast: 1.06,
  /** Saturation — Flying Roadster measured. */
  saturation: 1.04,
  /** Corner darkening share at vignetteOuter, 0 none … 1 black — Flying Roadster measured. */
  vignette: 0.22,
  /**
   * Vignette band in screenUV distance from frame centre (corners ≈ 0.707).
   * TODO(tune) — no measured band; starts fully inside the frame edge.
   */
  vignetteInner: 0.4,
  vignetteOuter: 0.75,
  /** AO samples on the high tier — Flying Roadster measured. */
  aoSamples: 12,
  /** AO render-target scale; SSAONode's own default, kept explicit as the tier knob. TODO(tune). */
  aoResolutionScale: 0.5,
} as const;

/** The tone-mapping selector values accepted by EXPO_PUBLIC_WORLD_POST_TONEMAPPING. */
export type PostToneMapping = 'none' | 'aces' | 'agx' | 'neutral';
/** 'high' unlocks AO and larger AO targets; 'phone' (default) excludes AO entirely. */
export type PostTier = 'phone' | 'high';

export interface CityPostOptions {
  /** Bloom over the whole frame. Default off. */
  bloom?: boolean;
  /** Screen-space AO — dropped on the phone tier even when set. Default off. */
  ao?: boolean;
  /** FXAA antialiasing, applied last. Default off. */
  aa?: boolean;
  /** Contrast/saturation/vignette grade in display space. Default off. */
  grade?: boolean;
  /** Device tier — 'high' is the only value that keeps AO. Default 'phone'. */
  tier?: PostTier;
  /** Output tone mapping — 'none' reproduces today's render. Default 'none'. */
  toneMapping?: PostToneMapping;
}

/** Opt-in L5 master flag — default OFF. Same truthy set as the L1–L3 flags. */
export const EXPERIMENTAL_WORLD_POST = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_POST);

/** 'aces' | 'agx' | 'neutral' map to three's modes; anything else is 'none' — today's NoToneMapping. */
export function parsePostToneMapping(value: string | undefined | null): PostToneMapping {
  switch (value?.trim().toLowerCase()) {
    case 'aces':
      return 'aces';
    case 'agx':
      return 'agx';
    case 'neutral':
      return 'neutral';
    default:
      return 'none';
  }
}

/** Only 'high' opts in; anything else (including unset) is the phone tier. */
export function parsePostTier(value: string | undefined | null): PostTier {
  return value?.trim().toLowerCase() === 'high' ? 'high' : 'phone';
}

const DEFAULT_POST_OPTIONS: Required<CityPostOptions> = {
  bloom: false,
  ao: false,
  aa: false,
  grade: false,
  tier: 'phone',
  toneMapping: 'none',
};

/**
 * Reads the per-effect env flags — each default-off, each independent. The
 * master flag gates the mount itself in city-scene.ts; these only shape the
 * chain. Injectable env keeps the truth tables testable.
 */
export function resolvePostOptions(
  env: { [key: string]: string | undefined } = process.env,
): Required<CityPostOptions> {
  return {
    bloom: parseSkyRigFlag(env.EXPO_PUBLIC_WORLD_POST_BLOOM),
    ao: parseSkyRigFlag(env.EXPO_PUBLIC_WORLD_POST_AO),
    aa: parseSkyRigFlag(env.EXPO_PUBLIC_WORLD_POST_AA),
    grade: parseSkyRigFlag(env.EXPO_PUBLIC_WORLD_POST_GRADE),
    tier: parsePostTier(env.EXPO_PUBLIC_WORLD_POST_TIER),
    toneMapping: parsePostToneMapping(env.EXPO_PUBLIC_WORLD_POST_TONEMAPPING),
  };
}

const TONE_MAPPING_CONSTANT = {
  none: 'NoToneMapping',
  aces: 'ACESFilmicToneMapping',
  agx: 'AgXToneMapping',
  neutral: 'NeutralToneMapping',
} as const;

/**
 * Display-space grade: contrast pivoted on mid-grey, saturation, then the
 * corner vignette — all after the renderOutput transform, so the constants
 * measure what the screen shows.
 */
function gradeNode(T: Three['TSL'], color: Node<'vec4'>): Node<'vec4'> {
  const rgb = color.rgb.sub(0.5).mul(POST.contrast).add(0.5);
  const saturated = T.saturation(rgb, POST.saturation);
  const edge = T.distance(T.screenUV, T.vec2(0.5, 0.5));
  const vignette = T.float(1).sub(
    T.smoothstep(POST.vignetteInner, POST.vignetteOuter, edge).mul(POST.vignette),
  );
  return T.vec4(saturated.mul(vignette), color.a);
}

/** What the chain actually wired — the test-facing truth table of the graph. */
export interface AppliedPostEffects {
  bloom: boolean;
  ao: boolean;
  aa: boolean;
  grade: boolean;
}

export interface CityPostRequest {
  /** The canvas renderer — the mount replaces its render() entry point. */
  renderer: RendererT;
  /** The scene the pass node renders each frame. */
  scene: SceneT;
  /** The camera the pass node renders with — the city camera lives for the scene's lifetime. */
  camera: CameraT;
  /** Explicit options skip env resolution entirely (tests, dev panels). */
  options?: CityPostOptions;
}

export interface CityPostPipeline {
  /** The mounted RenderPipeline — pipeline.render() is what the patched renderer.render delegates to. */
  pipeline: PipelineT;
  /** Which effects are wired — AO is already tier-gated here. */
  applied: AppliedPostEffects;
  /** The effective options after defaults/env merge. */
  options: Required<CityPostOptions>;
  /** The scene pass feeding the chain — owns the scene render target. */
  scenePass: PassT;
  /** Restores renderer.render and tone mapping, then frees the nodes and the pipeline. */
  dispose(): void;
}

/**
 * Builds the flagged node chain and mounts a RenderPipeline on the renderer.
 * The canvas calls renderer.render(scene, camera); RenderPipeline.render()
 * takes no arguments (the scene lives in the pass node), so the mount
 * replaces renderer.render with a guarded delegate — PassNode.updateBefore
 * and QuadMesh.render call renderer.render internally, and the inPipeline
 * flag routes every nested call back to the direct path.
 */
export function mountCityPostPipeline(THREE: Three, request: CityPostRequest): CityPostPipeline {
  const { renderer, scene, camera } = request;
  const options: Required<CityPostOptions> = request.options
    ? { ...DEFAULT_POST_OPTIONS, ...request.options }
    : resolvePostOptions();
  const applied: AppliedPostEffects = {
    bloom: options.bloom,
    // The tier contract: AO exists only on 'high' — the phone tier keeps the
    // L2 baked vertex occlusion.
    ao: options.ao && options.tier === 'high',
    aa: options.aa,
    grade: options.grade,
  };

  const T = THREE.TSL;
  const scenePass = T.pass(scene, camera);
  // AO needs view-space normals — a second render-target output on the same
  // scene pass, so the geometry still renders once.
  if (applied.ao) scenePass.setMRT(T.mrt({ output: T.output, normal: T.normalView }));

  let color = scenePass.getTextureNode('output') as Node<'vec4'>;

  let aoNode: SsaoT | null = null;
  if (applied.ao) {
    aoNode = ssao(scenePass.getTextureNode('depth'), scenePass.getTextureNode('normal'), camera);
    aoNode.samples.value = POST.aoSamples;
    aoNode.resolutionScale = POST.aoResolutionScale;
    color = color.mul(aoNode.r);
  }

  let bloomNode: BloomT | null = null;
  if (applied.bloom) {
    bloomNode = bloom(color, POST.bloomStrength);
    color = color.add(bloomNode);
  }

  // Display-space stage: AA and the grade need the converted frame, so the
  // output transform moves inside our chain — setting outputColorTransform
  // false stops the pipeline appending a second renderOutput at the end.
  const needsConvertedInput = applied.aa || applied.grade;
  let outputNode: Node = color;
  let fxaaNode: FxaaT | null = null;
  if (needsConvertedInput) {
    let out: Node<'vec4'> = T.renderOutput(color) as unknown as Node<'vec4'>;
    if (applied.grade) out = gradeNode(T, out);
    if (applied.aa) {
      fxaaNode = fxaa(out);
      out = fxaaNode as unknown as Node<'vec4'>;
    }
    outputNode = out;
  }

  // The selector maps straight onto the renderer field: the pipeline's
  // renderOutput node reads the captured value — set it before construction
  // so the first _updateContext already sees the pick.
  const priorToneMapping = renderer.toneMapping;
  const priorExposure = renderer.toneMappingExposure;
  renderer.toneMapping = THREE[TONE_MAPPING_CONSTANT[options.toneMapping]];
  if (applied.grade) renderer.toneMappingExposure = POST.exposure;

  const pipeline = new THREE.RenderPipeline(renderer);
  pipeline.outputColorTransform = !needsConvertedInput;
  pipeline.outputNode = outputNode;

  const directRender = renderer.render;
  const hadOwnRender = Object.hasOwn(renderer, 'render');
  let inPipeline = false;
  renderer.render = ((target: Object3DT, cam: CameraT) => {
    if (inPipeline) return directRender.call(renderer, target, cam);
    inPipeline = true;
    try {
      pipeline.render();
    } finally {
      inPipeline = false;
    }
  }) as typeof renderer.render;

  let disposed = false;
  return {
    pipeline,
    applied,
    options,
    scenePass,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (hadOwnRender) {
        renderer.render = directRender;
      } else {
        delete (renderer as { render?: unknown }).render;
      }
      renderer.toneMapping = priorToneMapping;
      renderer.toneMappingExposure = priorExposure;
      aoNode?.dispose();
      bloomNode?.dispose();
      fxaaNode?.dispose();
      scenePass.dispose();
      pipeline.dispose();
    },
  };
}
