import { brand, hlynk, led } from '@acme/theme';
import type { ThreeContext, ThreeFrame, ThreeScene } from '@acme/ui';
import { playNextelChirp } from './nextel-chirp';

/** What the stage hands the scene each frame. */
export interface DeviceSceneParams {
  /** `placeholder` is the procedural model below; `h-lynk-entry` swaps in the real GLB when it lands. */
  model: 'placeholder' | 'h-lynk-entry';
}

type Three = ThreeContext['THREE'];
type Group = InstanceType<Three['Group']>;
type Material = InstanceType<Three['Material']>;
type Geometry = NonNullable<ConstructorParameters<Three['Mesh']>[0]>;
type Mesh = InstanceType<Three['Mesh']>;

/** Idle yaw swing, radians, and its period, seconds. */
const YAW = 0.32;
const YAW_PERIOD = 9;
/** Pointer tilt cap: 8 degrees (BUILD_PROMPT §5). */
const MAX_TILT = (8 * Math.PI) / 180;
/** Resting three-quarter turn so the side keys and depth read. */
const REST_YAW = -0.38;

const CORE = hlynk.core;
/** Palette for the on-screen HUD (the screen's own UI, drawn on canvas). */
const HUD = {
  bg0: '#02081F',
  bg1: '#06265C',
  panel: '#0A1E4A',
  line: '#27498F',
  text: '#F8F8F8',
  dim: '#8FB3E8',
  red: '#F80000',
  redDeep: '#B00000',
  green: '#35D07F',
  cyan: '#4BA8F0',
  amber: '#FCB034',
};

/**
 * The H-Lynk Core procedural model (canon Decision #16): a matte red
 * rounded body, a black scanner head across the top with a camera lens,
 * two red emitters and a red fan of light above it, a stub antenna
 * top-left, a glossy screen running the H-Lynk HUD, printed wordmarks,
 * and the bottom control row either side of a red-ringed trackpad.
 * Units are body widths.
 *
 * The real GLB replaces the group built by `buildDevice`; framing,
 * lighting and motion stay.
 */
export function createDeviceScene({ THREE, renderer }: ThreeContext, initial: DeviceSceneParams): ThreeScene<DeviceSceneParams> {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Filmic curve off: the body has to stay the measured hlynk.core.body red, not drift to orange.
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.12, 5.4);
  camera.lookAt(0, 0.05, 0);

  // A tiny studio environment — sky gradient plus two softbox cards — baked
  // through PMREM. This is what sells the gloss: screen glare, plastic
  // sheen, metal rings. Fails soft; the directional rig still stands alone.
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(studioEnvironment(THREE), 0.04).texture;
    pmrem.dispose();
  } catch {
    scene.environment = null;
  }

  // Key from the upper left, a cool rim from behind right, soft fill.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1c1e21, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(brand.carolina, 1.6);
  rim.position.set(4, 2, -4);
  scene.add(rim);

  const device = buildDevice(THREE);
  // Dropped a touch so the scanner beam's fade lives inside the frame.
  device.group.position.y = -0.1;
  scene.add(device.group);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let boost = 0;
  let wasPressed = false;
  let tiltX = 0;
  let tiltY = 0;
  let model = initial.model;

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
      const target = frame.reducedMotion ? REST_YAW : REST_YAW + Math.sin((frame.time / YAW_PERIOD) * Math.PI * 2) * YAW;
      const goalX = frame.pointer.inside && !frame.reducedMotion ? -frame.pointer.y * MAX_TILT : 0;
      const goalY = frame.pointer.inside && !frame.reducedMotion ? frame.pointer.x * MAX_TILT : 0;
      // Frame-rate independent ease toward the goals.
      const k = frame.delta > 0 ? 1 - Math.exp(-frame.delta * 6) : 1;
      tiltX += (goalX - tiltX) * k;
      tiltY += (goalY - tiltY) * k;
      device.group.rotation.set(tiltX, target + tiltY, 0);
      // Screen interactivity: the pointer ray hits the glass, the HUD
      // highlights whatever sits under it. Holding over CALL MON feeds
      // the beam.
      let hover: HudRegion | null = null;
      let pttDown = false;
      if (frame.pointer.inside && !frame.reducedMotion) {
        ndc.set(frame.pointer.x, frame.pointer.y);
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.intersectObject(device.screen, false)[0];
        if (hit?.uv !== undefined) hover = hudRegionAt(hit.uv.x, hit.uv.y);
        // The side PTT key: press it and the lynk chirps, Nextel-style.
        pttDown = raycaster.intersectObject(device.ptt, false).length > 0 && frame.pointer.pressed;
        if (pttDown && !wasPressed) playNextelChirp();
      }
      device.ptt.position.x = pttDown ? device.ptt.userData.restX + 0.014 : device.ptt.userData.restX;
      wasPressed = frame.pointer.pressed;
      device.setHover(hover);
      if (hover?.startsWith('nav-')) device.setTab(Number(hover.slice(4)) as HudTab);
      boost += ((hover === 'call' ? 1 : 0) - boost) * k;
      if (!frame.reducedMotion) device.beamTick(frame.time, boost);
    },
    dispose: () => device.group.userData.dispose(),
  };
}

