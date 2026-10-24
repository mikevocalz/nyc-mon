'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { parseSpeechCue, sampleSpeechTrack, utteranceTimeMs, type MonSpeechCue } from './lipsync/cue.ts';
import { EXPRESSION_CHANNELS, mouthToRig, SPEECH_CHANNELS, type RigTargets } from './lipsync/retarget.ts';
import { damp } from './lipsync/smoothing.ts';
import { idleConfig } from './idle/config.ts';
import { createIdleEngine, resolveIdleClips, type IdleAction, type IdleEngine, type IdleFrame } from './idle/engine.ts';

/**
 * One Mon GLB on a small lit stage, drawn with three.js (WebGL). Plays the
 * first clip named in `clips` that the file has, else holds the bind pose;
 * a new `clips` list cross-fades in place (no reload). With `speech` and a
 * `mouth` rig, the jaw and mouth morphs follow the utterance on top of the
 * clip. Used by the MCP Apps Mon card; Viro stays in the Payload console.
 */
export interface MonModel3DProps {
  readonly url: string;
  /** Preferred clips, first match wins. A change cross-fades over 0.4 s. */
  readonly clips?: readonly string[];
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly onError?: (error: unknown) => void;
  /** Shown in the box when the GLB fails to load; defaults to a short label. */
  readonly fallback?: ReactNode;
  /** How this model's jaw opens. Without it the Mon does not lip-sync. */
  readonly mouth?: MouthRig;
  /**
   * The latest speech cue from the host. A new `start` id begins an
   * utterance, aligned to the audio by its `elapsedMs`; a `start` with the
   * same id and a different track (the face arriving mid-line) swaps the track
   * in place; `stop` (or reaching `durationMs`) relaxes the mouth back to the clip.
   */
  readonly speech?: MonSpeechCue | null;
}

/**
 * The jaw bone and its range, as rotations about the bone's local X axis
 * relative to its bind pose (radians; opening is negative on both rigs).
 */
export interface MouthRig {
  readonly jawBone: string;
  /** The jaw angle with the mouth shut: the rest pose whenever the clip does not move the jaw. */
  readonly jawClosedRad: number;
  /** The jaw angle at full speech opening. */
  readonly jawOpenRad: number;
  /**
   * Morph weights that make this model's resting face, by target name. A
   * file whose neutral geometry has the mouth open (Lil' Ratti: every weight
   * 0 is an open mouth) needs `{ mouthClose: … }` here. Applied to every
   * channel the playing clip does not move; speech opens the mouth from it
   * and returns to it.
   */
  readonly rest: Readonly<Record<string, number>>;
}

/**
 * How long the Mon keeps facing the viewer after an utterance ends. A reply is
 * spoken one sentence per utterance with a short gap between clips (the next
 * one's audio still decoding, or its TTS still on the way); without the hold
 * the turntable resumed in every gap and the Mon swung away mid-reply.
 */
const FACE_HOLD_MS = 1200;
/** The spine-to-head chain the idle engine's upper-body yaw is spread over, with each bone's share. */
const BODY_YAW_CHAIN: readonly (readonly [string, number])[] = [
  ['spine_01', 0.15],
  ['spine_02', 0.15],
  ['spine_03', 0.2],
  ['chest', 0.2],
  ['neck', 0.15],
  ['head', 0.15],
];
const Y_AXIS = new THREE.Vector3(0, 1, 0);
/** A stable seed per model file, so a Mon moves the same way each time it loads. */
function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

const NO_CLIPS: readonly string[] = [];
const X_AXIS = new THREE.Vector3(1, 0, 0);

/** Smoothing rates (per second): the mouth follows syllables, the envelope eases in and out. */
const MOUTH_RATE = 24;
const FACE_RATE = 40;
const ENVELOPE_IN = 14;
/** Back to the rest pose within about 150 ms of the audio ending (time constant 50 ms). */
const ENVELOPE_OUT = 20;
/** Speech keeps owning the mouth this long after the audio's end, so the last syllable closes. */
const TAIL_MS = 120;

