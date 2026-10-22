import * as THREE from 'three/webgpu';
import { float, length, smoothstep, uv, vec2, vec3 } from 'three/tsl';
import type { ThreeContext, ThreeFrame, ThreeScene } from '../types';
import { EggHatchRig, type EggHatchSource } from './egg-hatch-rig';
import { EggHatchAssetError, EGG_CLIP_PHASES, type EggAttention, type EggHatchPhase } from './hatch-manifest';

/** What HatchEgg3D hands the scene each frame. */
export interface EggHatchSceneParams {
  readonly eggId: string;
  readonly source: EggHatchSource;
  /** null: the egg before the hatch, idling. */
  readonly phase: EggHatchPhase | null;
  /** 0–1 through `phase` to hold that pose; null plays the phase in real time from its start. */
  readonly progress: number | null;
  /** Real-time phase length in seconds; null uses the authored length. */
  readonly phaseSeconds: number | null;
  readonly attention: EggAttention;
  readonly reducedMotion: boolean;
  readonly showProxyBaby: boolean;
  readonly onError: (error: EggHatchAssetError) => void;
  readonly onReady: () => void;
}

/** Where the camera sits relative to the egg, from tooling/blender/hatching/playback (Caller on +Z, slightly right and above). */
const VIEW_DIRECTION = new THREE.Vector3(0.18, 0.14, 0.5).normalize();
const FOV_DEG = 32;
/** Frame the egg's whole hatch footprint with this much margin. */
const FRAME_MARGIN = 1.12;

function asAssetError(error: unknown): EggHatchAssetError {
  return error instanceof EggHatchAssetError ? error : new EggHatchAssetError('parse', String(error), { cause: error });
}

/**
 * The egg hatch scene for ThreeCanvas: one egg GLB from its manifest, posed
 * by EggHatchRig, lit by a hemisphere plus a key and a rim light (three
 * lights, no shadow maps), standing on a soft contact shadow drawn in TSL.
 * The background stays clear so the screen's night scheme shows through.
 * Changing `eggId` swaps rigs; the old one is released to the shared cache.
 */
export function createEggHatchScene({ renderer, invalidate }: ThreeContext, initial: EggHatchSceneParams): ThreeScene<EggHatchSceneParams> {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.005, 10);

  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x1a1410, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(0.4, 1, 0.9);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb4ff, 0.9);
  rim.position.set(-0.6, 0.5, -0.8);
  scene.add(rim);

  const shadowMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  shadowMaterial.colorNode = vec3(0);
  shadowMaterial.opacityNode = smoothstep(float(0.5), float(0.05), length(uv().sub(vec2(0.5)))).mul(0.55);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.0004;
  shadow.renderOrder = -1;
  scene.add(shadow);

  let latest = initial;
  let disposed = false;
  let rig: EggHatchRig | null = null;
  let loadingEggId: string | null = null;
  let aspect = 1;
  const center = new THREE.Vector3(0, 0.06, 0);
  let radius = 0.12;
  /** The params a pose was last applied from; the rig only re-poses when they change. */
  let appliedKey = '';

  const frame = () => {
    const halfV = THREE.MathUtils.degToRad(FOV_DEG / 2);
    const halfH = Math.atan(Math.tan(halfV) * aspect);
    const distance = (radius * FRAME_MARGIN) / Math.sin(Math.min(halfV, halfH));
    camera.aspect = aspect;
    camera.position.copy(center).addScaledVector(VIEW_DIRECTION, distance);
    camera.near = Math.max(0.001, distance - radius * 3);
    camera.far = distance + radius * 3;
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  };

  /** Bounds over the authored phase ends, so shards and the landed Baby stay in frame through the whole hatch. */
  const measure = (next: EggHatchRig) => {
    const box = new THREE.Box3();
    const step = new THREE.Box3();
    for (const phase of [null, ...EGG_CLIP_PHASES] as const) {
      if (phase === null) next.seek('stir', 0);
      else next.seek(phase, 1);
      next.root.updateMatrixWorld(true);
      box.union(step.setFromObject(next.root));
    }
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    center.set(sphere.center.x, Math.max(sphere.center.y, sphere.radius * 0.5), sphere.center.z);
    radius = sphere.radius;
    shadow.scale.setScalar(Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.9);
    shadow.position.x = (box.min.x + box.max.x) / 2;
    shadow.position.z = (box.min.z + box.max.z) / 2;
    frame();
  };

  const load = (params: EggHatchSceneParams) => {
    const eggId = params.eggId;
    loadingEggId = eggId;
    EggHatchRig.create(eggId, params.source).then(
      (next) => {
        if (disposed || loadingEggId !== eggId) {
          next.dispose();
          return;
        }
        rig?.dispose();
        rig = next;
        scene.add(next.root);
        measure(next);
        appliedKey = '';
        latest.onReady();
        invalidate();
      },
      (error: unknown) => {
        if (disposed || loadingEggId !== eggId) return;
        latest.onError(asAssetError(error));
      },
    );
  };

  load(initial);
  frame();

  const sync = (current: EggHatchRig, params: EggHatchSceneParams, reduced: boolean) => {
    current.setProxyBabyVisible(params.showProxyBaby);
    const keyNow = [params.phase, params.progress, params.phaseSeconds, params.attention, reduced].join('|');
    if (keyNow === appliedKey) return false;
    appliedKey = keyNow;
    if (reduced) current.holdPhaseEnd(params.phase, params.attention);
    else if (params.phase === null) current.idle();
    else if (params.progress !== null) current.seek(params.phase, params.progress, params.attention);
    else current.playPhase(params.phase, params.phaseSeconds ?? undefined, params.attention);
    return true;
  };

  return {
    scene,
    camera,
    resize(width, height) {
      aspect = width / Math.max(1, height);
      frame();
    },
    update(time: ThreeFrame, params) {
      latest = params;
      if (params.eggId !== loadingEggId) load(params);
      const current = rig;
      if (!current || loadingEggId !== params.eggId) return;
      const reduced = params.reducedMotion || time.reducedMotion;
      const changed = sync(current, params, reduced);
      if (!changed && !reduced) current.update(time.delta);
    },
    dispose() {
      disposed = true;
      rig?.dispose();
      rig = null;
      shadow.geometry.dispose();
      shadowMaterial.dispose();
    },
  };
}
