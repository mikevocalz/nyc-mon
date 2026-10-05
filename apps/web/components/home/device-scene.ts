import { brand, hlynk, led } from '@acme/theme';
import type { ThreeContext, ThreeFrame, ThreeScene } from '@acme/ui';

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
  scene.add(device);

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
      device.rotation.set(tiltX, target + tiltY, 0);
      if (!frame.reducedMotion) device.userData.beamTick?.(frame.time);
    },
    dispose: () => device.userData.dispose(),
  };
}

/** One tracked material/geometry bucket so `dispose` frees everything. */
function buildDevice(THREE: Three): Group {
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
  const D = 0.16;
  const top = H / 2;
  const front = D / 2;

  // --- materials -----------------------------------------------------------

  /** Matte red shell: plastic sheen from the room env, no metal. */
  const body = mat(new THREE.MeshStandardMaterial({
    color: CORE.body, roughness: 0.42, metalness: 0.04, envMapIntensity: 0.7,
  }));
  /** Black rubberised trim: head, bezel, keys — softer reflections. */
  const black = mat(new THREE.MeshStandardMaterial({
    color: CORE.black, roughness: 0.5, metalness: 0.12, envMapIntensity: 0.6,
  }));
  /** Glossy black plastic: lens barrel, trackpad face. */
  const pianoBlack = mat(new THREE.MeshStandardMaterial({
    color: CORE.black, roughness: 0.14, metalness: 0.3, envMapIntensity: 1.0,
  }));
  /** Camera lens glass. */
  const lensGlass = mat(new THREE.MeshStandardMaterial({
    color: '#0A1030', roughness: 0.05, metalness: 0.55, envMapIntensity: 1.4,
  }));
  /** Screen glass running the HUD texture; the map doubles as the emitter. */
  const hudTexture = tex(hudCanvasTexture(THREE));
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
      curveSegments: 6,
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
  box(rounded(W, H, D, 0.055), body, 0, 0, 0);
  // Chin under the control row: the slight lower bumper of the reference.
  box(rounded(W * 0.98, 0.1, D + 0.015, 0.04), body, 0, -top + 0.07, 0);

  // --- scanner head --------------------------------------------------------

  const headH = 0.17;
  const headY = top - headH / 2 - 0.02;
  box(rounded(0.9, headH, D + 0.05, 0.05), black, 0.04, headY, 0);

  // Camera lens on the head's left: barrel, glass and a spec dot.
  box(track(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 32)), pianoBlack, -0.28, headY, front + 0.035).rotation.x = Math.PI / 2;
  box(track(new THREE.CylinderGeometry(0.038, 0.038, 0.032, 32)), lensGlass, -0.28, headY, front + 0.036).rotation.x = Math.PI / 2;
  box(track(new THREE.CylinderGeometry(0.012, 0.012, 0.034, 20)), emitter, -0.28, headY, front + 0.037).rotation.x = Math.PI / 2;

  // Two red emitters in the head's centre.
  for (const x of [0.16, 0.34]) {
    box(track(new THREE.CylinderGeometry(0.028, 0.028, 0.022, 20)), emitter, x, headY, front + 0.03).rotation.x = Math.PI / 2;
  }
  // Thin status slit between the emitters.
  box(rounded(0.09, 0.014, 0.012, 0.006), emitter, 0.25, headY + 0.055, front + 0.028);

  // Antenna, top left: barrel with a rounded cap.
  box(track(new THREE.CylinderGeometry(0.038, 0.045, 0.2, 24)), black, -0.4, top + 0.1, -0.01);
  box(track(new THREE.SphereGeometry(0.041, 24, 16)), black, -0.4, top + 0.2, -0.01);
  // Antenna base ring.
  box(track(new THREE.CylinderGeometry(0.05, 0.055, 0.03, 24)), pianoBlack, -0.4, top + 0.005, -0.01);

  // The scan beam the head projects upward: layered cones with a hot core
  // and rising sparks, the "a Mon is coming out" look. `beam.tick` pulses
  // it each frame; under reduced motion it stays a steady fan.
  const beam = buildBeam(THREE, { track, mat, tex });
  beam.group.position.set(0.25, top, 0);
  group.add(beam.group);
  group.userData.beamTick = beam.tick;

  // A hot glow right at the emitter mouth.
  const glowSprite = new THREE.Sprite(glow);
  glowSprite.scale.set(0.9, 0.4, 1);
  glowSprite.position.set(0.25, top + 0.02, 0.05);
  group.add(glowSprite);

  // --- face ----------------------------------------------------------------

  // "EngineX" printed across the head.
  const enginex = decal('EngineX', 0.34, { size: 44, weight: 800 });
  enginex.mesh.position.set(0.02, headY + 0.015, front + 0.028);
  group.add(enginex.mesh);

  // Recessed bezel ring, then the screen glass itself.
  const screenY = 0.17;
  box(rounded(0.88, 1.08, 0.03, 0.03), black, 0, screenY, front + 0.012);
  box(track(new THREE.PlaneGeometry(0.8, 1.0)), screen, 0, screenY, front + 0.029);

  // "H-Lynk Core" printed under the screen.
  const wordmark = decal('H-Lynk Core', 0.3, { size: 40, weight: 700 });
  wordmark.mesh.position.set(0, -0.41, front + 0.012);
  group.add(wordmark.mesh);

  // --- control row ----------------------------------------------------------

  const rowY = -0.64;
  // Two keys each side of the trackpad, each with a printed glyph.
  const keys: { x: number; glyph: string }[] = [
    { x: -0.4, glyph: '⌂' }, { x: -0.26, glyph: '≡' },
    { x: 0.26, glyph: '↺' }, { x: 0.4, glyph: '›' },
  ];
  for (const { x, glyph } of keys) {
    box(rounded(0.12, 0.13, 0.045, 0.02), pianoBlack, x, rowY, front + 0.02);
    const g = decal(glyph, 0.07, { size: 52, weight: 700, color: '#BEC0C2' });
    g.mesh.position.set(x, rowY, front + 0.045);
    group.add(g.mesh);
  }
  // Trackpad: red ring on a gloss black pad.
  box(rounded(0.27, 0.27, 0.032, 0.04), ring, 0, rowY, front + 0.015);
  box(rounded(0.225, 0.225, 0.045, 0.03), pianoBlack, 0, rowY, front + 0.02);

  // --- side keys -------------------------------------------------------------
  // Right edge: two narrow keys with red accent slits between them.
  for (const y of [0.36, 0.14]) {
    box(rounded(0.03, 0.15, 0.09, 0.012), black, W / 2 + 0.012, y, 0);
  }
  box(rounded(0.008, 0.2, 0.05, 0.004), emitter, W / 2 + 0.028, 0.25, 0);
  // Right edge, lower: a single round key.
  box(track(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 24)), pianoBlack, W / 2 + 0.012, -0.05, 0).rotation.z = Math.PI / 2;
  // Left edge: the long action key.
  box(rounded(0.03, 0.18, 0.09, 0.012), black, -W / 2 - 0.012, 0.28, 0);

  group.position.y = -0.12;
  return group;
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
): { group: Group; tick: (time: number) => void } {
  const { track, mat, tex } = ctx;
  const group = new THREE.Group();
  const LENGTH = 0.85;

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
  const wash = cone(0.5, 0.18, led.on, 0.45);
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

  const tick = (time: number) => {
    // The beam breathes — a slow pulse like a scanner cycling.
    const pulse = 0.82 + 0.18 * Math.sin(time * 2.1);
    wash.opacity = 0.45 * pulse;
    mid.opacity = 0.75 * (0.75 + 0.25 * pulse);
    core.opacity = 0.95 * (0.85 + 0.15 * Math.sin(time * 3.7 + 1));
    for (const s of sparks) {
      const t = (s.y0 + time * s.speed) % 1;
      const y = t * LENGTH;
      // Cone widens with height; sparks wander inside it and twinkle.
      const r = (0.06 + (0.5 - 0.06) * t) * s.spread;
      const a = s.phase + time * 0.8;
      s.sprite.position.set(Math.cos(a) * r, y, Math.sin(a) * r * 0.6);
      const fade = Math.sin(t * Math.PI);
      const scale = s.size * (0.6 + 0.6 * fade);
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
    const t = y / 511;
    const vertical = Math.pow(1 - t, 1.4) + 0.08; // keeps a faint tip
    for (let x = 0; x < 128; x++) {
      const edge = Math.sin((x / 127) * Math.PI); // soft round cross-section
      const a = Math.round(255 * vertical * Math.pow(edge, 0.8));
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

/**
 * The screen's UI, drawn once to a 768×1024 canvas: status bar, mon card,
 * four stat chips, the CALL MON bar and the bottom nav — the reference's
 * layout in the H-Lynk palette.
 */
function hudCanvasTexture(THREE: Three): CanvasTexture {
  const W = 768;
  const H = 1024;
  const [canvas, ctx] = canvas2d(W, H);

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
    roundedRect(x, chipY, chipW, chipH, 14);
    ctx.fillStyle = HUD.panel;
    ctx.fill();
    ctx.strokeStyle = HUD.line;
    ctx.lineWidth = 2;
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
  roundedRect(32, 790, W - 64, 86, 43);
  const call = ctx.createLinearGradient(32, 0, W - 32, 0);
  call.addColorStop(0, HUD.redDeep);
  call.addColorStop(1, HUD.red);
  ctx.fillStyle = call;
  ctx.fill();
  ctx.fillStyle = HUD.text;
  ctx.font = font(40, 900);
  ctx.fillText('∿  CALL MON  ›', W / 2, 834);

  // --- bottom nav --------------------------------------------------------------
  const nav: [string, string, boolean][] = [
    ['⌂', 'DEX', false], ['♢', 'CREW', false], ['♥', 'CARE', true], ['▣', 'BAG', false], ['◈', 'CITY', false],
  ];
  const navY = 920;
  const navW = (W - 64) / 5;
  nav.forEach(([icon, label, active], i) => {
    const x = 32 + i * navW;
    roundedRect(x + 8, navY, navW - 16, 84, 16);
    ctx.fillStyle = active ? HUD.red : HUD.panel;
    ctx.fill();
    ctx.strokeStyle = active ? HUD.red : HUD.line;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = HUD.text;
    ctx.font = font(30, 700);
    ctx.fillText(icon, x + navW / 2, navY + 32);
    ctx.font = font(18, 800);
    ctx.fillText(label, x + navW / 2, navY + 62);
  });

  return makeCanvasTexture(THREE, canvas);
}
