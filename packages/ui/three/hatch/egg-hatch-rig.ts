import * as THREE from 'three/webgpu';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { fetchEggBytes } from './egg-bytes';
import { eggTexturePlugin } from './egg-texture-plugin';
import {
  EggHatchAssetError, attentionRole, eggPoseFor, hatchClipTime, isClipPhase, parseEggHatchManifest, phaseLengthSeconds,
  playbackProgress, resolveEggClips, type EggAttention, type EggClipRole, type EggHatchManifest, type EggHatchPhase, type EggPose,
} from './hatch-manifest';
import { weldShellSeamNormals } from './shell-seams';
import { disposeObjectTree } from '../dispose-object.ts';
import { SharedParseCache, type ParseLease } from '../parse-cache.ts';

/** An egg's runtime assets as `@acme/assets/eggs` exports them: the manifest JSON and the bundled GLB (URL on web, asset id on native). */
export interface EggHatchSource {
  readonly manifest: unknown;
  readonly glb: string | number;
}

/** Nodes the Blender build marks as stand-ins for the Baby (manifest `baby.proxy`). */
const PROXY_PREFIX = 'PROXY_';

interface LoadedEgg {
  readonly manifest: EggHatchManifest;
  readonly gltf: GLTF;
  readonly clips: Record<EggClipRole, THREE.AnimationClip>;
  /** `hatch` without the tracks the attention clips own, so attention fully drives the Baby on top of the held hatch end. */
  readonly hatchUnderAttention: THREE.AnimationClip;
}

/** Parsed eggs by eggId, shared by every mounted rig for the egg (parse-cache.ts); freed when the last one releases it. */
const cache = new SharedParseCache<LoadedEgg>('egg-hatch-rig', {
  keepMs: 0,
  dispose: (egg) => disposeObjectTree(egg.gltf.scene),
});

function fetchEgg(eggId: string, source: EggHatchSource): Promise<ArrayBuffer> {
  return fetchEggBytes(source.glb).catch((cause: unknown) => {
    throw new EggHatchAssetError('fetch', `${eggId}: could not fetch the hatch GLB`, { cause });
  });
}

/**
 * Starts fetching an egg's GLB bytes during incubation, so the hatch starts
 * without a network wait. Safe to call repeatedly; a no-op once the egg is
 * parsed. Errors surface on the real load.
 */
export function preloadEggHatch(eggId: string, source: EggHatchSource): void {
  cache.preload(eggId, () => fetchEgg(eggId, source));
}

async function loadEgg(eggId: string, source: EggHatchSource): Promise<LoadedEgg> {
  const manifest = parseEggHatchManifest(source.manifest);
  if (manifest.eggId !== eggId) {
    throw new EggHatchAssetError('egg-mismatch', `asked for ${eggId}, manifest describes ${manifest.eggId}`);
  }
  const bytes = await cache.bytesFor(eggId, () => fetchEgg(eggId, source));
  const loader = new GLTFLoader();
  // The GLBs use KHR_mesh_quantization only, which GLTFLoader reads with no
  // decoder. Meshopt and Draco are off the table: both decoders need
  // WebAssembly, which Hermes doesn't have.
  if (eggTexturePlugin) loader.register(eggTexturePlugin);
  let gltf: GLTF;
  try {
    gltf = await loader.parseAsync(bytes, '');
  } catch (cause) {
    throw new EggHatchAssetError('parse', `${eggId}: GLTFLoader could not parse ${manifest.runtime.glb}`, { cause });
  }
  // The shell ships cut into hatch pieces; without this every cut catches the light and the resting egg looks cracked.
  weldShellSeamNormals(gltf.scene, manifest.runtime.shellPieceNames ?? shellPieceNamesIn(gltf.scene));
  const clips = resolveEggClips(manifest, gltf.animations);
  const owned = new Set([...clips.leanIn.tracks, ...clips.hesitate.tracks].map((t) => t.name));
  const hatchUnderAttention = new THREE.AnimationClip(
    `${clips.hatch.name}_under_attention`,
    clips.hatch.duration,
    clips.hatch.tracks.filter((t) => !owned.has(t.name)),
  );
  return { manifest, gltf, clips, hatchUnderAttention };
}