/** One tracked material/geometry bucket so `dispose` frees everything. */
function buildDevice(THREE: Three): {
  group: Group;
  screen: Mesh;
  setHover: (region: HudRegion | null) => void;
  setTab: (tab: HudTab) => void;
  ptt: Mesh;
  beamTick: (time: number, boost: number) => void;
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

  /** Matte red shell: plastic sheen from the room env, no metal. */
  const body = mat(new THREE.MeshStandardMaterial({
    // Blue shell variant — the token stays red for canon elsewhere.
    color: '#1D4ED8', roughness: 0.42, metalness: 0.04, envMapIntensity: 0.7,
    bumpMap: grain, bumpScale: 0.0015,
  }));
  /** Black rubberised trim: head, bezel, keys — softer reflections. */
  const black = mat(new THREE.MeshStandardMaterial({
    color: CORE.black, roughness: 0.58, metalness: 0.08, envMapIntensity: 0.3,
    bumpMap: grain, bumpScale: 0.001,
  }));
  /** Glossy black plastic: lens barrel, trackpad face. */
  const pianoBlack = mat(new THREE.MeshStandardMaterial({
    color: CORE.black, roughness: 0.14, metalness: 0.3, envMapIntensity: 1.0,
  }));
  /** Camera lens glass. */
  const lensGlass = mat(new THREE.MeshStandardMaterial({
    color: '#0A1030', roughness: 0.05, metalness: 0.55, envMapIntensity: 1.4,
  }));
  /** Screen glass running the interactive HUD; the map doubles as the emitter. */
  const hud = createHud(THREE);
  const hudTexture = tex(hud.texture);
  const screen = mat(new THREE.MeshStandardMaterial({
    map: hudTexture,
    emissiveMap: hudTexture,
    emissive: '#FFFFFF',
    emissiveIntensity: 0.62,
    roughness: 0.18,
    metalness: 0.3,
    envMapIntensity: 1.1,
  }));
  const emitter = mat(new THREE.MeshStandardMaterial({
    color: led.on, emissive: led.on, emissiveIntensity: 1.8, roughness: 0.25,
  }));
  const ring = mat(new THREE.MeshStandardMaterial({
    color: CORE.ring, emissive: CORE.ring, emissiveIntensity: 0.5, roughness: 0.4,
  }));
  /** Additive glow at the beam's mouth. */
  const glow = mat(new THREE.SpriteMaterial({
    map: tex(radialGlowTexture(THREE)), color: led.on, transparent: true, depthWrite: false,
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

  /** Printed text on a transparent decal plane. */
  const decal = (text: string, w: number, opts: { color?: string; weight?: number; size?: number } = {}) => {
    const t = tex(textTexture(THREE, text, opts));
    const m = mat(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    // textTexture draws into a 512×128 canvas.
    return { mesh: new THREE.Mesh(track(new THREE.PlaneGeometry(w, w * 0.25)), m), h: w * 0.25 };
  };

  // --- body ----------------------------------------------------------------

  // Shell: rounded slab, corner radius reads at the silhouette.
  box(rounded(W, H, D, 0.06), body, 0, 0, 0);
  // Chin under the control row: the slight lower bumper of the reference.
  box(rounded(W * 0.98, 0.1, D + 0.015, 0.04), body, 0, -top + 0.07, 0);

  // --- scanner head --------------------------------------------------------

  const headH = 0.17;
  const headY = top - headH / 2 - 0.02;
  box(rounded(0.92, headH, D + 0.06, 0.05), black, 0.03, headY, 0);
  // Head crown: a second, shallower step so the head reads moulded.
  box(rounded(0.7, 0.06, D + 0.045, 0.02), black, 0.1, headY + headH / 2 + 0.01, 0);

  // Camera lens on the head's left: red accent ring, barrel, glass, spec dot.
  box(track(new THREE.CylinderGeometry(0.056, 0.056, 0.026, 32)), emitter, -0.3, headY, front + 0.04).rotation.x = Math.PI / 2;
  box(track(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 32)), pianoBlack, -0.3, headY, front + 0.042).rotation.x = Math.PI / 2;
  box(track(new THREE.CylinderGeometry(0.036, 0.036, 0.032, 32)), lensGlass, -0.3, headY, front + 0.044).rotation.x = Math.PI / 2;
  box(track(new THREE.CylinderGeometry(0.011, 0.011, 0.034, 20)), emitter, -0.3, headY, front + 0.045).rotation.x = Math.PI / 2;

  // Two red emitters in the head's centre.
  for (const x of [0.14, 0.32]) {
    box(track(new THREE.CylinderGeometry(0.028, 0.028, 0.024, 20)), emitter, x, headY, front + 0.035).rotation.x = Math.PI / 2;
  }
  // The head's red lightbar — the lit slit of the reference.
  box(rounded(0.16, 0.02, 0.014, 0.008), emitter, 0.23, headY + 0.058, front + 0.034);

  // Antenna, top left: barrel with a rounded cap.
  box(track(new THREE.CylinderGeometry(0.038, 0.045, 0.2, 24)), black, -0.4, top + 0.1, -0.01);
  box(track(new THREE.SphereGeometry(0.041, 24, 16)), black, -0.4, top + 0.2, -0.01);
  // Antenna base ring.
  box(track(new THREE.CylinderGeometry(0.05, 0.055, 0.03, 24)), pianoBlack, -0.4, top + 0.005, -0.01);

  // The scan beam the head projects upward: layered cones with a hot core
  // and rising sparks, the "a Mon is coming out" look. `beam.tick` pulses
  // it each frame; under reduced motion it stays a steady fan.
  const beam = buildBeam(THREE, { track, mat, tex });
  beam.group.position.set(0.08, top, 0);
  group.add(beam.group);

  // A hot glow right at the emitter mouth.
  const glowSprite = new THREE.Sprite(glow);
  glowSprite.scale.set(0.9, 0.4, 1);
  glowSprite.position.set(0.08, top + 0.02, 0.05);
  group.add(glowSprite);

  // --- face ----------------------------------------------------------------

  // "EngineX" printed across the head.
  const enginex = decal('EngineX', 0.34, { size: 44, weight: 800 });
  enginex.mesh.position.set(0.02, headY + 0.015, front + 0.028);
  group.add(enginex.mesh);

  // Recessed bezel ring, then the screen glass itself.
  const screenY = 0.17;
  box(rounded(0.88, 1.08, 0.03, 0.03), black, 0, screenY, front + 0.012);
  const screenMesh = box(track(new THREE.PlaneGeometry(0.8, 1.0)), screen, 0, screenY, front + 0.029);

  // "H-Lynk Core" printed under the screen.
  const wordmark = decal('H-Lynk Core', 0.3, { size: 40, weight: 700 });
  wordmark.mesh.position.set(0, -0.41, front + 0.012);
  group.add(wordmark.mesh);

  // --- control row ----------------------------------------------------------

  const rowY = -0.64;
  // Two keys each side of the trackpad. The home key's icon is red, the
  // rest silver — the reference's control row.
  const keys: { x: number; icon: 'home' | 'menu' | 'back' | 'next'; red?: boolean }[] = [
    { x: -0.41, icon: 'home', red: true }, { x: -0.26, icon: 'menu' },
    { x: 0.26, icon: 'back' }, { x: 0.41, icon: 'next' },
  ];
  for (const { x, icon, red } of keys) {
    box(rounded(0.125, 0.14, 0.05, 0.022), pianoBlack, x, rowY, front + 0.02);
    const t = tex(iconTexture(THREE, icon, red ? '#FF4040' : '#E8E9EA'));
    const m = mat(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    const g = new THREE.Mesh(track(new THREE.PlaneGeometry(0.06, 0.06)), m);
    g.position.set(x, rowY, front + 0.047);
    group.add(g);
  }
  // Trackpad: red ring on a gloss black pad, slightly proud of the row.
  box(rounded(0.28, 0.28, 0.034, 0.045), ring, 0, rowY, front + 0.015);
  box(rounded(0.23, 0.23, 0.05, 0.035), pianoBlack, 0, rowY, front + 0.02);

  // --- side keys -------------------------------------------------------------
  // Right edge: two narrow keys, each carrying a red + / − mark.
  for (const [y, glyph] of [[0.36, '+'], [0.14, '-']] as const) {
    box(rounded(0.032, 0.15, 0.1, 0.012), black, W / 2 + 0.014, y, 0);
    const g = decal(glyph, 0.05, { size: 64, weight: 800, color: '#FF4040' });
    g.mesh.rotation.y = Math.PI / 2;
    g.mesh.position.set(W / 2 + 0.032, y, 0);
    group.add(g.mesh);
  }
  // Right edge, lower: a single round key.
  box(track(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 24)), pianoBlack, W / 2 + 0.014, -0.05, 0).rotation.z = Math.PI / 2;
  // Left edge: the long action key — the push-to-talk button.
  const ptt = box(rounded(0.032, 0.18, 0.1, 0.012), black, -W / 2 - 0.014, 0.28, 0);
  ptt.userData.restX = ptt.position.x;

  group.position.y = -0.15;
  return { group, screen: screenMesh, setHover: hud.setHover, setTab: hud.setTab, ptt, beamTick: beam.tick };
}

/**
 * The scanner beam, built to read like a projection, not a decal: three
 * nested cones (wide soft wash, mid beam, hot white-red core), each drawn
 * twice as crossed planes so the cone has volume from any yaw, plus a
 * column of sparks drifting up through the light. `tick` breathes the
 * brightness and feeds the sparks.
 */
function buildBeam(
  THREE: Three,
  ctx: {
    track: <G extends Geometry>(g: G) => G;
    mat: <M extends Material>(m: M) => M;
    tex: <T extends { dispose(): void }>(t: T) => T;
  },
): { group: Group; tick: (time: number, boost: number) => void } {
  const { track, mat, tex } = ctx;
  const group = new THREE.Group();
  const LENGTH = 0.58;
  // Lean back a touch: it reads as projection, not a sticker, and the tip
  // clears the stage's top edge.
  group.rotation.x = -0.12;

  // Shared falloff: bright at the mouth, fading with height and toward
  // the beam's edge. A texture, not vertex alpha — TSL materials need it.
  const gradient = tex(beamGradientTexture(THREE));

  /** One cone layer: a trapezoid with the gradient map, drawn as crossed planes. */
  const cone = (halfBase: number, halfTop: number, color: string, peakAlpha: number) => {
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
      color, map: gradient, transparent: true, opacity: peakAlpha,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }));
    for (const yaw of [0, Math.PI / 2]) {
      const mesh = new THREE.Mesh(geo, material);
      mesh.rotation.y = yaw;
      group.add(mesh);
    }
    return material;
  };

  // Wide wash → mid beam → hot core, back to front.
  const wash = cone(0.38, 0.1, led.on, 0.45);
  const mid = cone(0.32, 0.1, led.on, 0.75);
  const core = cone(0.14, 0.045, '#FFD2D2', 0.95);

  // Sparks: small additive sprites seeded inside the cone volume.
  const sparkTex = tex(radialGlowTexture(THREE));
  const sparkMat = mat(new THREE.SpriteMaterial({
    map: sparkTex, color: '#FF9B9B', transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  const sparkMatHot = mat(new THREE.SpriteMaterial({
    map: sparkTex, color: '#FFE8E8', transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  interface Spark { sprite: InstanceType<Three['Sprite']>; y0: number; speed: number; phase: number; spread: number; size: number }
  const sparks: Spark[] = [];
  const rand = mulberry(0xC0FFEE);
  for (let i = 0; i < 26; i++) {
    // Per-spark material: the tick fades each sprite independently.
    const sprite = new THREE.Sprite(mat((i % 3 === 0 ? sparkMatHot : sparkMat).clone()));
    const spark: Spark = {
      sprite,
      y0: rand(),
      speed: 0.35 + rand() * 0.5,
      phase: rand() * Math.PI * 2,
      spread: 0.25 + rand() * 0.75,
      size: 0.02 + rand() * 0.045,
    };
    sparks.push(spark);
    group.add(sprite);
  }

  const tick = (time: number, boost: number) => {
    // The beam breathes — a slow pulse like a scanner cycling. CALL MON
    // hovering feeds it: brighter, longer, sparks run faster.
    const amp = 1 + 0.55 * boost;
    const pulse = 0.82 + 0.18 * Math.sin(time * (2.1 + boost));
    wash.opacity = Math.min(1, 0.45 * pulse * amp);
    mid.opacity = Math.min(1, 0.75 * (0.75 + 0.25 * pulse) * amp);
    core.opacity = Math.min(1, 0.95 * (0.85 + 0.15 * Math.sin(time * 3.7 + 1)) * amp);
    group.scale.y = 1 + 0.12 * boost;
    for (const s of sparks) {
      const t = (s.y0 + time * s.speed * (1 + 1.4 * boost)) % 1;
      const y = t * LENGTH;
      // Cone widens with height; sparks wander inside it and twinkle.
      const r = (0.06 + (0.5 - 0.06) * t) * s.spread;
      const a = s.phase + time * 0.8;
      s.sprite.position.set(Math.cos(a) * r, y, Math.sin(a) * r * 0.6);
      const fade = Math.sin(t * Math.PI);
      const scale = s.size * (0.6 + 0.6 * fade) * (1 + 0.5 * boost);
      s.sprite.scale.set(scale, scale, 1);
      s.sprite.material.opacity = fade * (0.6 + 0.4 * Math.sin(time * 5 + s.phase));
    }
  };

  return { group, tick };
}

/** Deterministic PRNG so the sparks are the same on every mount. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A minimal studio for PMREM: a gradient dome (bright zenith, dark floor)
 * plus two white softbox cards where a product shoot would put them. The
 * environment only exists long enough to be baked to a texture.
 */
function studioEnvironment(THREE: Three): InstanceType<Three['Scene']> {
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(10, 24, 16),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }),
  );
  const pos = dome.geometry.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) / 10 + 1) / 2; // 0 floor → 1 zenith
    colors.set([0.04 + t * 0.9, 0.05 + t * 0.92, 0.09 + t], i * 3);
  }
  dome.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  env.add(dome);
  // Softbox left of camera, a cooler card behind right — where the screen
  // glare and the red shell's sheen come from.
  const softbox = (w: number, h: number, color: number, intensity: number, px: number, py: number, pz: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }),
    );
    m.position.set(px, py, pz);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  softbox(6, 8, 0xffffff, 6, -6, 5, 4);
  softbox(4, 6, 0x9fc8ff, 3, 6, 2, -5);
  return env;
}

