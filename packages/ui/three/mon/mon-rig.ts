import * as THREE from 'three/webgpu';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { fetchEggBytes } from '../hatch/egg-bytes';
import { reportGlbProgress } from './load-progress';
import { eggTexturePlugin } from '../hatch/egg-texture-plugin';
import { closeLoop, resampleSmooth, smoothJitter } from './clip-smoothing.ts';
import { idleConfig } from './idle/config.ts';
import { weldSceneMorphSeams } from './morph-seams.ts';
import { createIdleEngine, LOOPS, resolveIdleClips, type IdleAction, type IdleEngine, type IdleFrame } from './idle/engine.ts';

/**
 * A Baby's model as the app's 3D stages take it: the bundled GLB (URL on web,
 * Metro asset id on native), the clip list for its mood (first match wins),
 * and how its mouth rests. `key` names the parse cache entry.
 */
export interface MonRigSource {
  readonly key: string;
  readonly glb: string | number;
  readonly clips: readonly string[];
  readonly mouth?: MonMouthRest;
}

/** The jaw bone and its shut angle (about the bone's local X from bind), and the morph weights of the resting face. */
export interface MonMouthRest {
  readonly jawBone: string;
  readonly jawClosedRad: number;
  readonly rest: Readonly<Record<string, number>>;
}

/** What drives one frame of the rig. */
export interface MonRigInputs {
  readonly reduced: boolean;
  /** How far the root may step either side of centre, model units. 0 keeps it in place (a slot on the glass). */
  readonly boundX: number;
}

/** The spine-to-head chain the idle engine's upper-body yaw is spread over, with each bone's share (MonModel3D). */
const BODY_YAW_CHAIN: readonly (readonly [string, number])[] = [
  ['spine_01', 0.15],
  ['spine_02', 0.15],
  ['spine_03', 0.2],
  ['chest', 0.2],
  ['neck', 0.15],
  ['head', 0.15],
];
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const BLINK_CHANNELS = ['lid_L', 'lid_R'] as const;
const EPS = 1e-3;
/** How long a parse outlives its last user, ms: a route change (M12 → M09 → M13) picks it straight back up. */
const KEEP_MS = 15_000;

/**
 * The box round `object` as it is posed now. A skinned mesh's box is
 * computed from its bones' world matrices and then cached on the mesh, so
 * a box taken before the matrices exist (a fresh clone, never rendered)
 * comes out wrong and stays wrong: it measured Squeaklet a fraction of its
 * size and the glass seated it far too large. Update the matrices and drop
 * the cached boxes first.
 */
export function measurePosed(object: THREE.Object3D): THREE.Box3 {
  object.updateMatrixWorld(true);
  object.traverse((o) => {
    const skinned = o as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh) (skinned as { boundingBox: THREE.Box3 | null }).boundingBox = null;
  });
  return new THREE.Box3().setFromObject(object);
}

/** A stable seed per model, so a Mon moves the same way each time it loads (MonModel3D seedOf). */
function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Blink weight at `t` seconds into a blink: shut in 90 ms, open over 140 ms. */
function blinkCurve(t: number): number {
  if (t < 0 || t > 0.26) return 0;
  if (t < 0.09) return t / 0.09;
  if (t < 0.12) return 1;
  return 1 - (t - 0.12) / 0.14;
}

/**
 * Lil' Ratti's up_turn_L / up_turn_R keep the head on the camera while the
 * body turns, so the cut back to the idle snapped the head round. Holding the
 * head and neck at their bind rotation for these clips turns the Mon as one
 * piece (MonModel3D holdHeadInTurns).
 */
function holdHeadInTurns(animations: readonly THREE.AnimationClip[], model: THREE.Object3D): void {
  const held = ['neck', 'head']
    .map((name) => model.getObjectByName(name))
    .filter((o): o is THREE.Object3D => o !== undefined);
  for (const clip of animations) {
    if (!/^up_turn_[LR]$/.test(clip.name)) continue;
    clip.tracks = clip.tracks.map((track) => {
      const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(track.name);
      const bone = held.find((b) => THREE.PropertyBinding.sanitizeNodeName(b.name) === nodeName);
      if (!bone || propertyName !== 'quaternion') return track;
      const q = bone.quaternion;
      return new THREE.QuaternionKeyframeTrack(track.name, [0, clip.duration], [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w]);
    });
  }
}