/** The hatch pieces when a manifest predates `shellPieceNames`: every node the fracture build names `Shell_*`. */
function shellPieceNamesIn(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((o) => {
    if (/^Shell_(Cup|Crown|Shard_\d+)$/.test(o.name)) names.push(o.name);
  });
  return names;
}

/**
 * One egg's hatch, ready to pose. Built per scene from the shared parse: the
 * scene graph is cloned (geometry and materials stay shared), with its own
 * AnimationMixer. Every pose sets clip times directly and applies them with
 * `mixer.update(0)`, so a pose depends only on its arguments, never on the
 * frames played before it. The only clock is the idle loop and a phase
 * playing in real time, both advanced by `update(delta)`.
 */
export class EggHatchRig {
  readonly root: THREE.Object3D;
  readonly manifest: EggHatchManifest;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions: Record<EggClipRole | 'hatchUnder', THREE.AnimationAction>;
  private readonly proxies: THREE.Object3D[] = [];
  private readonly lease: ParseLease<LoadedEgg>;
  private disposed = false;

  private mode: { kind: 'still'; pose: EggPose } | { kind: 'idle'; time: number } | {
    kind: 'playing';
    phase: EggHatchPhase;
    attention: EggAttention;
    elapsed: number;
    duration: number;
  } = { kind: 'still', pose: { kind: 'hatch', seconds: 0 } };

  private constructor(eggId: string, egg: LoadedEgg, lease: ParseLease<LoadedEgg>) {
    this.lease = lease;
    this.manifest = egg.manifest;
    this.root = cloneSkinned(egg.gltf.scene);
    this.root.name = `EggHatch_${eggId}`;
    this.root.traverse((o) => {
      if (o.name.startsWith(PROXY_PREFIX) && !o.parent?.name.startsWith(PROXY_PREFIX)) this.proxies.push(o);
    });
    this.mixer = new THREE.AnimationMixer(this.root);
    const once = (clip: THREE.AnimationClip) => {
      const action = this.mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      return action;
    };
    const idle = this.mixer.clipAction(egg.clips.idle);
    idle.setLoop(THREE.LoopRepeat, Infinity);
    this.actions = {
      idle,
      hatch: once(egg.clips.hatch),
      hatchUnder: once(egg.hatchUnderAttention),
      leanIn: once(egg.clips.leanIn),
      hesitate: once(egg.clips.hesitate),
    };
    this.apply({ kind: 'hatch', seconds: 0 });
  }

  /** Loads (or reuses) the egg and builds a rig. Rejects with `EggHatchAssetError` on any contract break. */
  static async create(eggId: string, source: EggHatchSource): Promise<EggHatchRig> {
    const lease = cache.acquire(eggId, () => loadEgg(eggId, source));
    try {
      return new EggHatchRig(eggId, await lease.value, lease);
    } catch (error) {
      lease.release();
      throw error;
    }
  }

  /** The Baby in these GLBs is a labelled stand-in (manifest `baby.proxy`); hide it wherever real creature art draws the Baby. */
  setProxyBabyVisible(visible: boolean): void {
    for (const node of this.proxies) node.visible = visible;
  }

  /** Holds `progress` (0–1) through `phase`. `attention` holds the hatch end and seeks the attention clip. */
  seek(phase: EggHatchPhase, progress: number, attention: EggAttention = 'lean-in'): void {
    const pose = eggPoseFor(this.manifest, phase, progress, attention, false);
    this.mode = { kind: 'still', pose };
    this.apply(pose);
  }

  /** The end pose of `phase` with no playback: the reduced-motion presentation. */
  holdPhaseEnd(phase: EggHatchPhase | null, attention: EggAttention = 'lean-in'): void {
    const pose = eggPoseFor(this.manifest, phase, 1, attention, true);
    this.mode = { kind: 'still', pose };
    this.apply(pose);
  }

