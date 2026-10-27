import { hlynk, hud, led, palette, signage } from '@acme/theme';
import {
  atan, float, hash, instanceIndex, materialOpacity, mix, smoothstep, texture, uniform, uv, vec2, vec3, vec4,
} from 'three/tsl';
import type { StoreApi } from 'zustand/vanilla';
import type { ThreeContext, ThreeFrame, ThreeScene } from '../types';
import type { EggHatchRig } from '../hatch/egg-hatch-rig';
// Extensionless on purpose: Metro picks canvas2d.native.ts on device, web and tsc take canvas2d.ts.
import { canvasFont, createCanvasSurface, whenFontsReady } from './canvas2d';
import {
  BODY, EMITTERS, FAN, INTRO, MAX_TILT, REST_YAW, SCREEN_GLASS, STAGE, screenPxToLocal,
} from './device-geometry';
import type { DeviceScreen, ScreenModel } from './screen';
import { keyFromTarget, keyTarget, SIDE_KEY, type DeviceKey, type StageState } from './stage-state';
import { beamGradientTexture, glareTexture, grainTexture, iconTexture, radialGlowTexture, textTexture } from './textures';

export { BODY, EMITTERS, FAN, HEAD_DEPTH, INTRO, MAX_TILT, REST_YAW, STAGE, fanCorners } from './device-geometry';

/** What the stage hands the scene. Read in `update`; the screen and the store are read once, at build. */
export interface DeviceSceneParams {
  /** `placeholder` is the procedural model below; `h-lynk-entry` swaps in the real GLB when it lands. */
  model: 'placeholder' | 'h-lynk-entry';
  /**
   * What the glass shows and what a tap there selects: the website's HUD
   * (hud-screen.ts) or the app's egg choice (choice-screen.ts). Its models,
   * if any, stand in front of the glass.
   */
  screen: DeviceScreen;
  /** The stage's store: hover target and press counters, shared with the stage's DOM / view handlers. */
  store: StoreApi<StageState>;
  /** A press on the 3D left side key. The stage plays the chirp (when sound is on) and counts the press. */
  onSideKey?: () => void;
  /** A press on a front key or the trackpad. The stage counts it (the scene dips that key) and calls its `onKey`. */
  onKey?: (key: DeviceKey) => void;
  /** Called once, after the first frame with the H-Lynk in it has been drawn. The stage drops its capture then. */
  onReady?: () => void;
  /**
   * Called with `true` when the H-Lynk is at rest (intro over, pointer away,
   * tilt settled, no model idling) and with `false` when it needs frames
   * again. The stage pauses the loop while it rests, so a still object costs
   * no frames.
   */
  onRest?: (resting: boolean) => void;
}

type Three = ThreeContext['THREE'];
type Group = InstanceType<Three['Group']>;
type Material = InstanceType<Three['Material']>;
type Geometry = NonNullable<ConstructorParameters<Three['Mesh']>[0]>;
type Mesh = InstanceType<Three['Mesh']>;
type Texture = InstanceType<Three['Texture']>;

/** Fan and emitter levels at rest and at the scanner's one flare. */
const FAN_REST = 0.3;
const EMITTER_REST = 1.4;
const EMITTER_PEAK = 3.2;
/**
 * The live beam after the intro. `period` is one slow breath of the fan and
 * emitters (s), `fan`/`emitter` its depth as a share of their rest level, and
 * `flicker` the emitters' faint fast waver on top. `bands` is how many
 * ripples fit along the fan, `speed` how many leave the mouth per second,
 * `depth` how far a ripple swings the fan's opacity either side of its level.
 */
const BEAM = { period: 3.2, fan: 0.28, emitter: 0.18, flicker: 0.06, bands: 2.6, speed: 0.55, depth: 0.42 } as const;
/**
 * Glitter rising through the fan: instanced sprites placed on the GPU from
 * their index, so the CPU uploads nothing per frame. Sizes in body widths,
 * `rise` in fan lengths per second, `twinkle` in radians per second.
 */
const MOTES = { count: 180, size: [0.007, 0.018], rise: [0.12, 0.3], twinkle: [2.5, 7], sway: 0.012, opacity: 0.9 } as const;
/** Screen emissive once powered: bright enough to read, not a billboard. */
const SCREEN_ON = 0.62;
/** How long the side key stays down per press, seconds. */
const SIDE_KEY_DIP_S = 0.16;
/** A model on the screen: its scale when focused, when another is focused, and its turn speed (rad/s) while focused. */
const MODEL_FOCUS = { on: 1.08, off: 0.9, turn: 0.7, rate: 8 } as const;
/** How far a front key or the trackpad dips into the shell per press, and for how long (s). */
const KEY_DIP = { depth: 0.012, seconds: 0.16 } as const;
/** The longest `onReady` waits for the screen's models before announcing anyway, ms. */
const MODEL_WAIT_MS = 8000;
/**
 * The selected model's glow: a soft halo plus rings and rays radiating from
 * its centre, behind it on the glass. `size` is the glow plane's side as a
 * share of the slot's larger side; `rings` per glow radius and `speed` rings
 * leaving the centre per second; `rays` around the circle turning at `spin`
 * rad/s; `breath` the halo's swell, period in s. `warm` is the level a held
 * trackpad (and the screen's own warmth) adds, and `idle` the clip speed it adds.
 */
const GLOW = { size: 1.25, rings: 3.2, speed: 0.45, rays: 9, spin: 0.25, breath: 2.6, warm: 0.9, idle: 1.5, rate: 5 } as const;
/** Glow tints by slot when a model names none: hud tokens. */
export const SCREEN_GLOW_TINTS = [hud.amber, hud.cyan, hud.green] as const;

const CORE = hlynk.core;
const { apple, concrete, ink, silver } = palette;

/** 0..1 progress of `t` through [from, to]. */
const span = (t: number, from: number, to: number) => Math.min(1, Math.max(0, (t - from) / (to - from)));
const easeOut = (u: number) => 1 - (1 - u) ** 3;

/**
 * The H-Lynk Core procedural model (canon Decision #16): a matte red
 * rounded body, a black scanner head across the top with a lens, red
 * emitters and a red fan of light above it, a stub antenna top-left, a
 * tall screen in a dark bezel, and the bottom control row either side of a
 * red-ringed square trackpad, plus side keys and the left action key.
 * Nothing is printed on the front: the sheet's EngineX mark is open (Q40)
 * and the tier name is printed on the backplate. Units are body widths.
 *
 * Mount cost (PS-017): `createDeviceScene` builds geometry and textures and
 * returns. The studio environment and the shader pipelines follow in a
 * separate task through `renderer.compileAsync`, which yields between
 * objects. The H-Lynk stays hidden until that resolves, so no frame stalls on
 * a pipeline compile, and `onReady` fires after the first full frame.
 *
 * The real GLB replaces the group built by `buildDevice`; framing,
 * lighting and motion stay.
 */
