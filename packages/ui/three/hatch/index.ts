// Egg hatch GLBs (tooling/blender/hatching) on the shared ThreeCanvas renderer.
export { loadEggHatch, preloadEggHatch } from './load-hatch';
export type { EggHatchSceneParams } from './hatch-scene';
export type { EggHatchSource } from './egg-hatch-rig';
export {
  EGG_CLIP_PHASES, EggHatchAssetError, attentionRole, eggHatchManifestSchema, eggPoseFor, hatchClipTime, isClipPhase,
  parseEggHatchManifest, phaseLengthSeconds, playbackProgress, resolveEggClips,
  type EggAttention, type EggClipPhase, type EggClipRole, type EggHatchManifest, type EggHatchPhase, type EggPose, type NamedClip,
} from './hatch-manifest';
