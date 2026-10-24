'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createHatchLight, whitener } from './hatch-light.ts';
import { createHatchSound } from './hatch-sound.ts';
import { hatchDuration, hatchFrame, soundCues, type HatchPhase } from './hatch-timeline.ts';

/**
 * The hatch moment on one small stage (three.js), staged like a Pokémon egg
 * hatch with the evolution reveal (hatch-timeline.ts has the beats): the
 * stage dims, the egg shakes three times and cracks, light leaks through the
 * cracks and builds while sparkles spiral in, one white-out throws the shards
 * off, and the Baby comes out as a white silhouette that pulses between egg
 * shape and its own before resolving into colour. The evolution light
 * (hatch-light.ts) is the in-view twin of the Rive file
 * packages/assets/rive/hatch-evolve. When the moment ends it calls `onDone`
 * and keeps showing the Baby, so the caller can mount MonModel3D underneath
 * and drop this once that has loaded: the hand-over has no gap.
 *
 * Built apart from MonModel3D on purpose: same lights and the same framing
 * rule, so the last frame here matches MonModel3D's first.
 */
export interface HatchSequence3DProps {
  /** The egg rig with a `hatch` clip (metro-egg.glb). */
  readonly eggUrl: string;
  /** The Baby it hatches into (squeaklet.glb). */
  readonly monUrl: string;
  /** The Baby's idle clips, first match wins. */
  readonly monClips: readonly string[];
  readonly width: number;
  readonly height: number;
  readonly label: string;
  /** Spoken (polite live region) as each phase starts. */
  readonly announcements?: Partial<Record<HatchPhase, string>>;
  /** Reduced motion; defaults to the browser's `prefers-reduced-motion`. */
  readonly reducedMotion?: boolean;
  /** Original synthesized sound (crack, shimmer, whoosh, chime). On by default; plays only where the browser allows audio. */
  readonly sound?: boolean;
  /** The moment ended (or a model failed to load, so there is nothing to play). */
  readonly onDone?: () => void;
}

/** The egg rig's stand-in Baby; the real Baby replaces it. */
const PROXY_NODE = 'PROXY_Baby';
/** The rig's inside: membrane and goo, shown only once the shell is open. */
const INSIDE_NODES = ['Membrane', 'Goo_Puddle', 'Goo_Strand_01', 'Goo_Strand_02', 'Goo_Drip_01', 'Goo_Drip_02', 'Goo_Drip_03'];
/** Shell materials that glow when light leaks through the cracks: edge and inside strongly, the outside a little. */
const CRACK_GLOW: Readonly<Record<string, number>> = {
  'HATCH_M_metro-egg_ShellEdge': 4,
  'HATCH_M_metro-egg_ShellInner': 2.5,
  'Material_0.082': 0.08,
};
const CRACK_COLOR = new THREE.Color('#FD9D40');
/** Night (brand.night), the colour the stage dims toward. */
const NIGHT = '0, 4, 28';
/** The silhouette's egg shape: the Baby squeezed narrow and a little tall. */
const EGG_SHAPE = new THREE.Vector2(0.5, 1.12);

/** MonModel3D's framing: fits the turntable's sweep, camera slightly above centre. */
function framing(size: THREE.Vector3, camera: THREE.PerspectiveCamera): THREE.Vector3 {
  const radius = Math.hypot(size.x, size.z) / 2;
  const vHalf = (camera.fov * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  const dist = Math.max(size.y / 2 / Math.tan(vHalf), radius / Math.tan(hHalf)) * 1.08 + radius * 0.5;
  return new THREE.Vector3(0, size.y * 0.08, dist);
}

/** Centres the model on its own box (as MonModel3D does) and returns its size. */
function centre(model: THREE.Object3D): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.set(-c.x, -c.y, -c.z);
  return box.getSize(new THREE.Vector3());
}

/**
 * Per-instance materials that can fade; returns a setter. `keepDepth` keeps
 * depth writes on while fading, so a closed shell hides what is inside it
 * instead of showing it through.
 */
function fader(model: THREE.Object3D, keepDepth = false): (opacity: number) => void {
  const mats: { mat: THREE.Material; opacity: number; transparent: boolean }[] = [];
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const own = list.map((m) => m.clone());
    mesh.material = Array.isArray(mesh.material) ? own : own[0]!;
    for (const mat of own) mats.push({ mat, opacity: mat.opacity, transparent: mat.transparent });
  });
  let last = -1;
  return (opacity) => {
    if (Math.abs(opacity - last) < 1e-3) return;
    last = opacity;
    for (const m of mats) {
      // Opaque again once fully shown, so a skinned body sorts normally.
      const fading = opacity < 0.999;
      if (m.mat.transparent !== (fading || m.transparent)) {
        m.mat.transparent = fading || m.transparent;
        m.mat.needsUpdate = true;
      }
      m.mat.opacity = m.opacity * opacity;
      m.mat.depthWrite = keepDepth || !fading;
    }
    model.visible = opacity > 1e-3;
  };
}