export function createDeviceScene(
  { THREE, renderer, invalidate }: ThreeContext,
  initial: DeviceSceneParams,
): ThreeScene<DeviceSceneParams> {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Filmic curve off: the body has to stay the measured hlynk.core.body red, not drift to orange.
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(STAGE.camera.fov, 1, 0.1, 50);
  camera.position.set(0, STAGE.camera.y, STAGE.camera.z);
  camera.lookAt(0, STAGE.camera.lookY, 0);

  // White key from the upper left, a neutral rim from behind right, soft
  // fill. Red is the only coloured light, and it comes from the scanner.
  scene.add(new THREE.HemisphereLight(signage.white, concrete[900], 0.45));
  const key = new THREE.DirectionalLight(signage.white, 1.6);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(silver[300], 0.9);
  rim.position.set(4, 2, -4);
  scene.add(rim);

  const { store, screen } = initial;
  const glass = screenTexture(THREE, screen, store);
  const device = buildDevice(THREE, glass.texture);
  const BASE_Y = STAGE.baseY;
  device.group.position.y = BASE_Y;
  device.group.scale.setScalar(STAGE.scale);
  device.group.rotation.y = REST_YAW;
  scene.add(device.group);

  // The glass follows the screen's state and the stage's hover target: a
  // change repaints the canvas once and asks for one frame. Nothing repaints
  // per frame. A side key press (from a control or the 3D key) dips the key.
  let dipFrom = -1; // scene time the current dip started; -1 none
  let dipQueued = false;
  let tapQueued = false;
  // A front key or the trackpad dips the same way, one key at a time.
  let keyDipFrom = -1;
  let keyDipQueued: DeviceKey | null = null;
  let keyDipping: DeviceKey | null = null;
  const unsubscribeStage = store.subscribe((next, prev) => {
    if (next.hover !== prev.hover) glass.paint();
    if (next.presses !== prev.presses) dipQueued = true;
    if (next.taps !== prev.taps) tapQueued = true;
    if (next.keyPresses !== prev.keyPresses) keyDipQueued = next.lastKey;
    invalidate();
  });
  const unsubscribeScreen = screen.subscribe(() => {
    glass.paint();
    invalidate();
  });
  whenFontsReady(() => {
    glass.paint();
    invalidate();
  });

  // Models standing on the glass (the egg choice's eggs). Each loads on its
  // own; a slot whose model fails keeps its label and nothing else.
  const models = screen.models ?? [];
  const stand = standModels(THREE, device.group, models, screen.size);
  const modelHits = stand.hits;

  // Raycasts run only when the pointer moved or went down, never on a frame
  // where the input is unchanged (PS-019's per-frame raycast).
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const targets = [...modelHits, device.screen, device.sideKeyHit, ...device.keyHits];
  let lastPointer = { x: Number.NaN, y: Number.NaN, inside: false };
  const pick = (): string | null => {
    device.group.updateMatrixWorld(true);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(targets, false)[0];
    if (!hit) return null;
    if (hit.object === device.sideKeyHit) return SIDE_KEY;
    const key = (hit.object.userData as { key?: DeviceKey }).key;
    if (key !== undefined) return keyTarget(key);
    const target = (hit.object.userData as { target?: string }).target;
    if (target !== undefined) return target;
    return hit.uv ? screen.hitTest(hit.uv.x, hit.uv.y) : null;
  };

  let disposed = false;
  let ready = false;
  let introStart = -1;
  let announced = false;
  let resting = false;
  let tiltX = 0;
  let tiltY = 0;
  let model = initial.model;

  // The heavy half of the mount, in its own task: bake the studio
  // environment, then queue every pipeline with compileAsync. The device is
  // visible while compileAsync collects its render list (that part runs
  // synchronously), then hidden until the pipelines exist.
  const warm = setTimeout(() => {
    if (disposed) return;
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      // Per material, not scene.environment: node materials scale only their
      // own envMap by envMapIntensity, and the black trim must reflect less
      // than the screen glass.
      device.setEnvironment(pmrem.fromScene(studioEnvironment(THREE), 0.04).texture);
      pmrem.dispose();
    } catch {
      // No studio reflections; the directional rig still stands alone.
    }
    // compileAsync collects only visible objects, synchronously, before its first await.
    device.group.visible = true;
    const compiling = renderer.compileAsync(scene, camera);
    device.group.visible = false;
    compiling
      .catch(() => undefined) // a failed precompile only means the first frame compiles inline
      .then(() => {
        if (disposed) return;
        ready = true;
        device.group.visible = true;
        invalidate();
      });
  }, 0);
  device.group.visible = false;

  // Each model compiles off the frame path too, then shows. `onReady` waits
  // for every model to settle (shown, missing or failed), or MODEL_WAIT_MS,
  // so the stage's loader covers the eggs popping in.
  let unsettled = models.length;
  const settleModel = () => {
    unsettled = Math.max(0, unsettled - 1);
    invalidate();
  };
  const modelWait = setTimeout(() => {
    unsettled = 0;
    invalidate();
  }, MODEL_WAIT_MS);
  stand.load({
    onLoaded: (root) => {
      if (disposed) return;
      root.visible = true;
      const compiling = renderer.compileAsync(root, camera, scene);
      root.visible = false;
      void compiling.catch(() => undefined).then(() => {
        if (disposed) return;
        root.visible = true;
        settleModel();
      });
    },
    onSettled: settleModel,
    isDisposed: () => disposed,
  });

  return {
    scene,
    camera,
    resize: (width, height) => {
      camera.aspect = width / Math.max(height, 1);
      // Keep the whole unit in frame on tall, narrow stages.
      camera.position.z = camera.aspect < 0.75 ? 5.4 / Math.max(camera.aspect / 0.75, 0.6) : 5.4;
      camera.updateProjectionMatrix();
    },
    update: (frame: ThreeFrame, params: DeviceSceneParams) => {
      if (params.model !== model) model = params.model; // 'h-lynk-entry' loads here once the model exists.
      if (!ready) return;
      if (introStart < 0) introStart = frame.time;
      // Under reduced motion the stage shows the capture, but a still canvas
      // still lands on the rest pose.
      const t = frame.reducedMotion ? INTRO.end : frame.time - introStart;

      const settle = easeOut(span(t, INTRO.settle.from, INTRO.settle.to));
      const turn = easeOut(span(t, INTRO.yaw.from, INTRO.yaw.to));
      const flare = Math.sin(Math.PI * span(t, INTRO.scanner.from, INTRO.scanner.to));
      const power = easeOut(span(t, INTRO.screen.from, INTRO.screen.to));

      const tracking = frame.pointer.inside && !frame.reducedMotion;
      const goalX = tracking ? -frame.pointer.y * MAX_TILT : 0;
      const goalY = tracking ? frame.pointer.x * MAX_TILT : 0;
      // Frame-rate independent ease toward the goals; a one-off redraw snaps.
      const k = frame.delta > 0 ? 1 - Math.exp(-frame.delta * 6) : 1;
      tiltX += (goalX - tiltX) * k;
      tiltY += (goalY - tiltY) * k;

      device.group.position.y = BASE_Y - INTRO.settle.drop * (1 - settle);
      device.group.rotation.set(tiltX, REST_YAW + INTRO.yaw.turn * (1 - turn) + tiltY, 0);
      // After the flare the beam stays alive: fan and emitters breathe together,
      // the emitters waver faintly, ripples climb the fan and glitter rises
      // through it. Reduced motion holds the plain rest beam.
      const live = !frame.reducedMotion;
      const wake = live ? span(t, INTRO.scanner.to, INTRO.end) : 0;
      const breath = wake * Math.sin((2 * Math.PI * t) / BEAM.period);
      const flicker = wake * Math.sin(t * 23.1) * Math.sin(t * 37.7);
      device.light(
        (FAN_REST + (1 - FAN_REST) * flare) * (1 + BEAM.fan * breath),
        (EMITTER_REST + (EMITTER_PEAK - EMITTER_REST) * flare) * (1 + BEAM.emitter * breath + BEAM.flicker * flicker),
      );
      device.beam(t, live);
      device.power(SCREEN_ON * power);
      // Holding the trackpad warms the selected model's glow (M10), on top of the screen's own warmth.
      const stageNow = store.getState();
      const holdingPad = stageNow.held && stageNow.hover === keyTarget('activate');
      const warmth = Math.min(1, (screen.warmth?.() ?? 0) + (holdingPad ? 1 : 0));
      const modelsMoving = stand.update(frame, screen.selected?.() ?? null, power, warmth);

      // Input: hover on a move, act on a press. The stage counts presses in
      // the store from its pointerdown handler (so a tap shorter than a
      // frame still lands); the pointer already holds the press position.
      const p = frame.pointer;
      const moved = p.x !== lastPointer.x || p.y !== lastPointer.y || p.inside !== lastPointer.inside;
      const pressed = tapQueued;
      tapQueued = false;
      lastPointer = { x: p.x, y: p.y, inside: p.inside };
      if (moved || pressed) {
        let hover: string | null = null;
        if ((p.inside || pressed) && t >= INTRO.screen.from) {
          ndc.set(p.x, p.y);
          hover = pick();
        }
        if (hover !== store.getState().hover) store.setState({ hover });
        const pressedKey = keyFromTarget(hover);
        if (pressed && hover === SIDE_KEY) params.onSideKey?.();
        else if (pressed && pressedKey !== null) params.onKey?.(pressedKey);
        else if (pressed && hover !== null) screen.select(hover);
      }

      // The side key dips 0.014 into the shell for 160 ms per press.
      if (dipQueued) {
        dipQueued = false;
        dipFrom = frame.time;
      }
      const dipping = dipFrom >= 0 && frame.time - dipFrom < SIDE_KEY_DIP_S;
      if (!dipping) dipFrom = -1;
      device.dipSideKey(dipping);
      if (keyDipQueued !== null) {
        keyDipping = keyDipQueued;
        keyDipQueued = null;
        keyDipFrom = frame.time;
      }
      const keyDown = keyDipFrom >= 0 && frame.time - keyDipFrom < KEY_DIP.seconds;
      if (!keyDown) keyDipFrom = -1;
      // The trackpad stays down while it is held.
      device.dipKey(keyDown ? keyDipping : holdingPad ? 'activate' : null);

      if (!announced && unsettled === 0) {
        announced = true;
        // After this frame's render, which runs right after update returns.
        setTimeout(() => {
          if (!disposed) params.onReady?.();
        }, 0);
      }
      const settled = Math.abs(tiltX - goalX) < 1e-3 && Math.abs(tiltY - goalY) < 1e-3;
      // A queued dip needs the loop for one more beat; idling models keep it running.
      // A live beam keeps the loop running while the stage is on screen (the
      // stage still pauses it offscreen); under reduced motion it rests as before.
      const rest = t >= INTRO.end && !tracking && settled && !dipping && !keyDown && !modelsMoving && !live;
      if (rest !== resting) {
        resting = rest;
        params.onRest?.(rest);
      }
    },
    dispose: () => {
      disposed = true;
      unsubscribeStage();
      unsubscribeScreen();
      clearTimeout(warm);
      clearTimeout(modelWait);
      stand.dispose();
      device.group.userData.dispose();
    },
  };
}