interface Parsed {
  readonly gltf: GLTF;
  readonly durations: Readonly<Record<string, number>>;
}
interface CacheEntry {
  readonly promise: Promise<Parsed>;
  refs: number;
  drop: ReturnType<typeof setTimeout> | null;
}
const cache = new Map<string, CacheEntry>();
const bytesCache = new Map<string, Promise<ArrayBuffer>>();

function bytesFor(source: Pick<MonRigSource, 'key' | 'glb'>): Promise<ArrayBuffer> {
  let pending = bytesCache.get(source.key);
  if (!pending) {
    const key = source.key;
    // The stage loader reads this (load-progress.ts): real bytes where the platform streams them.
    pending = fetchEggBytes(source.glb, (loaded, total) => reportGlbProgress(key, { loaded, total, done: false }))
      .then((bytes) => {
        reportGlbProgress(key, { loaded: bytes.byteLength, total: bytes.byteLength, done: true });
        return bytes;
      })
      .catch((error: unknown) => {
        bytesCache.delete(key);
        throw error;
      });
    bytesCache.set(source.key, pending);
  }
  return pending;
}

/** Starts fetching a Mon's GLB bytes (26-34 MB) ahead of its first stage. Safe to call repeatedly. */
export function preloadMonRig(source: Pick<MonRigSource, 'key' | 'glb'>): void {
  bytesFor(source).catch(() => undefined);
}

async function parse(source: Pick<MonRigSource, 'key' | 'glb'>): Promise<Parsed> {
  const bytes = await bytesFor(source);
  const loader = new GLTFLoader();
  // Plain glTF: no Draco or Meshopt (their decoders need WebAssembly, which Hermes lacks).
  if (eggTexturePlugin) loader.register(eggTexturePlugin);
  const gltf = await loader.parseAsync(bytes, '');
  // Once per parse, shared by every clone: the clips as MonModel3D cleans them
  // (baked tremble out, loops closed, keys resampled) and the turns held at the head.
  holdHeadInTurns(gltf.animations, gltf.scene);
  for (const clip of gltf.animations) {
    const loops = LOOPS.has(clip.name) || clip.name === 'up_look_listen' || clip.name === 'up_walk';
    smoothJitter(clip, loops);
    if (loops) closeLoop(clip);
    resampleSmooth(clip, loops);
  }
  gltf.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.frustumCulled = false;
  });
  // Squeaklet's mouthClose tears its UV seams open beside the mouth, and the rest pose holds it at 1 (morph-seams.ts).
  weldSceneMorphSeams(gltf.scene);
  return { gltf, durations: Object.fromEntries(gltf.animations.map((a) => [a.name, a.duration])) };
}

function acquire(source: Pick<MonRigSource, 'key' | 'glb'>): Promise<Parsed> {
  let entry = cache.get(source.key);
  if (!entry) {
    const promise = parse(source);
    entry = { promise, refs: 0, drop: null };
    cache.set(source.key, entry);
    promise.catch(() => {
      if (cache.get(source.key)?.promise === promise) cache.delete(source.key);
    });
  }
  if (entry.drop !== null) {
    clearTimeout(entry.drop);
    entry.drop = null;
  }
  entry.refs += 1;
  return entry.promise;
}

function release(key: string): void {
  const entry = cache.get(key);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  entry.drop = setTimeout(() => {
    if (cache.get(key) !== entry || entry.refs > 0) return;
    cache.delete(key);
    bytesCache.delete(key);
    entry.promise.then((p) => disposeObject(p.gltf.scene), () => undefined);
  }, KEEP_MS);
}

function disposeObject(root: THREE.Object3D): void {
  const seen = new Set<{ dispose: () => void }>();
  root.traverse((object) => {
    const mesh = object as Partial<THREE.Mesh>;
    if (mesh.geometry) seen.add(mesh.geometry);
    const materials = mesh.material === undefined ? [] : Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      seen.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) seen.add(value);
    }
  });
  for (const resource of seen) resource.dispose();
}

interface MorphSlot {
  readonly influences: number[];
  readonly index: number;
  readonly initial: number;
}

/**
 * One Baby on a stage: a clone of the shared parse with its own mixer, driven
 * by the idle engine (idle/engine.ts) exactly as MonModel3D drives it, clip
 * cleaning and all: the mood's base loop with the occasional flavor clip,
 * turns, steps and hops; the upper-body yaw spread from spine to head; the
 * mouth held at its rest pose wherever the playing clip leaves it still; and
 * idle blinks. Lip sync is not ported: nothing in the app sends speech cues.
 * `root` is the engine's root (its heading and step); the model sits inside
 * it centred on its bind-pose box, whose size is `size`.
 */
