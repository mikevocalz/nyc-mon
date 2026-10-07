import { fontFamilies, hlynk, hud, led, pageMotion, palette, signage } from '@acme/theme';
import type { ThreeContext, ThreeFrame, ThreeScene } from '@acme/ui';

/** The words on the H-Lynk's screen. They come from copy.ts, never from this file. */
export interface DeviceScreenCopy {
  /** status row, top left: the tier name */
  title: string;
  /** the Mon's name, large in the middle */
  mon: string;
  /** the small line under the name */
  note: string;
}

/** What the stage hands the scene. Read in `update`; the screen copy is read once, at build. */
export interface DeviceSceneParams {
  /** `placeholder` is the procedural model below; `h-lynk-entry` swaps in the real GLB when it lands. */
  model: 'placeholder' | 'h-lynk-entry';
  screen: DeviceScreenCopy;
  /** Called once, after the first frame with the H-Lynk in it has been drawn. The stage drops its capture then. */
  onReady?: () => void;
  /**
   * Called with `true` when the H-Lynk is at rest (intro over, pointer away,
   * tilt settled) and with `false` when it needs frames again. The stage
   * pauses the loop while it rests, so a still object costs no frames.
   */
  onRest?: (resting: boolean) => void;
}

type Three = ThreeContext['THREE'];
type Group = InstanceType<Three['Group']>;
type Material = InstanceType<Three['Material']>;
type Geometry = NonNullable<ConstructorParameters<Three['Mesh']>[0]>;
type Mesh = InstanceType<Three['Mesh']>;
type CanvasTexture = InstanceType<Three['CanvasTexture']>;

/** Resting three-quarter turn so the side keys and depth read. */
const REST_YAW = -0.38;
/** Pointer tilt cap, from the page motion tokens (8 degrees). */
const MAX_TILT = (pageMotion.tilt.stage * Math.PI) / 180;

/**
 * The intro, in seconds of scene time from the first frame after the
 * pipelines compile. One pass, then the object rests (PS-018):
 * it settles into frame, turns slowly to its three-quarter rest, the scanner
 * catches the light once, and the screen comes up readable.
 */
const INTRO = {
  settle: { from: 0, to: 1.0, drop: 0.14 },
  yaw: { from: 0, to: 1.8, turn: 0.42 },
  scanner: { from: 1.0, to: 1.9 },
  screen: { from: 1.5, to: 2.4 },
  end: 2.4,
} as const;
/** Fan and emitter levels at rest and at the scanner's one flare. */
const FAN_REST = 0.3;
const EMITTER_REST = 1.4;
const EMITTER_PEAK = 3.2;
/** Screen emissive once powered: bright enough to read, not a billboard. */
const SCREEN_ON = 0.62;

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
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.12, 5.4);
  camera.lookAt(0, 0.05, 0);

  // White key from the upper left, a neutral rim from behind right, soft
  // fill. Red is the only coloured light, and it comes from the scanner.
  scene.add(new THREE.HemisphereLight(signage.white, concrete[900], 0.45));
  const key = new THREE.DirectionalLight(signage.white, 1.6);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(silver[300], 0.9);
  rim.position.set(4, 2, -4);
  scene.add(rim);

  const device = buildDevice(THREE, initial.screen, invalidate);
  const BASE_Y = -0.1;
  device.group.position.y = BASE_Y;
  device.group.scale.setScalar(1.25);
  device.group.rotation.y = REST_YAW;
  scene.add(device.group);

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
      device.light(FAN_REST + (1 - FAN_REST) * flare, EMITTER_REST + (EMITTER_PEAK - EMITTER_REST) * flare);
      device.power(SCREEN_ON * power);

      if (!announced) {
        announced = true;
        // After this frame's render, which runs right after update returns.
        setTimeout(() => {
          if (!disposed) params.onReady?.();
        }, 0);
      }
      const settled = Math.abs(tiltX - goalX) < 1e-3 && Math.abs(tiltY - goalY) < 1e-3;
      const rest = t >= INTRO.end && !tracking && settled;
      if (rest !== resting) {
        resting = rest;
        params.onRest?.(rest);
      }
    },
    dispose: () => {
      disposed = true;
      clearTimeout(warm);
      device.group.userData.dispose();
    },
  };
}