/**
 * The glass's texture: the screen drawn into a CanvasSurface (a browser
 * canvas on web, Skia on native). `paint` redraws it with the stage's
 * current hover target and flags one upload. It runs only when the screen's
 * state or the hover target changes, and once more when web fonts load.
 */
function screenTexture(
  THREE: Three,
  screen: DeviceScreen,
  store: StoreApi<StageState>,
): { texture: Texture; paint: () => void } {
  const surface = createCanvasSurface(THREE, screen.size.width, screen.size.height);
  const paint = () => {
    screen.draw(surface.ctx, canvasFont, store.getState().hover);
    surface.commit();
  };
  paint();
  return { texture: surface.texture, paint };
}

/**
 * Stands each screen model in its slot, in front of the glass, scaled to the
 * slot's height, with an invisible box over the slot as its tap target. The
 * focused model comes forward and turns slowly; the others step back. Every
 * model idles on its own clip; under reduced motion each holds still.
 */
function standModels(THREE: Three, parent: Group, models: readonly ScreenModel[], screenSize: DeviceScreen['size']) {
  interface Holder {
    target: string;
    holder: Group;
    rig: EggHatchRig | null;
    scale: number;
    spin: number;
    /** 0 hidden .. 1 selected .. 1 + GLOW.warm warmed */
    glowLevel: number;
    glow: { group: Group; halo: Material & { opacity: number }; rings: Material & { opacity: number } } | null;
  }
  const holders: Holder[] = [];
  const hits: Mesh[] = [];
  // Buckets, as buildDevice's: everything here is freed in dispose.
  const geometries: Geometry[] = [];
  const materials: Material[] = [];
  const textures: { dispose(): void }[] = [];
  const track = <G extends Geometry>(g: G) => (geometries.push(g), g);
  const mat = <M extends Material>(m: M) => (materials.push(m), m);
  const tex = <T extends { dispose(): void }>(t: T) => (textures.push(t), t);
  const hitMaterial = mat(new THREE.MeshBasicMaterial());
  let disposed = false;

  for (const m of models) {
    const holder = new THREE.Group();
    holder.name = `ScreenModel_${m.target}`;
    parent.add(holder);
    holders.push({ target: m.target, holder, rig: null, scale: 1, spin: 0, glowLevel: 0, glow: null });
  }

  // The glow behind a selected model. One time uniform and one soft dot for
  // all of them; each model has its own halo and ring materials (own tint and
  // level). Additive, no depth writes, so the model in front still occludes.
  const glowTime = uniform(0);
  const glowMotion = uniform(0); // 0 under reduced motion: a still halo, no rings
  const glowDot = tex(radialGlowTexture(THREE));
  const glowPlane = track(new THREE.PlaneGeometry(1, 1));
  const centred = uv().sub(0.5).mul(2);
  const radius = centred.length();
  // Rings: a sawtooth in radius moving outward, shaped into thin bands.
  const wave = radius.mul(GLOW.rings).sub(glowTime.mul(GLOW.speed)).fract();
  const band = smoothstep(float(0), float(0.12), wave).mul(float(1).sub(smoothstep(float(0.12), float(0.55), wave)));
  // Rays: soft spokes turning slowly.
  const rays = atan(centred.y, centred.x).mul(GLOW.rays).add(glowTime.mul(GLOW.spin)).sin().mul(0.5).add(0.5).pow(4);
  // Clear of the model's middle, gone before the plane's edge.
  const reach = smoothstep(float(0.18), float(0.32), radius).mul(float(1).sub(smoothstep(float(0.55), float(1), radius)));
  const radiate = band.mul(0.85).add(rays.mul(0.35)).mul(reach).mul(glowMotion);

  const addGlow = (entry: Holder, tint: string, slot: { x: number; baseY: number; height: number; width: number }) => {
    const group = new THREE.Group();
    group.name = `ScreenModelGlow_${entry.target}`;
    const side = Math.max(slot.width, slot.height) * GLOW.size;
    group.scale.set(side, side, 1);
    // On the glass, behind the model (which stands proud of it), centred on the model.
    group.position.set(slot.x, slot.baseY + slot.height / 2, SCREEN_GLASS.z + 0.004);
    const halo = mat(new THREE.MeshBasicMaterial({
      map: glowDot, color: tint, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    const rings = mat(new THREE.MeshBasicNodeMaterial({
      color: tint, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    rings.opacityNode = materialOpacity.mul(radiate);
    const haloMesh = new THREE.Mesh(glowPlane, halo);
    haloMesh.scale.setScalar(0.85);
    group.add(haloMesh);
    const ringMesh = new THREE.Mesh(glowPlane, rings);
    ringMesh.position.z = 0.001;
    group.add(ringMesh);
    group.visible = false;
    parent.add(group);
    entry.glow = { group, halo, rings };
  };

  /** A slot's rect (screen canvas px) as glass-local placement: centre x, base y, height and width in body widths. */
  const layout = (m: ScreenModel, size: DeviceScreen['size']) => {
    const base = screenPxToLocal(m.rect.x + m.rect.width / 2, m.rect.y + m.rect.height, size);
    const top = screenPxToLocal(m.rect.x, m.rect.y, size);
    return { x: base.x, baseY: base.y, height: top.y - base.y, width: (m.rect.width / size.width) * SCREEN_GLASS.width };
  };

  return {
    hits,
    /** `onLoaded` gets each model that loaded; `onSettled` fires once for each one that is missing or failed. */
    load: ({ onLoaded, onSettled, isDisposed }: {
      onLoaded: (root: Group) => void;
      onSettled: () => void;
      isDisposed: () => boolean;
    }) => {
      models.forEach((m, i) => {
        const slot = layout(m, screenSize);
        const entry = holders[i]!;
        // The tap target: the whole slot above the label, a little proud of the glass.
        const hitGeo = new THREE.BoxGeometry(slot.width, slot.height, 0.24);
        geometries.push(hitGeo);
        const hit = new THREE.Mesh(hitGeo, hitMaterial);
        hit.position.set(slot.x, slot.baseY + slot.height / 2, SCREEN_GLASS.z + 0.12);
        hit.visible = false;
        hit.userData.target = m.target;
        parent.add(hit);
        hits.push(hit);

        addGlow(entry, m.glow ?? SCREEN_GLOW_TINTS[i % SCREEN_GLOW_TINTS.length]!, slot);

        const source = m.source;
        if (source === null) {
          onSettled();
          return;
        }
        void import('../hatch/egg-hatch-rig')
          .then(({ EggHatchRig }) => EggHatchRig.create(source.eggId, { manifest: source.manifest, glb: source.glb }))
          .then((rig) => {
            if (disposed || isDisposed()) {
              rig.dispose();
              return;
            }
            rig.setProxyBabyVisible(false);
            rig.idle();
            rig.update(0);
            const root = rig.root;
            root.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(root);
            const size = box.getSize(new THREE.Vector3());
            const fit = Math.min((slot.height * 0.78) / Math.max(size.y, 1e-6), (slot.width * 0.72) / Math.max(size.x, 1e-6));
            // The holder's origin is the egg's centre, so focus and power-up scale it in place;
            // it sits in the middle of its slot, its back against the glass.
            const inner = new THREE.Group();
            inner.scale.setScalar(fit);
            root.position.set(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2);
            inner.add(root);
            entry.holder.add(inner);
            entry.holder.position.set(slot.x, slot.baseY + slot.height / 2, SCREEN_GLASS.z + (size.z * fit) / 2 + 0.01);
            entry.rig = rig;
            onLoaded(entry.holder);
          })
          .catch((error: unknown) => {
            console.warn(`[hlynk] the ${source.eggId} model did not load; its slot keeps the label.`, error);
            onSettled();
          });
      });
    },
    /** Poses every model for this frame. `warmth` 0..1 warms the selected model. Returns true while any of them moves. */
    update: (frame: ThreeFrame, selected: string | null, power: number, warmth: number): boolean => {
      let moving = false;
      const k = frame.delta > 0 ? 1 - Math.exp(-frame.delta * MODEL_FOCUS.rate) : 1;
      const kGlow = frame.delta > 0 ? 1 - Math.exp(-frame.delta * GLOW.rate) : 1;
      glowTime.value = frame.reducedMotion ? 0 : glowTime.value + frame.delta * (1 + warmth);
      glowMotion.value = frame.reducedMotion ? 0 : 1;
      for (const entry of holders) {
        const rig = entry.rig;
        if (!rig) continue;
        // The glow follows the selection and comes up with the screen; warmth swells it.
        const glowGoal = selected === entry.target ? (1 + GLOW.warm * warmth) * power : 0;
        entry.glowLevel += (glowGoal - entry.glowLevel) * kGlow;
        if (Math.abs(glowGoal - entry.glowLevel) > 1e-3) moving = true;
        const glow = entry.glow;
        if (glow) {
          const level = entry.glowLevel;
          glow.group.visible = level > 1e-3;
          const swell = frame.reducedMotion ? 1 : 1 + 0.06 * Math.sin((2 * Math.PI * glowTime.value) / GLOW.breath);
          glow.group.children[0]?.scale.setScalar(0.85 * swell * (1 + 0.12 * warmth));
          glow.halo.opacity = Math.min(1, 0.55 * level);
          glow.rings.opacity = Math.min(1, 0.6 * level);
        }
        const goal = selected === null ? 1 : selected === entry.target ? MODEL_FOCUS.on : MODEL_FOCUS.off;
        entry.scale += (goal - entry.scale) * k;
        if (selected === entry.target && !frame.reducedMotion) entry.spin += frame.delta * MODEL_FOCUS.turn;
        else entry.spin += (0 - entry.spin) * k;
        // The models come up with the screen.
        entry.holder.scale.setScalar(entry.scale * (0.6 + 0.4 * power));
        entry.holder.rotation.y = entry.spin;
        if (frame.reducedMotion) rig.seek('stir', 0);
        else {
          rig.idle();
          // A warmed egg idles livelier.
          rig.update(frame.delta * (selected === entry.target ? 1 + GLOW.idle * warmth : 1));
          moving = true;
        }
        if (Math.abs(goal - entry.scale) > 1e-3) moving = true;
      }
      return moving;
    },
    dispose: () => {
      disposed = true;
      for (const entry of holders) {
        entry.rig?.dispose();
        entry.holder.removeFromParent();
      }
      for (const hit of hits) hit.removeFromParent();
      for (const entry of holders) entry.glow?.group.removeFromParent();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

/** One tracked material/geometry bucket so `dispose` frees everything. */
function buildDevice(
  THREE: Three,
  /** the drawn screen; the device owns and disposes it */
  screenMap: Texture,
): {
  group: Group;
  /** the screen glass, raycast for the screen target under the pointer */
  screen: Mesh;
  /** an invisible box over the left side key and the shell strip beside it: the key's hit area */
  sideKeyHit: Mesh;
  /** press the left side key into the shell, or let it back out */
  dipSideKey: (down: boolean) => void;
  /** invisible boxes over the four front keys and the trackpad; `userData.key` names each */
  keyHits: Mesh[];
  /** press one front key (or the trackpad) into the shell; null lets every key back out */
  dipKey: (key: DeviceKey | null) => void;
  /** fan opacity scale 0..1 and emitter emissive intensity */
  light: (fan: number, emitter: number) => void;
  /** the fan's ripples and glitter at scene time `time`; `live` false holds the beam still with no glitter */
  beam: (time: number, live: boolean) => void;
  /** screen emissive intensity */
  power: (level: number) => void;
  /** hand every lit material the baked studio; the group owns and disposes it */
  setEnvironment: (env: InstanceType<Three['Texture']>) => void;
} {
  const geometries: Geometry[] = [];
  const materials: Material[] = [];
  const textures: { dispose(): void }[] = [];
  const track = <G extends Geometry>(g: G) => (geometries.push(g), g);
  const mat = <M extends Material>(m: M) => (materials.push(m), m);
  const tex = <T extends { dispose(): void }>(t: T) => (textures.push(t), t);

  const group = new THREE.Group();
  group.userData.dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };

  const { W, H, D } = BODY;
  const top = H / 2;
  const front = D / 2;

  // --- materials -----------------------------------------------------------

  /** Fine plastic grain: the shell isn't a render-flat surface up close. */
  const grain = tex(grainTexture(THREE));

  /** Matte red shell (PS-002): the hlynk.core.body token, a light clearcoat for moulded sheen. */
  const body = mat(new THREE.MeshPhysicalMaterial({
    color: CORE.body, roughness: 0.62, metalness: 0.02, envMapIntensity: 0.35,
    clearcoat: 0.2, clearcoatRoughness: 0.5,
    bumpMap: grain, bumpScale: 0.0015,
  }));
  /** Shell seam: the fine groove where the two shell halves meet. */
  const groove = mat(new THREE.MeshStandardMaterial({
    color: apple[900], roughness: 0.7, metalness: 0.1, envMapIntensity: 0.15,
  }));
  /** Black rubberised trim: head, bezel, keys — softer reflections. */
  const black = mat(new THREE.MeshStandardMaterial({
    color: CORE.black, roughness: 0.6, metalness: 0.05, envMapIntensity: 0.12,
    bumpMap: grain, bumpScale: 0.001,
  }));
  /** Glossy black plastic: lens barrel, trackpad face. */
  const pianoBlack = mat(new THREE.MeshStandardMaterial({
    color: CORE.black, roughness: 0.2, metalness: 0.2, envMapIntensity: 0.45,
  }));
  /** Lens glass. */
  const lensGlass = mat(new THREE.MeshStandardMaterial({
    color: ink[900], roughness: 0.05, metalness: 0.55, envMapIntensity: 1.4,
  }));
  /** Screen glass; the drawn screen doubles as its own emitter so it reads in the dark. */
  const screenTexture = tex(screenMap);
  const screen = mat(new THREE.MeshStandardMaterial({
    map: screenTexture,
    emissiveMap: screenTexture,
    emissive: signage.white,
    emissiveIntensity: 0,
    roughness: 0.18,
    metalness: 0.3,
    envMapIntensity: 1.1,
  }));
  const emitter = mat(new THREE.MeshStandardMaterial({
    color: led.on, emissive: led.on, emissiveIntensity: EMITTER_REST, roughness: 0.25,
  }));
  const ring = mat(new THREE.MeshStandardMaterial({
    color: CORE.ring, emissive: CORE.ring, emissiveIntensity: 0.5, roughness: 0.4,
  }));
  const glowTexture = tex(radialGlowTexture(THREE));
  /** Additive glow at the fan's mouth. */
  const glow = mat(new THREE.SpriteMaterial({
    map: glowTexture, color: led.on, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.85,
  }));

  // --- helpers -------------------------------------------------------------

  /** Rounded slab: a rounded-rect face extruded with a small bevel. */
  const rounded = (w: number, h: number, d: number, r: number) => {
    const shape = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
    shape.lineTo(x + w, y + h - r);
    shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    shape.lineTo(x + r, y + h);
    shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    shape.lineTo(x, y + r);
    shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
    const bevel = Math.min(0.012, d / 4);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: d - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 8,
    });
    geo.translate(0, 0, -(d - bevel * 2) / 2);
    return track(geo);
  };

  const box = (geo: Geometry, m: Material, x: number, y: number, z: number): Mesh => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  /** A printed glyph on a transparent decal plane. */
  const decal = (text: string, w: number, color: string) => {
    const m = mat(new THREE.MeshBasicMaterial({ map: tex(textTexture(THREE, text, color)), transparent: true, depthWrite: false }));
    // textTexture draws into a 512×128 canvas.
    return new THREE.Mesh(track(new THREE.PlaneGeometry(w, w * 0.25)), m);
  };

  // --- body ----------------------------------------------------------------

  box(rounded(W, H, D, 0.06), body, 0, 0, 0);
  // Chin under the control row: the slight lower bumper of the sheet.
  box(rounded(W * 0.98, 0.1, D + 0.015, 0.04), body, 0, -top + 0.07, 0);
  // Shell seams just under the head and above the chin.
  box(rounded(W * 1.004, 0.01, D + 0.006, 0.004), groove, 0, 0.62, 0);
  box(rounded(W * 1.002, 0.008, D + 0.006, 0.003), groove, 0, -top + 0.16, 0);
  // Speaker grille on the chin: a 9×2 field of pinholes sharing one geometry.
  const pinhole = track(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 10));
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 2; j++) {
      box(pinhole, groove, -0.14 + i * 0.035, -top + 0.05 + j * 0.035, front + 0.012).rotation.x = Math.PI / 2;
    }
  }

  // --- scanner head --------------------------------------------------------

  const headH = 0.17;
  const headY = top - headH / 2 - 0.02;
  box(rounded(0.92, headH, D + 0.06, 0.05), black, 0.03, headY, 0);
  // Head crown: a second, shallower step so the head reads moulded.
  box(rounded(0.7, 0.06, D + 0.045, 0.02), black, 0.1, headY + headH / 2 + 0.01, 0);

  // Lens on the head's left: red ring, barrel, glass, red centre.
  box(track(new THREE.CylinderGeometry(0.056, 0.056, 0.026, 32)), emitter, -0.3, headY, front + 0.04).rotation.x = Math.PI / 2;
  box(track(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 32)), pianoBlack, -0.3, headY, front + 0.042).rotation.x = Math.PI / 2;
  box(track(new THREE.CylinderGeometry(0.036, 0.036, 0.032, 32)), lensGlass, -0.3, headY, front + 0.044).rotation.x = Math.PI / 2;
  box(track(new THREE.CylinderGeometry(0.011, 0.011, 0.034, 20)), emitter, -0.3, headY, front + 0.045).rotation.x = Math.PI / 2;

  // Red emitters in the head's centre and the lit slit above them.
  const emitterDot = track(new THREE.CylinderGeometry(0.028, 0.028, 0.024, 20));
  for (const x of EMITTERS.x) box(emitterDot, emitter, x, headY, front + 0.035).rotation.x = Math.PI / 2;
  box(rounded(0.16, 0.02, 0.014, 0.008), emitter, FAN.x, headY + 0.058, front + 0.034);

  // Stub antenna, top left: barrel, rounded cap, base ring.
  box(track(new THREE.CylinderGeometry(0.038, 0.045, 0.2, 24)), black, -0.4, top + 0.1, -0.01);
  box(track(new THREE.SphereGeometry(0.041, 24, 16)), black, -0.4, top + 0.2, -0.01);
  box(track(new THREE.CylinderGeometry(0.05, 0.055, 0.03, 24)), pianoBlack, -0.4, top + 0.005, -0.01);

  // The red fan the head projects upward, from the emitters only (FAN).
  const fan = buildFan(THREE, { track, mat, tex }, glowTexture);
  fan.group.position.set(FAN.x, top, 0);
  group.add(fan.group);
  // The mouth glow: a sprite always faces the camera, so it is sized to stay
  // inside the emitters' half of the head (x 0.02..0.44) at any yaw.
  const glowSprite = new THREE.Sprite(glow);
  glowSprite.scale.set(0.42, 0.22, 1);
  glowSprite.position.set(FAN.x, top + 0.02, 0.05);
  group.add(glowSprite);

  // --- face ----------------------------------------------------------------

  // Recessed bezel, then the screen glass.
  const screenY = SCREEN_GLASS.y;
  box(rounded(0.88, 1.08, 0.03, 0.03), black, 0, screenY, front + 0.012);
  const screenMesh = box(track(new THREE.PlaneGeometry(SCREEN_GLASS.width, SCREEN_GLASS.height)), screen, 0, screenY, SCREEN_GLASS.z);

  // --- control row ----------------------------------------------------------

  const rowY = -0.64;
  // Home and menu left of the trackpad, back and forward right. Home's glyph is red.
  const keys: { x: number; icon: 'home' | 'menu' | 'back' | 'next'; red?: boolean }[] = [
    { x: -0.41, icon: 'home', red: true }, { x: -0.26, icon: 'menu' },
    { x: 0.26, icon: 'back' }, { x: 0.41, icon: 'next' },
  ];
  const keyFace = rounded(0.125, 0.14, 0.05, 0.022);
  const keyGlyph = track(new THREE.PlaneGeometry(0.06, 0.06));
  // What each key does when pressed: `<` and `>` step, home and menu as named.
  const KEY_OF = { home: 'home', menu: 'menu', back: 'prev', next: 'next' } as const;
  const keyParts = new Map<DeviceKey, Mesh[]>();
  const keyHits: Mesh[] = [];
  const keyHitMaterial = mat(new THREE.MeshBasicMaterial());
  const keyHitGeo = track(new THREE.BoxGeometry(0.15, 0.17, 0.08));
  const addKeyHit = (key: DeviceKey, geo: Geometry, x: number) => {
    const hit = new THREE.Mesh(geo, keyHitMaterial);
    hit.position.set(x, rowY, front + 0.03);
    hit.visible = false;
    hit.userData.key = key;
    group.add(hit);
    keyHits.push(hit);
  };
  for (const { x, icon, red } of keys) {
    const face = box(keyFace, pianoBlack, x, rowY, front + 0.02);
    const m = mat(new THREE.MeshBasicMaterial({
      map: tex(iconTexture(THREE, icon, red ? apple[400] : CORE.glyph)), transparent: true, depthWrite: false,
    }));
    const glyph = box(keyGlyph, m, x, rowY, front + 0.047);
    keyParts.set(KEY_OF[icon], [face, glyph]);
    addKeyHit(KEY_OF[icon], keyHitGeo, x);
  }
  // Trackpad: red ring on a gloss black pad, slightly proud of the row. The pad dips; the ring stays.
  box(rounded(0.28, 0.28, 0.034, 0.045), ring, 0, rowY, front + 0.015);
  const pad = box(rounded(0.23, 0.23, 0.05, 0.035), pianoBlack, 0, rowY, front + 0.02);
  keyParts.set('activate', [pad]);
  addKeyHit('activate', track(new THREE.BoxGeometry(0.3, 0.3, 0.08)), 0);
  const keyRestZ = new Map<Mesh, number>();
  for (const parts of keyParts.values()) for (const part of parts) keyRestZ.set(part, part.position.z);

  // --- side keys -------------------------------------------------------------

  // Right edge: volume + and −, each with a red mark, then the round power key.
  const volumeKey = rounded(0.032, 0.15, 0.1, 0.012);
  for (const [y, glyph] of [[0.36, '+'], [0.14, '-']] as const) {
    box(volumeKey, black, W / 2 + 0.014, y, 0);
    const g = decal(glyph, 0.05, apple[400]);
    g.rotation.y = Math.PI / 2;
    g.position.set(W / 2 + 0.032, y, 0);
    group.add(g);
  }
  box(track(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 24)), pianoBlack, W / 2 + 0.014, -0.05, 0).rotation.z = Math.PI / 2;
  // Left edge: the long action key. At the three-quarter rest it is a sliver
  // past the silhouette, so its hit area is a larger invisible box that also
  // covers the shell strip beside it on the face (left of the bezel). The DOM
  // "Side key chirp" button is the primary control (PS-037).
  const sideKey = box(rounded(0.032, 0.18, 0.1, 0.012), black, -W / 2 - 0.014, 0.28, 0);
  const sideKeyRestX = sideKey.position.x;
  const sideKeyHit = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.12, 0.3, D + 0.06)),
    mat(new THREE.MeshBasicMaterial()),
  );
  sideKeyHit.position.set(-W / 2 + 0.01, 0.28, 0);
  sideKeyHit.visible = false;
  group.add(sideKeyHit);

  // --- studio finishing -------------------------------------------------------

  // A pale pool of key light on the floor and a contact shadow inside it, so
  // the unit stands on something. A diagonal glare streak across the glass.
  const pool = new THREE.Sprite(mat(new THREE.SpriteMaterial({
    map: glowTexture, color: concrete[500], transparent: true, opacity: 0.22, depthWrite: false,
    blending: THREE.AdditiveBlending,
  })));
  pool.scale.set(2.4, 0.5, 1);
  pool.position.set(0, -top - 0.05, 0.05);
  group.add(pool);
  const shadow = new THREE.Sprite(mat(new THREE.SpriteMaterial({
    map: glowTexture, color: signage.black, transparent: true, opacity: 0.85, depthWrite: false,
  })));
  shadow.scale.set(1.3, 0.22, 1);
  shadow.position.set(0, -top - 0.04, 0.1);
  group.add(shadow);

  const glare = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.8, 1.0)),
    mat(new THREE.MeshBasicMaterial({
      map: tex(glareTexture(THREE)), transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.AdditiveBlending,
    })),
  );
  glare.position.set(0, screenY, front + 0.033);
  group.add(glare);

  return {
    group,
    screen: screenMesh,
    sideKeyHit,
    dipSideKey: (down) => {
      sideKey.position.x = down ? sideKeyRestX + 0.014 : sideKeyRestX;
    },
    keyHits,
    dipKey: (down) => {
      for (const [key, parts] of keyParts) {
        for (const part of parts) part.position.z = (keyRestZ.get(part) ?? part.position.z) - (key === down ? KEY_DIP.depth : 0);
      }
    },
    light: (level, intensity) => {
      fan.level(level);
      glow.opacity = 0.85 * level;
      emitter.emissiveIntensity = intensity;
    },
    beam: (time, live) => fan.animate(time, live),
    power: (level) => {
      screen.emissiveIntensity = level;
    },
    setEnvironment: (env) => {
      tex(env);
      for (const m of materials) {
        if (m instanceof THREE.MeshStandardMaterial) {
          m.envMap = env;
          m.needsUpdate = true;
        }
      }
    },
  };
}

