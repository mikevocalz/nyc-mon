import { brand, hlynk, led } from '@acme/theme';
import type { ThreeContext, ThreeFrame, ThreeScene } from '@acme/ui';

/** What the stage hands the scene each frame. */
export interface DeviceSceneParams {
  /** `placeholder` is the box model below; `h-lynk-entry` swaps in the real model when it lands. */
  model: 'placeholder' | 'h-lynk-entry';
}

type Three = ThreeContext['THREE'];
type Group = InstanceType<Three['Group']>;
type Material = InstanceType<Three['Material']>;
type Geometry = InstanceType<Three['BufferGeometry']>;

/** Idle yaw swing, radians, and its period, seconds. */
const YAW = 0.32;
const YAW_PERIOD = 9;
/** Pointer tilt cap: 8 degrees (BUILD_PROMPT §5). */
const MAX_TILT = (8 * Math.PI) / 180;
/** Resting three-quarter turn so the side keys and depth read. */
const REST_YAW = -0.38;

const CORE = hlynk.core;

/**
 * The H-Lynk Core placeholder (canon Decision #16): a matte red body at the
 * unit's proportions, a black scanner head across the top with two red
 * emitters and a red fan of light above it, a black stub antenna top-left, a
 * dark bezel round a 3:4 screen, and the bottom control row of black keys
 * either side of a red-ringed square trackpad. Units are body widths.
 *
 * The real model replaces the group built by `buildPlaceholder`; framing,
 * lighting and motion stay.
 */
export function createDeviceScene({ THREE, renderer }: ThreeContext, initial: DeviceSceneParams): ThreeScene<DeviceSceneParams> {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // No tone curve: the body has to stay the measured hlynk.core.body red, not drift to orange.
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.12, 5.4);
  camera.lookAt(0, 0.05, 0);

  const geometries: Geometry[] = [];
  const materials: Material[] = [];
  const track = <G extends Geometry>(g: G) => (geometries.push(g), g);
  const mat = <M extends Material>(m: M) => (materials.push(m), m);

  // Key from the upper left, a cool rim from behind right, soft fill.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1c1e21, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(brand.carolina, 1.6);
  rim.position.set(4, 2, -4);
  scene.add(rim);

  const device = buildPlaceholder(THREE, track, mat);
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
    },
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

function buildPlaceholder(
  THREE: Three,
  track: <G extends Geometry>(g: G) => G,
  mat: <M extends Material>(m: M) => M,
): Group {
  const group = new THREE.Group();
  const W = 1;
  const H = 1.78;
  const D = 0.16;

  const body = mat(new THREE.MeshStandardMaterial({ color: CORE.body, roughness: 0.62, metalness: 0.02 }));
  const black = mat(new THREE.MeshStandardMaterial({ color: CORE.black, roughness: 0.45, metalness: 0.1 }));
  const glass = mat(new THREE.MeshStandardMaterial({ color: brand.night, roughness: 0.22, metalness: 0.2, emissive: brand.royal, emissiveIntensity: 0.04 }));
  const emitter = mat(new THREE.MeshStandardMaterial({ color: led.on, emissive: led.on, emissiveIntensity: 1.4 }));
  const ring = mat(new THREE.MeshStandardMaterial({ color: CORE.ring, emissive: CORE.ring, emissiveIntensity: 0.5, roughness: 0.4 }));
  // The fan fades out as it rises: per-vertex alpha, normal blending so it
  // reads red on a daylit page as well as a night one.
  const fan = mat(
    new THREE.MeshBasicMaterial({ color: led.on, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );

  const box = (w: number, h: number, d: number, m: Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), m);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  const top = H / 2;
  const front = D / 2;

  // Body.
  box(W, H, D, body, 0, 0, 0);
  // Scanner head across the top edge, proud of the body.
  const headH = 0.14;
  const headY = top - headH / 2 - 0.03;
  box(0.86, headH, D + 0.04, black, 0.04, headY, 0);
  // Two red emitters in the head.
  for (const x of [0.2, 0.36]) {
    const lens = new THREE.Mesh(track(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 20)), emitter);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(x, headY, front + 0.03);
    group.add(lens);
  }
  // The red fan of light the scanner projects upward.
  const fanShape = new THREE.Shape();
  fanShape.moveTo(-0.05, 0);
  fanShape.lineTo(0.05, 0);
  fanShape.lineTo(0.42, 0.62);
  fanShape.lineTo(-0.42, 0.62);
  fanShape.closePath();
  const fanGeometry = track(new THREE.ShapeGeometry(fanShape));
  const fanPositions = fanGeometry.getAttribute('position');
  const fanColors = new Float32Array(fanPositions.count * 4);
  for (let i = 0; i < fanPositions.count; i++) {
    fanColors.set([1, 1, 1, 0.5 * (1 - fanPositions.getY(i) / 0.62)], i * 4);
  }
  fanGeometry.setAttribute('color', new THREE.BufferAttribute(fanColors, 4));
  const fanMesh = new THREE.Mesh(fanGeometry, fan);
  fanMesh.position.set(0.28, top, 0);
  group.add(fanMesh);
  // Stub antenna, top left.
  box(0.07, 0.15, 0.07, black, -0.38, top + 0.06, 0);
  // Bezel and the 3:4 screen.
  const screenY = 0.18;
  box(0.86, 1.1, 0.02, black, 0, screenY, front + 0.01);
  box(0.75, 1.0, 0.02, glass, 0, screenY, front + 0.02);
  // Control row: home, menu | trackpad | back, forward.
  const rowY = -0.66;
  for (const x of [-0.39, -0.25, 0.25, 0.39]) box(0.11, 0.11, 0.04, black, x, rowY, front + 0.02);
  box(0.26, 0.26, 0.03, ring, 0, rowY, front + 0.015);
  box(0.22, 0.22, 0.045, black, 0, rowY, front + 0.02);
  // Side keys: volume and power on the right, the action key on the left.
  for (const y of [0.42, 0.26, 0.02]) box(0.03, 0.12, 0.08, black, W / 2 + 0.012, y, 0);
  box(0.03, 0.16, 0.08, black, -W / 2 - 0.012, 0.3, 0);

  group.position.y = -0.12;
  return group;
}