  /**
   * Plays `phase` from its start in real time. `durationSeconds` defaults to
   * the authored length; pass the screen's phase length to stay in step with
   * it. The phase holds its end pose once played.
   */
  playPhase(phase: EggHatchPhase, durationSeconds?: number, attention: EggAttention = 'lean-in'): void {
    const authored = isClipPhase(phase) ? phaseLengthSeconds(this.manifest, phase) : this.attentionClip(attention).duration;
    this.mode = { kind: 'playing', phase, attention, elapsed: 0, duration: durationSeconds ?? authored };
    this.apply(eggPoseFor(this.manifest, phase, 0, attention, false));
  }

  /**
   * Holds the hatch clip at `seconds` (clamped to the clip): the Alexa-style
   * hatch sequence (hatch-sequence-scene.ts) drives the clip from its own
   * timeline (hatch-timeline.ts `clipTime`) rather than by phase.
   */
  hatchAt(seconds: number): void {
    const clamped = Math.max(0, Math.min(seconds, this.actions.hatch.getClip().duration));
    const pose: EggPose = { kind: 'hatch', seconds: clamped };
    this.mode = { kind: 'still', pose };
    this.apply(pose);
  }

  /** Plays an attention clip over the finished hatch. */
  attention(kind: EggAttention, durationSeconds?: number): void {
    this.playPhase('attention', durationSeconds, kind);
  }

  /** Loops the idle clip: the egg before the hatch starts. */
  idle(): void {
    if (this.mode.kind === 'idle') return;
    this.mode = { kind: 'idle', time: 0 };
    this.apply({ kind: 'idle', loop: true });
  }

  /** True while something is moving and the canvas should keep drawing. */
  get animating(): boolean {
    return this.mode.kind === 'idle' || (this.mode.kind === 'playing' && this.mode.elapsed < this.mode.duration);
  }

  /** Advances the idle loop or the playing phase by `delta` seconds. */
  update(delta: number): void {
    const mode = this.mode;
    if (mode.kind === 'idle') {
      mode.time += delta;
      this.apply({ kind: 'idle', loop: true }, mode.time);
    } else if (mode.kind === 'playing') {
      mode.elapsed += delta;
      const progress = playbackProgress(mode.elapsed, mode.duration);
      this.apply(eggPoseFor(this.manifest, mode.phase, progress, mode.attention, false));
    }
  }

  /** The clip time a hatch phase seeks to; exposed for evidence logging. */
  clipTimeAt(phase: Exclude<EggHatchPhase, 'attention'>, progress: number): number {
    return hatchClipTime(this.manifest, phase, progress);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.root.removeFromParent();
    this.lease.release();
  }

  private attentionClip(kind: EggAttention): THREE.AnimationClip {
    return this.actions[attentionRole(kind)].getClip();
  }

  /** Runs exactly the actions `pose` needs at their times, stops the rest, and applies them. */
  private apply(pose: EggPose, idleTime = 0): void {
    const want = new Map<THREE.AnimationAction, number>();
    switch (pose.kind) {
      case 'idle': {
        const idle = this.actions.idle;
        want.set(idle, idleTime % idle.getClip().duration);
        break;
      }
      case 'hatch':
        want.set(this.actions.hatch, pose.seconds);
        break;
      case 'attention': {
        const under = this.actions.hatchUnder;
        want.set(under, under.getClip().duration);
        const action = this.actions[attentionRole(pose.attention)];
        want.set(action, pose.progress * action.getClip().duration);
        break;
      }
    }
    for (const action of Object.values(this.actions)) {
      const time = want.get(action);
      if (time === undefined) {
        if (action.isScheduled()) action.stop();
        continue;
      }
      if (!action.isScheduled()) action.reset().play();
      action.paused = false;
      action.time = time;
    }
    // Zero delta: each action samples at exactly the time set above.
    this.mixer.update(0);
  }
}