export class MonRig {
  readonly root: THREE.Group;
  readonly size: THREE.Vector3;
  private readonly key: string;
  private readonly model: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly animations: readonly THREE.AnimationClip[];
  private readonly durations: Readonly<Record<string, number>>;
  private readonly engine: IdleEngine;
  private readonly mouth: MonMouthRest | undefined;
  private readonly jaw: THREE.Object3D | null;
  private readonly jawBind: THREE.Quaternion;
  private readonly morphs = new Map<string, MorphSlot[]>();
  private readonly morphNames: string[] = [];
  private readonly bodyChain: { bone: THREE.Object3D; share: number }[];
  private clipsKey: string;
  private base: string | null = null;
  private actionId = 0;
  private actionKind: IdleAction['kind'] | null = null;
  private action: THREE.AnimationAction | null = null;
  /** Whether the playing clip moves the jaw, and which morphs it moves: the rest pose holds everything else. */
  private motion: { jaw: boolean; morphs: ReadonlySet<string> } = { jaw: false, morphs: new Set() };
  private readonly clipBase = { jaw: new THREE.Quaternion(), jawKnown: false, morphs: new Map<string, number>() };
  private clock = 0;
  private nextBlinkAt = 1.5 + Math.random() * 2;
  private blinkStart = -1;
  private disposed = false;

  static async create(source: MonRigSource): Promise<MonRig> {
    const parsed = await acquire(source);
    return new MonRig(source, parsed);
  }