const REST_TARGETS: RigTargets = { ...mouthToRig({ open: 0, wide: 0, round: 0, upper: 0 }) };
const DRIVEN = [...SPEECH_CHANNELS, ...EXPRESSION_CHANNELS].filter((c) => c !== 'jaw');
const BLINK_CHANNELS = ['lid_L', 'lid_R'] as const;

interface MorphSlot {
  readonly influences: number[];
  readonly index: number;
  /** The file's own weight for this target (glTF mesh.weights). */
  readonly initial: number;
}

interface Rig {
  readonly jaw: THREE.Object3D | null;
  readonly jawBind: THREE.Quaternion;
  /** Every mesh slot per morph name (a multi-primitive body has one mesh per primitive). */
  readonly morphs: ReadonlyMap<string, readonly MorphSlot[]>;
  /** Morph names by index, the order animation tracks list their values in. */
  readonly morphNames: readonly string[];
}

/** What the playing clip actually moves: anything it leaves still is held at the rig's rest. */
interface ClipMotion {
  readonly jaw: boolean;
  readonly morphs: ReadonlySet<string>;
}

interface AnimationState {
  readonly mixer: THREE.AnimationMixer;
  readonly animations: readonly THREE.AnimationClip[];
  /** The clip the eye sees most: the engine's action while one plays, else the base loop. */
  action: THREE.AnimationAction | null;
  motion: ClipMotion;
  /** The idle engine (idle/engine.ts) decides what plays; this file only writes it. */
  engine: IdleEngine;
  base: string | null;
  actionId: number;
  actionKind: IdleAction['kind'] | null;
  /** How far the root may step either side of centre, model units. */
  boundX: number;
}

const STILL: ClipMotion = { jaw: false, morphs: new Set() };
const EPS = 1e-3;

/**
 * Which channels a clip moves. A track whose keys never change (Squeaklet's
 * idle clips hold the jaw at its ajar bind angle) counts as still, so the
 * rest pose wins over it.
 */