/** One tracked material/geometry bucket so `dispose` frees everything. */
function buildDevice(
  THREE: Three,
  screenCopy: DeviceScreenCopy,
  invalidate: () => void,
): {
  group: Group;
  /** fan opacity scale 0..1 and emitter emissive intensity */
  light: (fan: number, emitter: number) => void;
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

  const W = 1;
  const H = 1.78;
  const D = 0.21;
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
  const screenTexture = tex(screenFaceTexture(THREE, screenCopy, invalidate));
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
  for (const x of [0.14, 0.32]) box(emitterDot, emitter, x, headY, front + 0.035).rotation.x = Math.PI / 2;
  box(rounded(0.16, 0.02, 0.014, 0.008), emitter, 0.23, headY + 0.058, front + 0.034);

  // Stub antenna, top left: barrel, rounded cap, base ring.
  box(track(new THREE.CylinderGeometry(0.038, 0.045, 0.2, 24)), black, -0.4, top + 0.1, -0.01);
  box(track(new THREE.SphereGeometry(0.041, 24, 16)), black, -0.4, top + 0.2, -0.01);
  box(track(new THREE.CylinderGeometry(0.05, 0.055, 0.03, 24)), pianoBlack, -0.4, top + 0.005, -0.01);

  // The red fan the head projects upward: three nested cones, steady at rest.
  const fan = buildFan(THREE, { track, mat, tex });
  fan.group.position.set(0.08, top, 0);
  group.add(fan.group);
  const glowSprite = new THREE.Sprite(glow);
  glowSprite.scale.set(0.9, 0.4, 1);
  glowSprite.position.set(0.08, top + 0.02, 0.05);
  group.add(glowSprite);

  // --- face ----------------------------------------------------------------

  // Recessed bezel, then the screen glass.
  const screenY = 0.17;
  box(rounded(0.88, 1.08, 0.03, 0.03), black, 0, screenY, front + 0.012);
  box(track(new THREE.PlaneGeometry(0.8, 1.0)), screen, 0, screenY, front + 0.029);

  // --- control row ----------------------------------------------------------

  const rowY = -0.64;
  // Home and menu left of the trackpad, back and forward right. Home's glyph is red.
  const keys: { x: number; icon: 'home' | 'menu' | 'back' | 'next'; red?: boolean }[] = [
    { x: -0.41, icon: 'home', red: true }, { x: -0.26, icon: 'menu' },
    { x: 0.26, icon: 'back' }, { x: 0.41, icon: 'next' },
  ];
  const keyFace = rounded(0.125, 0.14, 0.05, 0.022);
  const keyGlyph = track(new THREE.PlaneGeometry(0.06, 0.06));
  for (const { x, icon, red } of keys) {
    box(keyFace, pianoBlack, x, rowY, front + 0.02);
    const m = mat(new THREE.MeshBasicMaterial({
      map: tex(iconTexture(THREE, icon, red ? apple[400] : CORE.glyph)), transparent: true, depthWrite: false,
    }));
    box(keyGlyph, m, x, rowY, front + 0.047);
  }
  // Trackpad: red ring on a gloss black pad, slightly proud of the row.
  box(rounded(0.28, 0.28, 0.034, 0.045), ring, 0, rowY, front + 0.015);
  box(rounded(0.23, 0.23, 0.05, 0.035), pianoBlack, 0, rowY, front + 0.02);

  // --- side keys -------------------------------------------------------------

  // Right edge: volume + and −, each with a red mark, then the round power key.
  const sideKey = rounded(0.032, 0.15, 0.1, 0.012);
  for (const [y, glyph] of [[0.36, '+'], [0.14, '-']] as const) {
    box(sideKey, black, W / 2 + 0.014, y, 0);
    const g = decal(glyph, 0.05, apple[400]);
    g.rotation.y = Math.PI / 2;
    g.position.set(W / 2 + 0.032, y, 0);
    group.add(g);
  }
  box(track(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 24)), pianoBlack, W / 2 + 0.014, -0.05, 0).rotation.z = Math.PI / 2;
  // Left edge: the long action key.
  box(rounded(0.032, 0.18, 0.1, 0.012), black, -W / 2 - 0.014, 0.28, 0);

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
    light: (level, intensity) => {
      fan.level(level);
      glow.opacity = 0.85 * level;
      emitter.emissiveIntensity = intensity;
    },
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
 */