// ============================================================================
// Canvas textures — all the printed/lit detail lives here.
// ============================================================================

type CanvasTexture = InstanceType<Three['CanvasTexture']>;

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
 * The beam's alpha falloff: opaque white at the mouth's centre, fading
 * upward and toward the edges. RGB is white so the material's own colour
 * carries the tint; alpha does the shaping.
 */
function beamGradientTexture(THREE: Three): CanvasTexture {
  const [canvas, ctx] = canvas2d(128, 512);
  const img = ctx.createImageData(128, 512);
  for (let y = 0; y < 512; y++) {
    // Canvas row 0 is the texture's top (v=1) — the beam's apex. Row 511 is
    // v=0, the mouth. The alpha climbs from the tip toward the mouth so the
    // light dissolves instead of ending at the trapezoid's edge.
    const t = y / 511;
    const vertical = Math.pow(t, 1.7);
    for (let x = 0; x < 128; x++) {
      // Feather to zero *inside* the trapezoid edge — a sine still leaves a
      // visible silhouette on light backgrounds under additive blending.
      const u = x / 127;
      const m = Math.min(u, 1 - u) / 0.28;
      const edge = m >= 1 ? 1 : m * m * (3 - 2 * m);
      const a = Math.round(255 * vertical * edge);
      const i = (y * 128 + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return makeCanvasTexture(THREE, canvas);
}

/** Small vector icons for the control keys — home, menu, back, next. */
function iconTexture(THREE: Three, icon: 'home' | 'menu' | 'back' | 'next', color: string): CanvasTexture {
  const [canvas, ctx] = canvas2d(128, 128);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (icon === 'home') {
    ctx.beginPath();
    ctx.moveTo(24, 68); ctx.lineTo(64, 32); ctx.lineTo(104, 68);
    ctx.moveTo(36, 62); ctx.lineTo(36, 100); ctx.lineTo(92, 100); ctx.lineTo(92, 62);
    ctx.stroke();
  } else if (icon === 'menu') {
    for (const y of [44, 64, 84]) {
      ctx.beginPath(); ctx.moveTo(32, y); ctx.lineTo(96, y); ctx.stroke();
    }
  } else if (icon === 'back') {
    ctx.beginPath();
    ctx.moveTo(84, 44); ctx.lineTo(48, 64); ctx.lineTo(84, 84);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(48, 44); ctx.lineTo(84, 64); ctx.lineTo(48, 84);
    ctx.stroke();
  }
  return makeCanvasTexture(THREE, canvas);
}

/** Tiling fine noise — the moulded-plastic grain under the gloss. */
function grainTexture(THREE: Three): CanvasTexture {
  const [canvas, ctx] = canvas2d(128, 128);
  const img = ctx.createImageData(128, 128);
  const rand = mulberry(0xBEEF);
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

/** Soft radial sprite used for the emitter glow. */
function radialGlowTexture(THREE: Three): CanvasTexture {
  const [canvas, ctx] = canvas2d(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,80,80,0.9)');
  g.addColorStop(0.4, 'rgba(248,0,0,0.35)');
  g.addColorStop(1, 'rgba(248,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return makeCanvasTexture(THREE, canvas);
}

/** A single line of printed text on a transparent plate. */
function textTexture(THREE: Three, text: string, { size = 48, weight = 700, color = '#FFFFFF' } = {}): CanvasTexture {
  const [canvas, ctx] = canvas2d(512, 128);
  ctx.font = `${weight} ${size}px 'Space Grotesk', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 64);
  return makeCanvasTexture(THREE, canvas);
}

/** The interactive areas of the HUD, in draw order. */
type HudRegion = 'call' | `nav-${0 | 1 | 2 | 3 | 4}` | `chip-${0 | 1 | 2 | 3}`;
/** The five screens behind the nav row: DEX, CREW, CARE, BAG, CITY. */
type HudTab = 0 | 1 | 2 | 3 | 4;

/** Screen UV → HUD region. UV v runs bottom-up; the canvas runs top-down. */
function hudRegionAt(u: number, v: number): HudRegion | null {
  const W = 768;
  const x = u * W;
  const y = (1 - v) * 1024;
  if (x >= 32 && x <= W - 32 && y >= 790 && y <= 876) return 'call';
  if (x >= 32 && x <= W - 32 && y >= 920 && y <= 1004) {
    return `nav-${Math.min(4, Math.floor((x - 32) / ((W - 64) / 5))) as 0 | 1 | 2 | 3 | 4}`;
  }
  const chipStart = (W - 170 * 4 - 12 * 3) / 2;
  if (y >= 620 && y <= 750 && x >= chipStart && x <= chipStart + 170 * 4 + 12 * 3) {
    const i = Math.floor((x - chipStart) / 182);
    if ((x - chipStart) % 182 <= 170) return `chip-${i as 0 | 1 | 2 | 3}`;
  }
  return null;
}

/**
 * The screen's UI as a live canvas: `setHover` redraws with the hovered
 * element lit, and the texture uploads only when the hover target moves.
 */
function createHud(THREE: Three): {
  texture: CanvasTexture;
  setHover: (region: HudRegion | null) => void;
  setTab: (tab: HudTab) => void;
} {
  const [canvas, ctx] = canvas2d(768, 1024);
  let hover: HudRegion | null = null;
  let tab: HudTab = 2; // CARE, the reference's screen
  drawHud(ctx, tab, hover);
  const texture = makeCanvasTexture(THREE, canvas);
  const paint = () => {
    drawHud(ctx, tab, hover);
    texture.needsUpdate = true;
  };
  return {
    texture,
    setHover: (region) => {
      if (region === hover) return;
      hover = region;
      paint();
    },
    setTab: (next) => {
      if (next === tab) return;
      tab = next;
      paint();
    },
  };
}

/**
 * The screen's UI: status bar, mon card, four stat chips, the CALL MON
 * bar and the bottom nav — the reference's layout in the H-Lynk palette.
 * `hover` names the lit element.
 */
function drawHud(ctx: CanvasRenderingContext2D, tab: HudTab, hover: HudRegion | null): void {
  const W = 768;
  const H = 1024;
  ctx.clearRect(0, 0, W, H);

  // Backdrop: deep navy lifting to royal at the top.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, HUD.bg1);
  bg.addColorStop(0.35, HUD.bg0);
  bg.addColorStop(1, HUD.bg0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const font = (size: number, weight = 700) => `${weight} ${size}px 'Space Grotesk', system-ui, sans-serif`;
  const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // --- status bar ----------------------------------------------------------
  ctx.fillStyle = HUD.cyan;
  ctx.font = font(26, 600);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚡ H-Lynk Core', 28, 40);
  // Signal bars + battery, right aligned.
  ctx.fillStyle = HUD.dim;
  for (let i = 0; i < 4; i++) ctx.fillRect(W - 200 + i * 12, 48 - i * 8, 8, 8 + i * 8);
  roundedRect(W - 120, 28, 56, 26, 6);
  ctx.strokeStyle = HUD.dim;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillRect(W - 114, 34, 36, 14);

  if (tab === 2) {
  // --- mon card --------------------------------------------------------------
  ctx.textAlign = 'left';
  ctx.fillStyle = HUD.text;
  ctx.font = font(54, 800);
  ctx.fillText('Hood Ratti', 32, 118);
  ctx.fillStyle = HUD.dim;
  ctx.font = font(30, 600);
  ctx.fillText('Lv. 12', 34, 168);
  // SCAN READY pill.
  roundedRect(W - 250, 96, 220, 56, 28);
  ctx.fillStyle = HUD.green;
  ctx.fill();
  ctx.fillStyle = '#04240F';
  ctx.font = font(26, 800);
  ctx.textAlign = 'center';
  ctx.fillText('SCAN READY', W - 140, 124);

  // Radar ring: outer circle, ticks, inner ring, mon silhouette.
  const cx = W / 2;
  const cy = 380;
  const R = 175;
  ctx.strokeStyle = HUD.line;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = HUD.cyan;
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const inner = i % 3 === 0 ? R - 18 : R - 9;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Scan arc + brackets.
  ctx.strokeStyle = HUD.red;
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(cx, cy, R + 14, -0.9, -0.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, R + 14, Math.PI - 0.9, Math.PI - 0.2); ctx.stroke();
  // Inner dashed ring.
  ctx.strokeStyle = HUD.line;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 10]);
  ctx.beginPath(); ctx.arc(cx, cy, R - 34, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  // Mon silhouette: round-eared critter on a glowing plate.
  const plate = ctx.createRadialGradient(cx, cy + 130, 10, cx, cy + 130, 120);
  plate.addColorStop(0, 'rgba(248,0,0,0.55)');
  plate.addColorStop(1, 'rgba(248,0,0,0)');
  ctx.fillStyle = plate;
  ctx.beginPath(); ctx.ellipse(cx, cy + 128, 118, 30, 0, 0, Math.PI * 2); ctx.fill();
  // Body.
  ctx.fillStyle = '#F4F4F6';
  ctx.beginPath(); ctx.ellipse(cx, cy + 40, 62, 74, 0, 0, Math.PI * 2); ctx.fill();
  // Hoodie.
  ctx.fillStyle = '#2A2D3A';
  ctx.beginPath(); ctx.ellipse(cx, cy + 62, 64, 52, 0, 0.15, Math.PI - 0.15); ctx.fill();
  // Head + big round ears.
  ctx.fillStyle = '#F4F4F6';
  ctx.beginPath(); ctx.arc(cx, cy - 48, 58, 0, Math.PI * 2); ctx.fill();
  for (const ex of [-52, 52]) {
    ctx.beginPath(); ctx.arc(cx + ex, cy - 96, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F8B0B0';
    ctx.beginPath(); ctx.arc(cx + ex, cy - 96, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F4F4F6';
  }
  // Eyes + nose.
  ctx.fillStyle = HUD.redDeep;
  ctx.beginPath(); ctx.arc(cx - 22, cy - 56, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 22, cy - 56, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2A2D3A';
  ctx.beginPath(); ctx.arc(cx, cy - 34, 6, 0, Math.PI * 2); ctx.fill();
  // Tail curl.
  ctx.strokeStyle = '#F4F4F6';
  ctx.lineWidth = 12;
  ctx.beginPath(); ctx.arc(cx + 92, cy + 80, 30, Math.PI * 0.7, Math.PI * 1.9); ctx.stroke();

  // --- stat chips --------------------------------------------------------------
  const stats = [
    ['♥', 'HP', '82 / 82', HUD.red],
    ['⚡', 'ENERGY', '74 / 100', HUD.cyan],
    ['◕', 'FULLNESS', '68 / 100', HUD.amber],
    ['☷', 'SOCIAL', '92 / 100', HUD.green],
  ];
  const chipW = 170;
  const chipH = 130;
  const gap = 12;
  const startX = (W - chipW * 4 - gap * 3) / 2;
  const chipY = 620;
  ctx.font = font(24, 700);
  stats.forEach(([icon, label, value, color], i) => {
    const x = startX + i * (chipW + gap);
    const lit = hover === `chip-${i}`;
    roundedRect(x, chipY, chipW, chipH, 14);
    ctx.fillStyle = lit ? '#12306B' : HUD.panel;
    ctx.fill();
    ctx.strokeStyle = lit ? HUD.text : HUD.line;
    ctx.lineWidth = lit ? 3 : 2;
    ctx.stroke();
    ctx.fillStyle = color as string;
    ctx.font = font(26, 800);
    ctx.fillText(icon as string, x + 16, chipY + 30);
    ctx.fillStyle = HUD.dim;
    ctx.font = font(18, 700);
    ctx.fillText(label as string, x + 52, chipY + 30);
    ctx.fillStyle = HUD.text;
    ctx.font = font(22, 800);
    ctx.fillText(value as string, x + 16, chipY + 66);
    // Bar.
    const fill = parseInt((value as string).split(' ')[0], 10) / parseInt((value as string).split(' ')[2], 10);
    roundedRect(x + 16, chipY + 92, chipW - 32, 12, 6);
    ctx.fillStyle = HUD.line;
    ctx.fill();
    roundedRect(x + 16, chipY + 92, (chipW - 32) * fill, 12, 6);
    ctx.fillStyle = color as string;
    ctx.fill();
  });

  // --- CALL MON bar ----------------------------------------------------------
  if (hover === 'call') {
    ctx.shadowColor = 'rgba(248,60,60,0.9)';
    ctx.shadowBlur = 32;
  }
  roundedRect(32, 790, W - 64, 86, 43);
  const call = ctx.createLinearGradient(32, 0, W - 32, 0);
  call.addColorStop(0, hover === 'call' ? '#E02020' : HUD.redDeep);
  call.addColorStop(1, hover === 'call' ? '#FF4040' : HUD.red);
  ctx.fillStyle = call;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = HUD.text;
  ctx.font = font(40, 900);
  ctx.fillText('∿  CALL MON  ›', W / 2, 834);
  } else {
    drawTabScreen(ctx, tab, hover);
  }

  // --- bottom nav --------------------------------------------------------------
  const nav: [string, string, boolean][] = [
    ['⌂', 'DEX', false], ['♢', 'CREW', false], ['♥', 'CARE', true], ['▣', 'BAG', false], ['◈', 'CITY', false],
  ];
  const navY = 920;
  const navW = (W - 64) / 5;
  nav.forEach(([icon, label], i) => {
    const lit = hover === `nav-${i}`;
    const on = i === tab;
    const x = 32 + i * navW;
    roundedRect(x + 8, navY, navW - 16, 84, 16);
    ctx.fillStyle = on || lit ? HUD.red : HUD.panel;
    ctx.fill();
    ctx.strokeStyle = lit ? HUD.text : on ? HUD.red : HUD.line;
    ctx.lineWidth = lit ? 3 : 2;
    ctx.stroke();
    ctx.fillStyle = HUD.text;
    ctx.font = font(30, 700);
    ctx.fillText(icon, x + navW / 2, navY + 32);
    ctx.font = font(18, 800);
    ctx.fillText(label, x + navW / 2, navY + 62);
  });
}

const rr = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
const hudFont = (size: number, weight = 700) => `${weight} ${size}px 'Space Grotesk', system-ui, sans-serif`;

/** A screen header: big title left, dim subtitle right. */
function screenHeader(ctx: CanvasRenderingContext2D, title: string, subtitle: string) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = HUD.text;
  ctx.font = hudFont(52, 800);
  ctx.fillText(title, 32, 112);
  ctx.textAlign = 'right';
  ctx.fillStyle = HUD.dim;
  ctx.font = hudFont(26, 600);
  ctx.fillText(subtitle, 736, 116);
  ctx.textAlign = 'center';
}

/** A round Mon avatar: colour plate, ears, eyes. */
function avatar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, dark: string) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = dark;
  for (const ex of [-r * 0.7, r * 0.7]) {
    ctx.beginPath(); ctx.arc(x + ex, y - r * 0.9, r * 0.34, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#1A1030';
  ctx.beginPath(); ctx.arc(x - r * 0.26, y - r * 0.06, r * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.26, y - r * 0.06, r * 0.08, 0, Math.PI * 2); ctx.fill();
}

/** The four non-CARE screens behind the nav row. */
function drawTabScreen(ctx: CanvasRenderingContext2D, tab: HudTab, hover: HudRegion | null): void {
  void hover; // tab screens highlight only via the nav row today
  const W = 768;
  if (tab === 0) {
    // DEX: the caught list.
    screenHeader(ctx, 'MON DEX', '12 CAUGHT');
    const mons = [
      ['Hood Ratti', 'Lv. 12', 'MIDTOWN', '#F4F4F6', '#2A2D3A'],
      ['Squeaklet', 'Lv. 7', 'DOWNTOWN', '#E8C9A0', '#7A4A20'],
      ['Kittee Cee', 'Lv. 5', 'HARLEM', '#C9D4F0', '#2A2D3A'],
      ['Yotito', 'Lv. 4', 'MEGA CITY', '#BFE8C0', '#1E5A28'],
      ['Boro Beetle', 'Lv. 9', 'QUEENS', '#F0C9C9', '#6A2A2A'],
    ];
    mons.forEach(([name, lv, district, color, dark], i) => {
      const y = 170 + i * 130;
      rr(ctx, 32, y, W - 64, 110, 16);
      ctx.fillStyle = HUD.panel;
      ctx.fill();
      ctx.strokeStyle = HUD.line;
      ctx.lineWidth = 2;
      ctx.stroke();
      avatar(ctx, 100, y + 55, 34, color, dark);
      ctx.textAlign = 'left';
      ctx.fillStyle = HUD.text;
      ctx.font = hudFont(34, 800);
      ctx.fillText(name, 160, y + 44);
      ctx.fillStyle = HUD.dim;
      ctx.font = hudFont(24, 600);
      ctx.fillText(district, 160, y + 82);
      ctx.textAlign = 'right';
      ctx.fillStyle = HUD.cyan;
      ctx.font = hudFont(28, 800);
      ctx.fillText(lv, W - 60, y + 55);
      ctx.textAlign = 'center';
    });
  } else if (tab === 1) {
    // CREW: the active party grid.
    screenHeader(ctx, 'THE CREW', '6 MONS');
    const crew = [
      ['Hood Ratti', 'BOND 88', '#F4F4F6', '#2A2D3A'],
      ['Squeaklet', 'BOND 61', '#E8C9A0', '#7A4A20'],
      ['Kittee Cee', 'BOND 54', '#C9D4F0', '#2A2D3A'],
      ['Yotito', 'BOND 42', '#BFE8C0', '#1E5A28'],
      ['Boro Beetle', 'BOND 37', '#F0C9C9', '#6A2A2A'],
      ['Pigeon Punk', 'BOND 30', '#D0D0D8', '#3A3A50'],
    ];
    crew.forEach(([name, bond, color, dark], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 32 + col * ((W - 64) / 2) + 12;
      const y = 170 + row * 220;
      const cw = (W - 64) / 2 - 24;
      rr(ctx, x, y, cw, 200, 18);
      ctx.fillStyle = HUD.panel;
      ctx.fill();
      ctx.strokeStyle = HUD.line;
      ctx.lineWidth = 2;
      ctx.stroke();
      avatar(ctx, x + cw / 2, y + 84, 44, color, dark);
      ctx.fillStyle = HUD.text;
      ctx.font = hudFont(26, 800);
      ctx.fillText(name, x + cw / 2, y + 148);
      ctx.fillStyle = HUD.cyan;
      ctx.font = hudFont(20, 700);
      ctx.fillText(bond, x + cw / 2, y + 176);
    });
  } else if (tab === 3) {
    // BAG: the item slots.
    screenHeader(ctx, 'BAG', '8 ITEMS');
    const items = [
      ['CALL CAPSULE', 'x6', '#F80000'], ['MON SNACK', 'x12', '#FCB034'],
      ['PATCH KIT', 'x3', '#4BA8F0'], ['ZAP CELL', 'x8', '#35D07F'],
      ['DIM SUM', 'x5', '#E8C9A0'], ['METRO PASS', 'x1', '#BEC0C2'],
      ['SIGNAL AMP', 'x2', '#C9D4F0'], ['LUCKY DICE', 'x1', '#F0C9C9'],
    ];
    items.forEach(([name, count, color], i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const cw = (W - 64 - 36) / 4;
      const x = 32 + col * (cw + 12);
      const y = 180 + row * 260;
      rr(ctx, x, y, cw, 240, 16);
      ctx.fillStyle = HUD.panel;
      ctx.fill();
      ctx.strokeStyle = HUD.line;
      ctx.lineWidth = 2;
      ctx.stroke();
      // The item: a rounded capsule block in the item colour.
      rr(ctx, x + cw / 2 - 30, y + 34, 60, 90, 14);
      ctx.fillStyle = color;
      ctx.fill();
      rr(ctx, x + cw / 2 - 30, y + 34, 60, 30, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();
      ctx.fillStyle = HUD.text;
      ctx.font = hudFont(20, 800);
      ctx.fillText(name, x + cw / 2, y + 168);
      ctx.fillStyle = HUD.dim;
      ctx.font = hudFont(22, 700);
      ctx.fillText(count, x + cw / 2, y + 202);
    });
  } else {
    // CITY: a wild encounter — the generated duel.
    screenHeader(ctx, 'MIDTOWN', 'WILD ENCOUNTER');
    // Sky.
    const sky = ctx.createLinearGradient(0, 160, 0, 560);
    sky.addColorStop(0, '#0B1B4A');
    sky.addColorStop(1, '#1C0E3A');
    ctx.fillStyle = sky;
    rr(ctx, 32, 160, W - 64, 560, 18);
    ctx.fill();
    ctx.save();
    rr(ctx, 32, 160, W - 64, 560, 18);
    ctx.clip();
    // Skyline silhouette.
    ctx.fillStyle = '#060B24';
    const skyline = [80, 130, 70, 150, 95, 120, 60, 140, 88, 110, 75, 135, 100, 65, 125, 92];
    skyline.forEach((h, i) => ctx.fillRect(32 + i * 46, 560 - h, 42, h));
    // Ground.
    ctx.fillStyle = '#101738';
    ctx.fillRect(32, 560, W - 64, 160);
    ctx.strokeStyle = '#2A3A6E';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(32, 560); ctx.lineTo(W - 32, 560); ctx.stroke();
    // The duel: Hood Ratti on the left, a wild shadow Mon on the right.
    // Ratti, lit side.
    avatar(ctx, 210, 500, 70, '#F4F4F6', '#2A2D3A');
    ctx.strokeStyle = '#F4F4F6';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(272, 530, 24, Math.PI * 0.7, Math.PI * 1.9); ctx.stroke();
    // Wild mon: dark silhouette, spiky ears, red eyes.
    ctx.fillStyle = '#12142A';
    ctx.beginPath(); ctx.arc(560, 500, 76, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(516, 448); ctx.lineTo(496, 388); ctx.lineTo(546, 428); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(604, 448); ctx.lineTo(624, 388); ctx.lineTo(574, 428); ctx.closePath(); ctx.fill();
    ctx.fillStyle = HUD.red;
    ctx.beginPath(); ctx.arc(536, 488, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(584, 488, 9, 0, Math.PI * 2); ctx.fill();
    // The VS burst between them.
    const burst = ctx.createRadialGradient(384, 470, 6, 384, 470, 90);
    burst.addColorStop(0, 'rgba(252,124,0,0.9)');
    burst.addColorStop(0.5, 'rgba(248,0,0,0.45)');
    burst.addColorStop(1, 'rgba(248,0,0,0)');
    ctx.fillStyle = burst;
    ctx.beginPath(); ctx.arc(384, 470, 90, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = HUD.text;
    ctx.font = hudFont(72, 900);
    ctx.fillText('VS', 384, 474);
    // HP plates under each fighter.
    for (const [x, name, pct] of [[60, 'HOOD RATTI', 0.82], [W - 320, 'WILD MON', 1.0]] as const) {
      rr(ctx, x, 600, 260, 84, 12);
      ctx.fillStyle = 'rgba(4,10,32,0.85)';
      ctx.fill();
      ctx.fillStyle = HUD.text;
      ctx.font = hudFont(24, 800);
      ctx.fillText(name, x + 130, 628);
      rr(ctx, x + 20, 648, 220, 12, 6);
      ctx.fillStyle = HUD.line;
      ctx.fill();
      rr(ctx, x + 20, 648, 220 * pct, 12, 6);
      ctx.fillStyle = pct > 0.5 ? HUD.green : HUD.amber;
      ctx.fill();
    }
    ctx.restore();
    // Action buttons.
    for (const [x, label, red] of [[32, 'FIGHT', true], [W / 2 + 8, 'CALL', false]] as const) {
      rr(ctx, x, 760, W / 2 - 40, 80, 40);
      ctx.fillStyle = red ? HUD.red : HUD.panel;
      ctx.fill();
      ctx.strokeStyle = red ? HUD.red : HUD.line;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = HUD.text;
      ctx.font = hudFont(36, 900);
      ctx.fillText(label, x + (W / 2 - 40) / 2, 802);
    }
  }
}