  private constructor(source: MonRigSource, parsed: Parsed) {
    this.key = source.key;
    this.mouth = source.mouth;
    this.model = cloneSkinned(parsed.gltf.scene);
    this.animations = parsed.gltf.animations;
    this.durations = parsed.durations;
    // Measured at the bind pose (arms out, its widest), with the bones' matrices current.
    const box = measurePosed(this.model);
    this.size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    this.model.position.sub(centre);
    this.root = new THREE.Group();
    this.root.name = `Mon_${source.key}`;
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    // Bind every clip now: a clip's first clipAction() builds its bindings, a hitch at the first switch.
    for (const clip of this.animations) this.mixer.clipAction(clip);
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.morphTargetDictionary || !m.morphTargetInfluences) return;
      for (const [name, index] of Object.entries(m.morphTargetDictionary)) {
        this.morphNames[index] ??= name;
        const list = this.morphs.get(name) ?? [];
        list.push({ influences: m.morphTargetInfluences, index, initial: m.morphTargetInfluences[index] ?? 0 });
        this.morphs.set(name, list);
      }
    });
    this.jaw = this.mouth ? (this.model.getObjectByName(this.mouth.jawBone) ?? null) : null;
    this.jawBind = this.jaw ? this.jaw.quaternion.clone() : new THREE.Quaternion();
    const chain = BODY_YAW_CHAIN.flatMap(([name, share]) => {
      const bone = this.model.getObjectByName(name);
      return bone ? [{ bone, share }] : [];
    });
    const total = chain.reduce((a, b) => a + b.share, 0) || 1;
    this.bodyChain = chain.map((b) => ({ ...b, share: b.share / total }));
    this.clipsKey = source.clips.join('\n');
    this.engine = createIdleEngine(resolveIdleClips(source.clips, this.durations), seedOf(source.key));
    // Pose it once before anyone shows it: the first base loop starts at full
    // weight (writeClips), so no frame ever shows the bind pose's T.
    this.update(0, { reduced: false, boundX: 0 });
  }

  /** The mood changed: the engine cross-fades to the new base on its next step. No reload. */
  setClips(clips: readonly string[]): void {
    const key = clips.join('\n');
    if (key === this.clipsKey) return;
    this.clipsKey = key;
    this.engine.setClips(resolveIdleClips(clips, this.durations));
  }

  /**
   * Plays the first of `clips` this GLB has, once, over the idle (M13's
   * `attention` and `approach`). Returns false when the file has none of
   * them, so the caller can fall back to the glass's nudge.
   */
  react(clips: readonly string[]): boolean {
    if (this.disposed) return false;
    const clip = clips.find((name) => this.durations[name] !== undefined);
    return clip === undefined ? false : this.engine.perform(clip);
  }

  /**
   * How far the body reaches either side of its centre in any pose the idle
   * engine can leave it in (facing front, side-on after a turn, mid-walk),
   * plus a margin for the mesh around the bones; at most `fallback`.
   */
  halfSpan(fallback: number): number {
    const centre = new THREE.Vector3();
    this.root.getWorldPosition(centre);
    const p = new THREE.Vector3();
    let span = 0;
    const base = resolveIdleClips(this.clipsKey === '' ? [] : this.clipsKey.split('\n'), this.durations).base;
    const measure = (name: string | null, axes: readonly ('x' | 'z')[]) => {
      const clip = name ? THREE.AnimationClip.findByName(this.animations as THREE.AnimationClip[], name) : null;
      if (!clip) return;
      const action = this.mixer.clipAction(clip);
      action.play();
      for (const f of [0, 0.25, 0.5, 0.75]) {
        action.time = f * clip.duration;
        this.mixer.update(0);
        this.root.updateMatrixWorld(true);
        this.model.traverse((o) => {
          if (!(o as THREE.Bone).isBone) return;
          o.getWorldPosition(p);
          for (const axis of axes) span = Math.max(span, Math.abs(p[axis] - centre[axis]));
        });
      }
      action.stop();
    };
    measure(base, ['x', 'z']);
    measure('up_walk', ['z']);
    return span > 0 ? Math.min(fallback, span + 0.08) : fallback;
  }

  /** Advances the idle engine and the mixer by `dt` seconds and poses the face on top. */
  update(dt: number, inputs: MonRigInputs): void {
    if (this.disposed) return;
    const step = Math.min(Math.max(dt, 0), 0.05);
    this.clock += step;
    const f = this.engine.step(step, {
      speaking: false, utteranceId: null, gesture: null, utteranceS: 0, listening: false,
      reduced: inputs.reduced, boundX: inputs.boundX,
    });
    this.writeClips(f);
    // The root never spins: its heading only changes when a turn clip hands one over.
    this.root.rotation.y = f.rootYaw;
    this.root.position.x = f.rootX;
    this.restoreBase();
    this.mixer.update(step);
    this.recordBase();
    this.writeBodyYaw(f.bodyYaw);
    this.applyRest();
    this.applyBlink();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction();
    this.root.removeFromParent();
    release(this.key);
  }

  private readMorph(name: string): number {
    const slot = this.morphs.get(name)?.[0];
    return slot ? (slot.influences[slot.index] ?? 0) : 0;
  }

  private writeMorph(name: string, value: number): void {
    for (const s of this.morphs.get(name) ?? []) s.influences[s.index] = value;
  }

  /** What the playing clip moves: a track whose keys never change counts as still, so the rest pose wins over it. */
  private clipMotion(clip: THREE.AnimationClip | null): { jaw: boolean; morphs: ReadonlySet<string> } {
    const morphs = new Set<string>();
    if (!clip) return { jaw: false, morphs };
    const jawNode = this.mouth ? THREE.PropertyBinding.sanitizeNodeName(this.mouth.jawBone) : null;
    let jaw = false;
    for (const track of clip.tracks) {
      const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(track.name);
      const v = track.values;
      if (propertyName === 'quaternion' && nodeName === jawNode) {
        for (let i = 4; i < v.length && !jaw; i++) if (Math.abs((v[i] ?? 0) - (v[i % 4] ?? 0)) > EPS) jaw = true;
      } else if (propertyName === 'morphTargetInfluences') {
        const width = v.length / Math.max(1, track.times.length);
        for (let n = 0; n < width; n++) {
          const name = this.morphNames[n];
          if (name === undefined || morphs.has(name)) continue;
          for (let k = 1; k < track.times.length; k++) {
            if (Math.abs((v[k * width + n] ?? 0) - (v[n] ?? 0)) > EPS) {
              morphs.add(name);
              break;
            }
          }
        }
      }
    }
    return { jaw, morphs };
  }

  /** Plays what the engine asks for: a base loop, and over it at most one action (MonModel3D writeClips). */
  private writeClips(f: IdleFrame): void {
    const clipAction = (name: string | null) => {
      const clip = name ? THREE.AnimationClip.findByName(this.animations as THREE.AnimationClip[], name) : null;
      return clip ? this.mixer.clipAction(clip) : null;
    };
    const actionChanged = (f.action?.id ?? 0) !== this.actionId;
    const baseChanged = f.base !== this.base;
    if (!actionChanged && !baseChanged) return;
    const prevKind = this.actionKind;
    const prevAction = this.actionId !== 0 ? this.action : null;
    const base = clipAction(f.base);
    const next = f.action ? clipAction(f.action.clip) : null;
    // A turn clip ends a quarter turn round and the engine hands that turn to the root on this frame: cut, never blend.
    // The very first loop also cuts in: there is nothing to fade from but the bind pose.
    const cut = (actionChanged && prevKind === 'turn') || (this.base === null && this.actionId === 0 && this.action === null);
    const show = next ?? base;
    const fadeS = next ? f.action!.fadeS : prevKind === null ? idleConfig.crossfadeS : idleConfig.actionFadeS;
    for (const other of [prevAction, this.base !== f.base ? clipAction(this.base) : null]) {
      if (!other || other === show) continue;
      if (cut || fadeS === 0) other.stop();
      else other.fadeOut(fadeS);
    }
    if (next) {
      next.reset();
      next.setLoop(f.action!.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      next.clampWhenFinished = true;
      if (base && base !== next) base.fadeOut(cut || fadeS === 0 ? 0.001 : fadeS);
    } else if (base && actionChanged) {
      base.reset();
    }
    if (show) {
      show.enabled = true; // a finished fade-out disables an action
      show.setEffectiveTimeScale(1).play();
      if (cut || fadeS === 0) show.stopFading().setEffectiveWeight(1);
      else show.fadeIn(fadeS);
    }
    this.base = f.base;
    this.actionId = f.action?.id ?? 0;
    this.actionKind = f.action?.kind ?? null;
    this.action = show;
    this.motion = this.clipMotion(show?.getClip() ?? null);
  }

  /** The engine's upper-body yaw, spread from spine to head about the world's up axis, so the feet stay planted. */
  private writeBodyYaw(yaw: number): void {
    if (Math.abs(yaw) < 1e-4) return;
    const parents = this.bodyChain.map(({ bone }) => (bone.parent ? bone.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion()));
    const qDelta = new THREE.Quaternion();
    const qYaw = new THREE.Quaternion();
    this.bodyChain.forEach(({ bone, share }, i) => {
      const qParent = parents[i]!;
      qYaw.setFromAxisAngle(Y_AXIS, yaw * share);
      qDelta.copy(qParent).invert().multiply(qYaw).multiply(qParent);
      bone.quaternion.premultiply(qDelta);
    });
  }

  /**
   * The mixer skips writing a value that has not changed, so a clip holding a
   * face still writes it once. Restoring the clip's own last value before the
   * mixer (and recording it after) keeps the face from flicking to bind.
   */
  private restoreBase(): void {
    if (this.jaw) this.jaw.quaternion.copy(this.clipBase.jawKnown ? this.clipBase.jaw : this.jawBind);
    for (const name of BLINK_CHANNELS) {
      const v = this.clipBase.morphs.get(name);
      if (v === undefined) for (const s of this.morphs.get(name) ?? []) s.influences[s.index] = s.initial;
      else this.writeMorph(name, v);
    }
    for (const name of Object.keys(this.mouth?.rest ?? {})) {
      const v = this.clipBase.morphs.get(name);
      if (v !== undefined) this.writeMorph(name, v);
    }
  }

  private recordBase(): void {
    if (this.jaw) {
      this.clipBase.jaw.copy(this.jaw.quaternion);
      this.clipBase.jawKnown = true;
    }
    for (const name of [...BLINK_CHANNELS, ...Object.keys(this.mouth?.rest ?? {})]) {
      if (this.morphs.has(name)) this.clipBase.morphs.set(name, this.readMorph(name));
    }
  }

  /** Holds every channel the clip leaves still at the rig's rest pose (jaw shut, lips together). */
  private applyRest(): void {
    const m = this.mouth;
    if (!m) return;
    if (this.jaw && !this.motion.jaw) {
      this.jaw.quaternion.copy(this.jawBind).multiply(new THREE.Quaternion().setFromAxisAngle(X_AXIS, m.jawClosedRad));
    }
    for (const [name, value] of Object.entries(m.rest)) if (!this.motion.morphs.has(name)) this.writeMorph(name, value);
  }

  /** Idle blinks, only while the playing clip does not animate the face itself. */
  private applyBlink(): void {
    const a = this.action;
    const facial = a?.getClip().tracks.some((t) => t.name.includes('morphTargetInfluences')) ?? false;
    if (facial && (a?.getEffectiveWeight() ?? 0) > 0.5) return;
    if (this.blinkStart < 0 && this.clock >= this.nextBlinkAt) this.blinkStart = this.clock;
    if (this.blinkStart < 0) return;
    const v = blinkCurve(this.clock - this.blinkStart);
    for (const ch of BLINK_CHANNELS) this.writeMorph(ch, Math.max(this.readMorph(ch), v));
    if (this.clock - this.blinkStart > 0.26) {
      this.blinkStart = -1;
      this.nextBlinkAt = this.clock + 2.5 + Math.random() * 3.5;
    }
  }
}