function buildFan(
  THREE: Three,
  ctx: {
    track: <G extends Geometry>(g: G) => G;
    mat: <M extends Material>(m: M) => M;
    tex: <T extends { dispose(): void }>(t: T) => T;
  },
): { group: Group; level: (level: number) => void } {
  const { track, mat, tex } = ctx;
  const group = new THREE.Group();
  const LENGTH = 0.46;
  // Lean back a touch: it reads as projection, and the tip clears the stage's top edge.
  group.rotation.x = -0.12;
  const gradient = tex(beamGradientTexture(THREE));

  const cone = (halfBase: number, halfTop: number, color: string, peak: number) => {
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
    const material = mat(new THREE.MeshBasicMaterial({
      color, map: gradient, transparent: true, opacity: peak,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }));
    for (const yaw of [0, Math.PI / 2]) {
      const mesh = new THREE.Mesh(geo, material);
      mesh.rotation.y = yaw;
      group.add(mesh);
    }
    return { material, peak };
  };

  const layers = [cone(0.38, 0.1, led.on, 0.45), cone(0.32, 0.1, led.on, 0.75), cone(0.14, 0.045, apple[100], 0.95)];
  return {
    group,
    level: (level) => {
      for (const { material, peak } of layers) material.opacity = peak * level;
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

// ============================================================================
// Canvas textures — all the printed and lit detail lives here.
// ============================================================================

function makeCanvasTexture(THREE: Three, canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function canvas2d(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d') as CanvasRenderingContext2D];
}

/**
 * Canvas font string in the site's body face. next/font renames the family,
 * so the page's `--font-sans` wins; the token's stack is the fallback.
 */
const font = (size: number, weight = 700) => {
  const family = getComputedStyle(document.body).getPropertyValue('--font-sans').trim();
  return `${weight} ${size}px ${family ? `${family}, ` : ''}${fontFamilies.sans}`;
};

/**
 * The fan's alpha falloff: opaque white at the mouth's centre, fading upward
 * and toward the edges. RGB is white so the material colour carries the tint.
 */
function beamGradientTexture(THREE: Three): CanvasTexture {
  const [canvas, ctx] = canvas2d(64, 256);
  const img = ctx.createImageData(64, 256);
  for (let y = 0; y < 256; y++) {
    // Row 0 is the texture's top (v=1), the apex; row 255 is the mouth. The
    // last 10% fades out too, or the crossed plane's mouth edge shows as a
    // pale slab across the head.
    const t = y / 255;
    const vertical = Math.pow(t, 1.7) * Math.min(1, (1 - t) / 0.1);
    for (let x = 0; x < 64; x++) {
      // Feather to zero inside the trapezoid edge so no silhouette shows under additive blending.
      const u = x / 63;
      const m = Math.min(u, 1 - u) / 0.28;
      const edge = m >= 1 ? 1 : m * m * (3 - 2 * m);
      const i = (y * 64 + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * vertical * edge);
    }
  }
  ctx.putImageData(img, 0, 0);
  return makeCanvasTexture(THREE, canvas);
}

/** One soft diagonal light streak for the screen glass: the softbox catching the display. */
function glareTexture(THREE: Three): CanvasTexture {
  const [canvas, ctx] = canvas2d(256, 320);
  const grad = ctx.createLinearGradient(30, 300, 200, 20);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.42, 'rgba(255,255,255,0.10)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  grad.addColorStop(0.58, 'rgba(255,255,255,0.10)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 320);
  return makeCanvasTexture(THREE, canvas);
}

/** Key glyphs: home, menu, back, forward. */
function iconTexture(THREE: Three, icon: 'home' | 'menu' | 'back' | 'next', color: string): CanvasTexture {
  const [canvas, ctx] = canvas2d(128, 128);
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (icon === 'home') {
    ctx.moveTo(24, 68); ctx.lineTo(64, 32); ctx.lineTo(104, 68);
    ctx.moveTo(36, 62); ctx.lineTo(36, 100); ctx.lineTo(92, 100); ctx.lineTo(92, 62);
  } else if (icon === 'menu') {
    for (const y of [44, 64, 84]) { ctx.moveTo(32, y); ctx.lineTo(96, y); }
  } else if (icon === 'back') {
    ctx.moveTo(84, 44); ctx.lineTo(48, 64); ctx.lineTo(84, 84);
  } else {
    ctx.moveTo(48, 44); ctx.lineTo(84, 64); ctx.lineTo(48, 84);
  }
  ctx.stroke();
  return makeCanvasTexture(THREE, canvas);
}

/** Tiling fine noise: the moulded-plastic grain under the finish. */
function grainTexture(THREE: Three): CanvasTexture {
  const [canvas, ctx] = canvas2d(128, 128);
  const img = ctx.createImageData(128, 128);
  // Deterministic, so every mount (and the capture) has the same grain.
  let seed = 0xbeef;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 128 * 128; i++) {
    const v = 118 + Math.floor(rand() * 20);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const texture = makeCanvasTexture(THREE, canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 10);
  return texture;
}

/** Soft white radial falloff; each sprite's material colour tints it. */
function radialGlowTexture(THREE: Three): CanvasTexture {
  const [canvas, ctx] = canvas2d(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return makeCanvasTexture(THREE, canvas);
}

/** A single printed glyph on a transparent plate. */
function textTexture(THREE: Three, text: string, color: string): CanvasTexture {
  const [canvas, ctx] = canvas2d(512, 128);
  ctx.font = font(64, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 64);
  return makeCanvasTexture(THREE, canvas);
}

/**
 * The screen at rest: a status row with the tier name and signal bars, and
 * the Mon's name with one small line under it. Nothing else: the sheet's
 * tabs, stats and "CALL MON" are concept text, not canon (Q42). Colours are
 * the `hud` tokens. Redrawn once when the web fonts finish loading.
 */
function screenFaceTexture(THREE: Three, copy: DeviceScreenCopy, invalidate: () => void): CanvasTexture {
  const [canvas, ctx] = canvas2d(768, 1024);
  const W = 768;
  const H = 1024;
  const paint = () => {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, hud.bg1);
    bg.addColorStop(0.4, hud.bg0);
    bg.addColorStop(1, hud.bg0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Status row.
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = hud.dim;
    ctx.font = font(30, 600);
    ctx.fillText(copy.title, 40, 56);
    for (let i = 0; i < 4; i++) {
      const h = 10 + i * 7;
      ctx.fillRect(W - 112 + i * 16, 70 - h, 10, h);
    }
    ctx.fillStyle = hud.line;
    ctx.fillRect(40, 100, W - 80, 3);

    // The Mon's name, centred, with the line under it.
    ctx.textAlign = 'center';
    ctx.fillStyle = hud.text;
    ctx.font = font(96, 700);
    ctx.fillText(copy.mon, W / 2, H * 0.47);
    ctx.fillStyle = hud.dim;
    ctx.font = font(36, 500);
    ctx.fillText(copy.note, W / 2, H * 0.47 + 84);
    // A short red rule above the name: the scanner's colour, once.
    ctx.fillStyle = hud.red;
    ctx.fillRect(W / 2 - 36, H * 0.47 - 104, 72, 6);
  };
  paint();
  const texture = makeCanvasTexture(THREE, canvas);
  void document.fonts?.ready.then(() => {
    paint();
    texture.needsUpdate = true;
    invalidate();
  });
  return texture;
}