/** The shell's crack glow: emissive orange on the edge, inside and (faintly) outside materials. */
function crackGlow(model: THREE.Object3D): (level: number) => void {
  const mats: { mat: THREE.MeshStandardMaterial; gain: number }[] = [];
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const gain = CRACK_GLOW[mat.name];
      if (gain && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) mats.push({ mat: mat as THREE.MeshStandardMaterial, gain });
    }
  });
  for (const { mat } of mats) mat.emissive = CRACK_COLOR.clone();
  return (level) => {
    for (const { mat, gain } of mats) mat.emissiveIntensity = level * gain;
  };
}

function loadGlb(url: string): Promise<GLTF> {
  // Same texture path as MonModel3D: <img> decoding, which an MCP Apps CSP allows for blob:.
  return new GLTFLoader()
    .register((parser) => {
      parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
      return { name: 'NYC_MON_IMG_TEXTURES' };
    })
    .loadAsync(url);
}

export function HatchSequence3D({ eggUrl, monUrl, monClips, width, height, label, announcements, reducedMotion, sound = true, onDone }: HatchSequence3DProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const dimRef = useRef<HTMLDivElement | null>(null);
  const whiteRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<HatchPhase | 'loading'>('loading');
  /** The last phase line said; a phase with no line keeps the previous one, so nothing is re-read. */
  const [said, setSaid] = useState('');
  const latest = useRef({ onDone, monClips, reducedMotion, width, height, announcements, sound });
  useEffect(() => {
    latest.current = { onDone, monClips, reducedMotion, width, height, announcements, sound };
  });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const { width: w, height: h } = latest.current;
    const reduced = latest.current.reducedMotion ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const canvas = renderer.domElement;
    canvas.style.position = 'relative';
    el.appendChild(canvas);
    canvas.dataset.hatchPhase = 'loading';

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(1.5, 3, 2.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff5a5a, 0.8);
    rim.position.set(-2, 2, -2);
    scene.add(rim);
    const camera = new THREE.PerspectiveCamera(30, w / h, 0.01, 50);

    let disposed = false;
    let frame = 0;
    let done = false;
    let shown: HatchPhase | 'loading' = 'loading';
    const timer = new THREE.Timer();
    timer.connect(document);
    type Egg = { mixer: THREE.AnimationMixer; action: THREE.AnimationAction | null; fade: (o: number) => void; white: (a: number) => void; glow: (l: number) => void; pivot: THREE.Group; cam: THREE.Vector3; size: THREE.Vector3 };
    let egg: Egg | null = null;
    /**
     * `fit` scales the Baby into the egg's camera: a Baby file is many times
     * the egg's size, so at fit 1 it would fill the frame. Scaled by the ratio
     * of the two framing distances, it stands at the size MonModel3D gives it.
     */
    let mon: { mixer: THREE.AnimationMixer; root: THREE.Group; fade: (o: number) => void; white: (a: number) => void; cam: THREE.Vector3; fit: number; size: THREE.Vector3 } | null = null;
    let light: ReturnType<typeof createHatchLight> | null = null;
    const audio = latest.current.sound ? createHatchSound() : null;
    let cues = soundCues(reduced).slice();
    let started = -1;
    let clock = 0;
    const camPos = new THREE.Vector3();

    const finish = () => {
      if (done) return;
      done = true;
      latest.current.onDone?.();
    };

    // The egg is small and shows at once; the moment starts when the Baby is in too.
    const eggLoad = loadGlb(eggUrl).then((gltf) => {
      if (disposed) return;
      const model = gltf.scene;
      const proxy = model.getObjectByName(PROXY_NODE);
      if (proxy) proxy.visible = false;
      const size = centre(model);
      // Pivot at the egg's base, so the shakes rock it on the ground.
      const pivot = new THREE.Group();
      pivot.position.y = -size.y / 2;
      model.position.y += size.y / 2;
      pivot.add(model);
      scene.add(pivot);
      const mixer = new THREE.AnimationMixer(model);
      const clip = THREE.AnimationClip.findByName(gltf.animations, 'hatch');
      // Reduced motion still poses the egg on the clip's first frame (the whole
      // shell): the file's bind pose shows the membrane the clip hides.
      const action = clip ? mixer.clipAction(clip) : null;
      if (action) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
        action.paused = true; // driven by the timeline, not the mixer's clock
      }
      if (reduced) {
        // Nothing breaks open under reduced motion: the egg's insides never show.
        for (const name of INSIDE_NODES) {
          const node = model.getObjectByName(name);
          if (node) node.visible = false;
        }
      }
      const fade = fader(model, true);
      egg = { mixer, action, fade, white: whitener(model), glow: crackGlow(model), pivot, cam: framing(size, camera), size };
      camera.position.copy(egg.cam);
      camera.lookAt(0, 0, 0);
      light = createHatchLight(size.y);
      scene.add(light.group);
    });
    const monLoad = loadGlb(monUrl).then((gltf) => {
      if (disposed) return;
      const model = gltf.scene;
      const size = centre(model);
      const root = new THREE.Group();
      root.add(model);
      scene.add(root);
      const mixer = new THREE.AnimationMixer(model);
      for (const name of latest.current.monClips) {
        const clip = THREE.AnimationClip.findByName(gltf.animations, name);
        if (clip) {
          mixer.clipAction(clip).play();
          break;
        }
      }
      const fade = fader(model);
      fade(0);
      mon = { mixer, root, fade, white: whitener(model), cam: framing(size, camera), fit: 1, size };
    });
    Promise.all([eggLoad, monLoad]).then(
      () => {
        if (disposed || !egg || !mon) return;
        mon.fit = egg.cam.z / mon.cam.z;
        // Scaled into egg units, the Baby's own framing differs from the egg's only in height.
        mon.cam.multiplyScalar(mon.fit);
        started = clock;
        if (audio) void audio.start();
      },
      () => {
        // Nothing to play without both models: hand straight over to the Mon.
        if (!disposed) finish();
      },
    );

    const eggSquash = new THREE.Vector2(1, 1);
    const tick = (now?: number) => {
      frame = requestAnimationFrame(tick);
      timer.update(now);
      const dt = Math.min(timer.getDelta(), 0.05);
      clock += dt;
      if (started >= 0 && egg && mon) {
        const t = clock - started;
        const f = hatchFrame(t, reduced);
        if (egg.action) {
          egg.action.time = Math.min(f.clipTime ?? 0, egg.action.getClip().duration);
          egg.mixer.update(0);
        }
        egg.pivot.rotation.z = f.eggTilt;
        egg.fade(f.eggOpacity);
        egg.white(f.silhouette);
        egg.glow(f.crackLight);
        mon.fade(f.monOpacity);
        mon.white(f.silhouette);
        // Silhouette shape: squeeze the Baby toward the egg's narrow, tall outline and back.
        eggSquash.set(EGG_SHAPE.x, EGG_SHAPE.y);
        const s = f.monScale * mon.fit;
        mon.root.scale.set(s * THREE.MathUtils.lerp(1, eggSquash.x, f.monShape), s * THREE.MathUtils.lerp(1, eggSquash.y, f.monShape), s);
        mon.root.position.y = -f.monDrop * 0.12 * egg.size.y;
        if (f.monOpacity > 0) mon.mixer.update(dt);
        camPos.lerpVectors(egg.cam, mon.cam, f.camera);
        camera.position.copy(camPos);
        camera.lookAt(0, 0, 0);
        rim.intensity = 0.8 + 1.2 * f.glow;
        light?.update(f, t, renderer.getPixelRatio() * h / (2 * Math.tan((camera.fov * Math.PI) / 360)));
        if (dimRef.current) dimRef.current.style.opacity = String(0.85 * f.dim);
        if (whiteRef.current) whiteRef.current.style.opacity = String(f.white);
        while (cues.length && cues[0]!.t <= t) audio?.play(cues.shift()!.cue);
        if (f.phase !== shown) {
          shown = f.phase;
          canvas.dataset.hatchPhase = f.phase;
          setPhase(f.phase);
          const line = latest.current.announcements?.[f.phase];
          if (line) setSaid(line);
        }
        if (t >= hatchDuration(reduced)) finish();
      }
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cues = [];
      cancelAnimationFrame(frame);
      timer.dispose();
      audio?.dispose();
      light?.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mat) => {
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
          mat.dispose();
        });
      });
      renderer.forceContextLoss();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [eggUrl, monUrl]);

  return (
    <div
      ref={host}
      role="img"
      aria-label={label}
      aria-busy={phase === 'loading'}
      data-testid="hatch-sequence"
      style={{ width, height, position: 'relative' }}
    >
      {/* The stage dims behind the egg, as the hatch begins. */}
      <div
        ref={dimRef}
        aria-hidden
        style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none', background: `radial-gradient(closest-side, rgba(${NIGHT}, 0.95), rgba(${NIGHT}, 0.6) 70%, rgba(${NIGHT}, 0))` }}
      />
      {/* The one white-out, over everything. */}
      <div
        ref={whiteRef}
        aria-hidden
        data-testid="hatch-white"
        style={{ position: 'absolute', inset: 0, zIndex: 1, opacity: 0, pointerEvents: 'none', background: 'radial-gradient(closest-side, #FFFFFF, #FFFDF7 60%, rgba(255, 237, 219, 0.92))' }}
      />
      <p role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', margin: 0 }}>
        {said}
      </p>
    </div>
  );
}