/**
 * The scanner's fan, built to read like projected light, not a decal: three
 * nested cones (wide wash, mid beam, hot core), each drawn twice as crossed
 * planes so the fan has volume from any yaw. `level` scales all three.
 *
 * `animate` drives what makes it read as live light: bright bands climbing
 * from the mouth to the tip (a TSL opacity term over the fan's v, against a
 * scene-time uniform) and glitter motes rising through the beam's volume. Both
 * are computed on the GPU; per frame the CPU sets two uniforms.
 */
function buildFan(
  THREE: Three,
  ctx: {
    track: <G extends Geometry>(g: G) => G;
    mat: <M extends Material>(m: M) => M;
    tex: <T extends { dispose(): void }>(t: T) => T;
  },
  /** soft radial dot for the glitter; the device owns it */
  moteMap: Texture,
): { group: Group; level: (level: number) => void; animate: (time: number, live: boolean) => void } {
  const { track, mat, tex } = ctx;
  const group = new THREE.Group();
  const LENGTH = FAN.length;
  group.rotation.x = FAN.lean;
  const gradient = tex(beamGradientTexture(THREE));

  // Scene time and the ripple depth (0 holds the plain gradient: reduced motion).
  const beamTime = uniform(0);
  const rippleDepth = uniform(0);
  // v runs 0 at the mouth to 1 at the tip; bands move toward the tip as time grows.
  const band = uv().y.mul(BEAM.bands).sub(beamTime.mul(BEAM.speed)).mul(2 * Math.PI).sin().mul(0.5).add(0.5);
  // A fainter cross-beam shimmer so the bands are not ruler-straight.
  const shimmer = uv().x.mul(9).add(uv().y.mul(5)).add(beamTime.mul(1.7)).sin().mul(0.5).add(0.5);
  const ripple = mix(float(1).sub(rippleDepth), float(1).add(rippleDepth), band.mul(band))
    .mul(mix(float(1), shimmer.mul(0.4).add(0.8), rippleDepth));

  const plane = (halfBase: number, halfTop: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(-halfBase, 0);
    shape.lineTo(halfBase, 0);
    shape.lineTo(halfTop, LENGTH);
    shape.lineTo(-halfTop, LENGTH);
    shape.closePath();
    const geo = track(new THREE.ShapeGeometry(shape));
    // Normalise the UVs so the gradient spans the trapezoid edge to edge.
    const pos = geo.getAttribute('position');
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) / LENGTH;
      const half = halfBase + (halfTop - halfBase) * t;
      uv.setXY(i, (pos.getX(i) / half + 1) / 2, t);
    }
    return geo;
  };

  // Each layer is a face plane across x and a crossed plane across z. The
  // crossed plane is FAN.depth as wide, so it stays inside the head's depth;
  // at full width (the old fan) it hung a sheet of red in front of the
  // head's left side at the three-quarter turn.
  const cone = (halfBase: number, halfTop: number, color: string, peak: number) => {
    const material = mat(new THREE.MeshBasicNodeMaterial({
      color, map: gradient, transparent: true, opacity: peak,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }));
    // The gradient's alpha still multiplies in through `map`; this scales the level by the ripple.
    material.opacityNode = materialOpacity.mul(ripple).min(1);
    group.add(new THREE.Mesh(plane(halfBase, halfTop), material));
    const crossed = new THREE.Mesh(plane(halfBase * FAN.depth, halfTop * FAN.depth), material);
    crossed.rotation.y = Math.PI / 2;
    group.add(crossed);
    return { material, peak };
  };

  const colors = [led.on, led.on, apple[100]] as const;
  const layers = FAN.layers.map(([base, tip, peak], i) => cone(base, tip, colors[i] ?? led.on, peak));

  // Glitter: one instanced sprite draw. Each mote's lane, speed, size and
  // twinkle phase come from hashes of its index; its height loops up the fan
  // with time. Lanes stay inside the mid beam (face and crossed width), and
  // each mote fades in at the mouth and out before the tip.
  const id = float(instanceIndex);
  const seed = (k: number) => hash(id.add(k * 97));
  const [beamBase, beamTip] = FAN.layers[1];
  const rise = mix(float(MOTES.rise[0]), float(MOTES.rise[1]), seed(1));
  const along = seed(2).add(beamTime.mul(rise)).fract();
  const half = mix(float(beamBase), float(beamTip), along).mul(0.8);
  const laneX = seed(3).mul(2).sub(1);
  const laneZ = seed(4).mul(2).sub(1);
  const sway = beamTime.mul(mix(float(0.6), float(1.3), seed(5))).add(seed(6).mul(2 * Math.PI)).sin().mul(MOTES.sway);
  const twinkle = beamTime.mul(mix(float(MOTES.twinkle[0]), float(MOTES.twinkle[1]), seed(7)))
    .add(seed(8).mul(2 * Math.PI)).sin().mul(0.5).add(0.5);
  const sparkle = twinkle.pow(6).mul(0.85).add(0.15);
  const fade = smoothstep(float(0), float(0.12), along).mul(float(1).sub(smoothstep(float(0.6), float(1), along)));
  const moteMaterial = mat(new THREE.SpriteNodeMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: MOTES.opacity,
  }));
  // Lanes bunch toward the centre line (lane × |lane|), like a beam's hot core.
  moteMaterial.positionNode = vec3(
    laneX.mul(laneX.abs()).mul(half).add(sway),
    along.mul(LENGTH),
    laneZ.mul(laneZ.abs()).mul(half).mul(FAN.depth),
  );
  moteMaterial.scaleNode = vec2(mix(float(MOTES.size[0]), float(MOTES.size[1]), seed(9)).mul(twinkle.mul(0.5).add(0.5)));
  const dot = texture(moteMap, uv());
  const tint = mix(uniform(new THREE.Color(led.on)), uniform(new THREE.Color(apple[100])), seed(10).pow(2));
  moteMaterial.colorNode = vec4(vec3(tint).mul(dot.rgb), dot.a);
  moteMaterial.opacityNode = materialOpacity.mul(fade).mul(sparkle);
  const motes = new THREE.Sprite(moteMaterial);
  motes.count = MOTES.count;
  // One sprite at the fan's origin stands for every mote: its own bounds say nothing.
  motes.frustumCulled = false;
  group.add(motes);

  return {
    group,
    level: (level) => {
      for (const { material, peak } of layers) material.opacity = peak * level;
      // Glitter tracks the fan, but stays visible at the rest level.
      moteMaterial.opacity = MOTES.opacity * Math.min(1, level * 2.5);
    },
    animate: (time, live) => {
      beamTime.value = time;
      rippleDepth.value = live ? BEAM.depth : 0;
      motes.visible = live;
    },
  };
}

/**
 * A minimal studio for PMREM: a gradient dome (bright zenith, dark floor)
 * plus two neutral softbox cards where a product shoot would put them. The
 * environment only exists long enough to be baked to a texture.
 */
function studioEnvironment(THREE: Three): InstanceType<Three['Scene']> {
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(10, 24, 16),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }),
  );
  const floor = new THREE.Color(ink[950]);
  const zenith = new THREE.Color(signage.white);
  const pos = dome.geometry.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(floor).lerp(zenith, (pos.getY(i) / 10 + 1) / 2);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  dome.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  env.add(dome);
  // Softbox left of camera, a dimmer card behind right: the screen glare and the shell's sheen.
  const softbox = (w: number, h: number, color: string, intensity: number, px: number, py: number, pz: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }),
    );
    m.position.set(px, py, pz);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  softbox(6, 8, signage.white, 6, -6, 5, 4);
  softbox(4, 6, silver[200], 3, 6, 2, -5);
  return env;
}