function clipMotion(clip: THREE.AnimationClip | null, rig: Rig, jawBone: string | undefined): ClipMotion {
  if (!clip) return STILL;
  const jawNode = jawBone === undefined ? null : THREE.PropertyBinding.sanitizeNodeName(jawBone);
  let jaw = false;
  const morphs = new Set<string>();
  for (const track of clip.tracks) {
    const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(track.name);
    const v = track.values;
    if (propertyName === 'quaternion' && nodeName === jawNode) {
      for (let i = 4; i < v.length && !jaw; i++) if (Math.abs((v[i] ?? 0) - (v[i % 4] ?? 0)) > EPS) jaw = true;
    } else if (propertyName === 'morphTargetInfluences') {
      const width = v.length / Math.max(1, track.times.length);
      for (let n = 0; n < width; n++) {
        const name = rig.morphNames[n];
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

function pickClip(animations: readonly THREE.AnimationClip[], names: readonly string[]): THREE.AnimationClip | null {
  for (const n of names) {
    const clip = THREE.AnimationClip.findByName(animations as THREE.AnimationClip[], n);
    if (clip) return clip;
  }
  return null;
}

function clipAnimatesMorphs(clip: THREE.AnimationClip | undefined): boolean {
  return clip?.tracks.some((t) => t.name.includes('morphTargetInfluences')) ?? false;
}

function readRig(model: THREE.Object3D, mouth: MouthRig | undefined): Rig {
  const morphs = new Map<string, MorphSlot[]>();
  const morphNames: string[] = [];
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.morphTargetDictionary || !m.morphTargetInfluences) return;
    for (const [name, index] of Object.entries(m.morphTargetDictionary)) {
      morphNames[index] ??= name;
      const list = morphs.get(name) ?? [];
      list.push({ influences: m.morphTargetInfluences, index, initial: m.morphTargetInfluences[index] ?? 0 });
      morphs.set(name, list);
    }
  });
  const jaw = mouth ? (model.getObjectByName(mouth.jawBone) ?? null) : null;
  return { jaw, jawBind: jaw ? jaw.quaternion.clone() : new THREE.Quaternion(), morphs, morphNames };
}

function readMorph(rig: Rig, name: string): number {
  const slot = rig.morphs.get(name)?.[0];
  return slot ? (slot.influences[slot.index] ?? 0) : 0;
}

function writeMorph(rig: Rig, name: string, value: number): void {
  for (const s of rig.morphs.get(name) ?? []) s.influences[s.index] = value;
}

function resetMorph(rig: Rig, name: string): void {
  for (const s of rig.morphs.get(name) ?? []) s.influences[s.index] = s.initial;
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
 * body turns (measured: the head's world yaw goes 0.32 → 0 while chest, hips
 * and feet go 0 → ±π/2), so each one ends with the head a quarter turn round
 * from the body, and the cut to the idle at the new heading snapped it back,
 * or showed the back of the head on the way round. Holding the head and neck
 * at their bind rotation for these clips turns the Mon as one piece.
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

/**
 * How far the body reaches either side of its centre on screen, in any pose
 * the idle engine can leave it in: facing front in the base loop (bones' x),
 * and side-on after a quarter turn or mid-walk, when its depth (bones' z,
 * tail included) becomes its width. Plus a margin for the mesh around the bones.
 */
function bodyHalfSpan(model: THREE.Object3D, mixer: THREE.AnimationMixer, animations: readonly THREE.AnimationClip[], base: string | null, fallback: number): number {
  const centre = new THREE.Vector3();
  model.parent?.getWorldPosition(centre);
  const p = new THREE.Vector3();
  let span = 0;
  const measure = (name: string | null, axes: readonly ('x' | 'z')[]) => {
    const clip = name ? pickClip(animations, [name]) : null;
    if (!clip) return;
    const action = mixer.clipAction(clip);
    action.play();
    for (const f of [0, 0.25, 0.5, 0.75]) {
      action.time = f * clip.duration;
      mixer.update(0);
      model.updateMatrixWorld(true);
      model.traverse((o) => {
        if (!(o as THREE.Bone).isBone) return;
        o.getWorldPosition(p);
        for (const axis of axes) span = Math.max(span, Math.abs(p[axis] - centre[axis]));
      });
    }
    action.stop();
  };
  measure(base, ['x', 'z']);
  measure('up_walk', ['z']);
  // Hoodie, sneakers and paws sit outside their bones by about this much (Lil’ Ratti; checked on the boot frame strip).
  return span > 0 ? Math.min(fallback, span + 0.08) : fallback;
}

export function MonModel3D({
  url,
  clips = NO_CLIPS,
  width,
  height,
  label,
  onError,
  fallback,
  mouth,
  speech = null,
}: MonModel3DProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  // Latest props for the load callback and the frame loop, without re-running the GLB effect.
  const clipsRef = useRef(clips);
  const onErrorRef = useRef(onError);
  const sizeRef = useRef({ width, height });
  const mouthRef = useRef(mouth);
  // Declared first so it runs before the GLB effect below.
  useEffect(() => {
    clipsRef.current = clips;
    onErrorRef.current = onError;
    sizeRef.current = { width, height };
    mouthRef.current = mouth;
  });

  const stage = useRef<{ renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera } | null>(null);
  const anim = useRef<AnimationState | null>(null);
  const rigRef = useRef<Rig | null>(null);
  /** The utterance in progress: its track and when (performance.now) its audio started. */
  const utterance = useRef<{ cue: Extract<MonSpeechCue, { kind: 'start' }>; receivedAt: number } | null>(null);
  /** performance.now() until which the Mon holds its face to the viewer after the last utterance ended. */
  const faceHoldUntil = useRef(0);
  /** The host's microphone is open: the Mon looks and listens. */
  const listening = useRef(false);

  // Renderer, scene and GLB: once per url (the files are 26-34 MB).
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    setState('loading');
    const { width: w, height: h } = sizeRef.current;
    // No WebGL (blocked, lost, or an old webview) must fall back to the caller's
    // still, not throw inside the effect and take the whole view down.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
      setState('error');
      onErrorRef.current?.(error);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    const canvas = renderer.domElement;

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(1.5, 3, 2.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff5a5a, 0.8);
    rim.position.set(-2, 2, -2);
    scene.add(rim);
    const camera = new THREE.PerspectiveCamera(30, w / h, 0.01, 50);
    stage.current = { renderer, camera };

    let rig: Rig | null = null;
    let root: THREE.Object3D | null = null;
    let bodyChain: { bone: THREE.Object3D; share: number }[] = [];
    let shoulders: [THREE.Object3D | null, THREE.Object3D | null] = [null, null];
    const qParent = new THREE.Quaternion();
    const qDelta = new THREE.Quaternion();
    const qYaw = new THREE.Quaternion();
    const vL = new THREE.Vector3();
    const vR = new THREE.Vector3();
    let frame = 0;
    let disposed = false;
    const timer = new THREE.Timer();
    timer.connect(document); // zero delta while the tab is hidden

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    // Speech state, smoothed per channel.
    const current: Record<string, number> = { ...REST_TARGETS };
    let envelope = 0;
    let shown = '';
    const closedQuat = new THREE.Quaternion();
    let nextBlinkAt = 1.5 + Math.random() * 2;
    let blinkStart = -1;
    let clock = 0;
    const jawTarget = new THREE.Quaternion();
    const jawDelta = new THREE.Quaternion();

    // Embedded textures decode from blob: URLs. GLTFLoader's ImageBitmapLoader
    // fetch()es them, which connect-src governs, and an MCP Apps host only puts
    // declared origins there, so the Mon renders untextured in the Alexa card.
    // TextureLoader decodes through <img> under img-src, which allows blob:
    // (the path GLTFLoader already takes on older Safari).
    new GLTFLoader()
      .register((parser) => {
        parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
        return { name: 'NYC_MON_IMG_TEXTURES' };
      })
      .load(
      url,
      (gltf) => {
        if (disposed) return;
        gltf.scene.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) o.frustumCulled = false;
        });
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        // Spin about the model's own centre, not the file origin.
        model.position.set(-centre.x, -centre.y, -centre.z);
        root = new THREE.Group();
        root.add(model);
        scene.add(root);
        // Fit the cylinder the turntable sweeps, so tails and arms never clip.
        // Half the radius on top of the centre-plane fit covers the near edge
        // of the sweep; a full radius left the body small in its box.
        const radius = Math.hypot(size.x, size.z) / 2;
        const vHalf = (camera.fov * Math.PI) / 360;
        const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
        const dist = Math.max(size.y / 2 / Math.tan(vHalf), radius / Math.tan(hHalf)) * 1.08 + radius * 0.5;
        camera.position.set(0, size.y * 0.08, dist);
        camera.lookAt(0, 0, 0);
        rig = readRig(model, mouthRef.current);
        holdHeadInTurns(gltf.animations, model);
        const mixer = new THREE.AnimationMixer(model);
        const durations = Object.fromEntries(gltf.animations.map((a) => [a.name, a.duration]));
        const engine = createIdleEngine(resolveIdleClips(clipsRef.current, durations), seedOf(url));
        // Steps stay inside 90% of the frame with the whole body in view, facing front.
        // The box above is the bind pose (arms out); the body stands narrower
        // facing front, and reaches further side-on (the tail trails a walk).
        const visibleHalf = dist * Math.tan(hHalf);
        const boundX = Math.max(0, visibleHalf * 0.9 - bodyHalfSpan(model, mixer, gltf.animations, resolveIdleClips(clipsRef.current, durations).base, radius));
        anim.current = { mixer, animations: gltf.animations, action: null, motion: STILL, engine, base: null, actionId: 0, actionKind: null, boundX };
        bodyChain = BODY_YAW_CHAIN.flatMap(([name, share]) => {
          const bone = model.getObjectByName(name);
          return bone ? [{ bone, share }] : [];
        });
        const total = bodyChain.reduce((a, b) => a + b.share, 0) || 1;
        bodyChain = bodyChain.map((b) => ({ ...b, share: b.share / total }));
        shoulders = [model.getObjectByName('shoulder_L') ?? null, model.getObjectByName('shoulder_R') ?? null];
        rigRef.current = rig;
        setState('ready');
      },
      undefined,
      (error) => {
        if (disposed) return;
        setState('error');
        onErrorRef.current?.(error);
      },
    );

    /** Puts every channel speech or blinking writes back to its bind value, so the clip (or nothing) sets the base each frame. */
    const restoreBase = (r: Rig) => {
      r.jaw?.quaternion.copy(r.jawBind);
      for (const name of DRIVEN) resetMorph(r, name);
      for (const name of BLINK_CHANNELS) resetMorph(r, name);
    };

    /** Holds every channel the clip leaves still at the rig's rest pose (jaw shut, lips together). */
    const applyRest = (r: Rig) => {
      const m = mouthRef.current;
      if (!m) return;
      const motion = anim.current?.motion ?? STILL;
      if (r.jaw && !motion.jaw) r.jaw.quaternion.copy(r.jawBind).multiply(jawDelta.setFromAxisAngle(X_AXIS, m.jawClosedRad));
      for (const [name, value] of Object.entries(m.rest)) if (!motion.morphs.has(name)) writeMorph(r, name, value);
    };

    const applySpeech = (r: Rig, dt: number) => {
      const m = mouthRef.current;
      if (!m) return;
      const u = utterance.current;
      const now = performance.now();
      const gain = reduced?.matches ? 0.6 : 1;
      let targets = REST_TARGETS;
      let speaking = false;
      if (u) {
        const t = utteranceTimeMs(u.cue, u.receivedAt, now);
        if (t > u.cue.durationMs + TAIL_MS) {
          utterance.current = null;
          faceHoldUntil.current = now + FACE_HOLD_MS;
        } else {
          speaking = true;
          targets = t <= u.cue.durationMs ? sampleSpeechTrack(u.cue.track, t, { amplitude: gain, vary: !reduced?.matches }) : REST_TARGETS;
        }
      }
      envelope = damp(envelope, speaking ? 1 : 0, speaking ? ENVELOPE_IN : ENVELOPE_OUT, dt);
      const rate = u?.cue.track.kind === 'face' ? FACE_RATE : MOUTH_RATE;
      for (const ch of [...SPEECH_CHANNELS, ...EXPRESSION_CHANNELS]) {
        current[ch] = damp(current[ch] ?? 0, targets[ch] ?? REST_TARGETS[ch] ?? 0, rate, dt);
      }
      if (envelope < 1e-3) return;
      if (r.jaw) {
        const angle = m.jawClosedRad + (m.jawOpenRad - m.jawClosedRad) * (current.jaw ?? 0);
        jawTarget.copy(r.jawBind).multiply(jawDelta.setFromAxisAngle(X_AXIS, angle));
        r.jaw.quaternion.slerp(jawTarget, envelope);
      }
      for (const ch of SPEECH_CHANNELS) {
        if (ch === 'jaw') continue;
        const base = readMorph(r, ch);
        // Speech opens the lips from the rig's own rest closure, not from 1.
        const target = ch === 'mouthClose' ? (current[ch] ?? 1) * (m.rest.mouthClose ?? 1) : (current[ch] ?? 0);
        writeMorph(r, ch, base + (target - base) * envelope);
      }
      // Expressions merge by per-channel max: an emote keeps its brows while the Mon talks.
      for (const ch of EXPRESSION_CHANNELS) {
        writeMorph(r, ch, Math.max(readMorph(r, ch), (current[ch] ?? 0) * envelope));
      }
    };

    /**
     * Read-only debug hook for the boot test, read off the rig itself:
     * `data-mouth-open` is the jaw's opening from its shut angle (0..1 of the
     * speech range), `data-mouth-close` the mouthClose influence.
     */
    const report = (r: Rig) => {
      const m = mouthRef.current;
      if (!m || !r.jaw) return;
      closedQuat.copy(r.jawBind).multiply(jawDelta.setFromAxisAngle(X_AXIS, m.jawClosedRad));
      const range = Math.abs(m.jawOpenRad - m.jawClosedRad) || 1;
      const open = Math.min(1, r.jaw.quaternion.angleTo(closedQuat) / range);
      const next = `${open.toFixed(2)} ${readMorph(r, 'mouthClose').toFixed(2)}`;
      if (next === shown) return;
      shown = next;
      canvas.dataset.mouthOpen = open.toFixed(2);
      canvas.dataset.mouthClose = readMorph(r, 'mouthClose').toFixed(2);
    };

    /** Idle blinks, only while the playing clip does not animate the face itself. */
    const applyBlink = (r: Rig) => {
      const a = anim.current?.action;
      if (clipAnimatesMorphs(a?.getClip()) && (a?.getEffectiveWeight() ?? 0) > 0.5) return;
      if (blinkStart < 0 && clock >= nextBlinkAt) blinkStart = clock;
      if (blinkStart >= 0) {
        const v = blinkCurve(clock - blinkStart);
        for (const ch of BLINK_CHANNELS) writeMorph(r, ch, Math.max(readMorph(r, ch), v));
        if (clock - blinkStart > 0.26) {
          blinkStart = -1;
          nextBlinkAt = clock + 2.5 + Math.random() * 3.5;
        }
      }
    };

    /** Plays what the engine asks for: a base loop, and over it at most one action. */
    const writeClips = (a: AnimationState, f: IdleFrame) => {
      const clipAction = (name: string | null) => {
        const clip = name ? pickClip(a.animations, [name]) : null;
        return clip ? a.mixer.clipAction(clip) : null;
      };
      const actionChanged = (f.action?.id ?? 0) !== a.actionId;
      const baseChanged = f.base !== a.base;
      if (!actionChanged && !baseChanged) return;
      const prevKind = a.actionKind;
      const prevAction = a.actionId !== 0 ? a.action : null;
      const base = clipAction(f.base);
      const next = f.action ? clipAction(f.action.clip) : null;
      // A turn clip ends a quarter turn round, and the engine hands that turn to
      // the root on this frame: cut, never blend, or the body swings back.
      const cut = actionChanged && prevKind === 'turn';
      const show = next ?? base;
      const fadeS = next ? f.action!.fadeS : prevKind === null ? idleConfig.crossfadeS : idleConfig.actionFadeS;
      for (const other of [prevAction, a.base !== f.base ? clipAction(a.base) : null]) {
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
      a.base = f.base;
      a.actionId = f.action?.id ?? 0;
      a.actionKind = f.action?.kind ?? null;
      a.action = show;
      a.motion = rig ? clipMotion(show?.getClip() ?? null, rig, mouthRef.current?.jawBone) : STILL;
    };

    /** The engine's upper-body yaw, spread from spine to head about the world's up axis, so the feet stay planted. */
    const writeBodyYaw = (yaw: number) => {
      if (Math.abs(yaw) < 1e-4) return;
      // Rotations about one world axis commute, so each bone's share uses its
      // parent's orientation from before any of them moved.
      const parents = bodyChain.map(({ bone }) => (bone.parent ? bone.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion()));
      bodyChain.forEach(({ bone, share }, i) => {
        qParent.copy(parents[i]!);
        qYaw.setFromAxisAngle(Y_AXIS, yaw * share);
        qDelta.copy(qParent).invert().multiply(qYaw).multiply(qParent);
        bone.quaternion.premultiply(qDelta);
      });
    };

    /** How far the chest is turned from the camera, radians, from the shoulder line (0 = square on). */
    const facingNow = (): number | null => {
      const [l, r] = shoulders;
      if (!l || !r || !root) return null;
      root.updateMatrixWorld(true);
      l.getWorldPosition(vL);
      r.getWorldPosition(vR);
      const chest = Math.atan2(-(vL.z - vR.z), vL.x - vR.x);
      const toCamera = Math.atan2(camera.position.x - (vL.x + vR.x) / 2, camera.position.z - (vL.z + vR.z) / 2);
      const d = chest - toCamera;
      return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
    };

    const tick = (now?: number) => {
      frame = requestAnimationFrame(tick);
      timer.update(now);
      const dt = Math.min(timer.getDelta(), 0.05);
      clock += dt;
      const a = anim.current;
      if (a && root) {
        const u = utterance.current;
        const f = a.engine.step(dt, {
          speaking: u !== null || performance.now() < faceHoldUntil.current,
          utteranceId: u?.cue.id ?? null,
          gesture: u?.cue.gesture ?? null,
          utteranceS: u ? u.cue.durationMs / 1000 : 0,
          listening: listening.current,
          reduced: reduced?.matches ?? false,
          boundX: a.boundX,
        });
        writeClips(a, f);
        // The root never spins: its heading only changes when a turn clip hands one over.
        root.rotation.y = f.rootYaw;
        root.position.x = f.rootX;
        canvas.dataset.rootX = f.rootX.toFixed(3);
        canvas.dataset.boundX = a.boundX.toFixed(3);
        canvas.dataset.clip = a.action?.getClip().name ?? '';
        if (rig) restoreBase(rig);
        a.mixer.update(dt);
        writeBodyYaw(f.bodyYaw);
      } else if (rig) {
        restoreBase(rig);
      }
      if (rig) {
        applyRest(rig);
        applySpeech(rig, dt);
        applyBlink(rig);
        report(rig);
      }
      const facing = facingNow();
      if (facing !== null) canvas.dataset.facing = facing.toFixed(2);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      stage.current = null;
      cancelAnimationFrame(frame);
      timer.dispose();
      anim.current?.mixer.stopAllAction();
      anim.current = null;
      rigRef.current = null;
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mat) => {
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
          mat.dispose();
        });
        (o as THREE.SkinnedMesh).skeleton?.dispose();
      });
      renderer.forceContextLoss();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url]);

  // A new clip list (the mood changed) goes to the engine, which cross-fades the base on its next step.
  const clipsKey = clips.join('\n');
  useEffect(() => {
    const a = anim.current;
    if (!a) return; // still loading: the load callback reads clipsRef
    a.engine.setClips(resolveIdleClips(clipsRef.current, Object.fromEntries(a.animations.map((c) => [c.name, c.duration]))));
  }, [clipsKey]);

  // Speech cues: a new start id aligns to the audio; stop ends it early.
  useEffect(() => {
    const cue = parseSpeechCue(speech);
    if (!cue) return;
    if (cue.kind === 'listen') {
      listening.current = cue.on;
      return;
    }
    if (cue.kind === 'stop') {
      if (utterance.current?.cue.id === cue.id) {
        utterance.current = null;
        faceHoldUntil.current = performance.now() + FACE_HOLD_MS;
      }
      return;
    }
    // The same utterance again is a repeat unless it brings a different track:
    // the Audio2Face face arriving mid-line. That one replaces the track and
    // re-anchors to the audio position the host stamped, without restarting.
    const playing = utterance.current;
    if (playing?.cue.id === cue.id && playing.cue.track.kind === cue.track.kind) return;
    utterance.current = { cue, receivedAt: performance.now() };
  }, [speech]);

  // Resize in place: no new context, no re-download.
  useEffect(() => {
    const s = stage.current;
    if (!s) return;
    s.renderer.setSize(width, height);
    s.camera.aspect = width / height;
    s.camera.updateProjectionMatrix();
  }, [width, height]);

  const failed = state === 'error';
  return (
    <div
      ref={host}
      role="img"
      aria-label={failed ? `${label}, model unavailable` : label}
      aria-busy={state === 'loading'}
      style={{ width, height, position: 'relative' }}
    >
      {failed ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            border: '2px dashed rgba(150, 150, 160, 0.45)',
            background: 'rgba(150, 150, 160, 0.08)',
            color: 'rgb(150, 150, 160)',
            fontSize: 14,
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          {fallback ?? 'Model unavailable'}
        </div>
      ) : null}
    </div>
  );
}
