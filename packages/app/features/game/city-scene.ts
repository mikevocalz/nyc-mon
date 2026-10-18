// The Game world scene: the static Harlem city from world/, the camera that
// orbits its look-at point, and the actors (the Caller first) that live in
// it. The canvas draws on demand; while any actor reports motion the scene
// asks for the next frame itself.
import type { ThreeContext, ThreeScene } from '@acme/ui/three';
import type { CityDatasetV2 } from './city-dataset.ts';
import type { ActorFrame, SceneActor, SceneActorFactory } from './scene-actor.ts';
import { buildCityWorld } from './world/index.ts';
import { createKlippShotRig, type KlippCameraShot } from './camera/klipp-shot-bridge.ts';

export interface CityCamera {
  x: number;
  z: number;
  yaw: number;
  distance: number;
}
export interface CitySceneParams {
  dataset: CityDatasetV2;
  camera: CityCamera;
  /** Optional shot output for the Klipp rig; no change to the saved player camera. */
  cinematicShot?: KlippCameraShot | null;
  /** Created once from the first params with the scene's THREE; later changes need a remount, like the dataset. */
  actors?: readonly SceneActorFactory[];
}

/** Camera distance clamp, metres. The floor is chase range for a 1.8 m Caller. */
export const CAMERA_MIN_DISTANCE = 8;
export const CAMERA_MAX_DISTANCE = 3000;
/** Pitch above the horizon: low behind the Caller, the original overview tilt (atan 0.8) from 220 m out. */
export const CHASE_PITCH = 0.35;
export const OVERVIEW_PITCH = Math.atan(0.8);
export const OVERVIEW_DISTANCE = 220;
/** Close up the camera looks at the Caller's chest, not the ground under their feet. */
const CHASE_LOOK_HEIGHT = 1.2;
/** Feature budget for one tile. Geometry is merged per material, so this bounds build time and memory, not draw calls. */
export const MAX_SCENE_FEATURES = 40_000;

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Where the camera sits for a CityCamera. Horizontal offset `distance`
 * behind the target along (sin yaw, cos yaw), height `distance * tan(pitch)`,
 * so from 220 m out it matches the original framing (height 0.8 x distance)
 * that camera-input.ts's pan maths assumes. Pure, for tests.
 */
export function cameraPose(value: CityCamera): { position: [number, number, number]; target: [number, number, number]; pitch: number; distance: number } {
  const distance = Math.max(CAMERA_MIN_DISTANCE, Math.min(CAMERA_MAX_DISTANCE, value.distance));
  const t = smooth(Math.max(0, Math.min(1, (distance - CAMERA_MIN_DISTANCE) / (OVERVIEW_DISTANCE - CAMERA_MIN_DISTANCE))));
  const pitch = CHASE_PITCH + (OVERVIEW_PITCH - CHASE_PITCH) * t;
  const lookY = CHASE_LOOK_HEIGHT * (1 - t);
  return {
    position: [value.x + Math.sin(value.yaw) * distance, lookY + distance * Math.tan(pitch), value.z + Math.cos(value.yaw) * distance],
    target: [value.x, lookY, value.z],
    pitch,
    distance,
  };
}

export function createCityScene(context: ThreeContext, initial: CitySceneParams): ThreeScene<CitySceneParams> {
  const { THREE, invalidate, renderer } = context;
  if (![initial.camera.x, initial.camera.z, initial.camera.yaw, initial.camera.distance].every(Number.isFinite)) throw new Error('Invalid city camera');
  // The dataset arrives parsed (city-data.ts runs parseCityDataset once per runtime); only check the shape here.
  const dataset = initial.dataset;
  if (dataset?.version !== 2 || !Array.isArray(dataset.buildings) || !Array.isArray(dataset.roads) || !Array.isArray(dataset.areas)) {
    throw new Error('City scene needs a parsed v2 dataset');
  }
  const featureCount = dataset.buildings.length + dataset.roads.length + dataset.areas.length;
  if (featureCount > MAX_SCENE_FEATURES) throw new Error('City scene feature budget exceeded');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  // Klipp owns every write to the camera: `explore` replays the chase pose,
  // `shot` takes over while a cinematic shot is fed, and Klipp blends between
  // them (a cut under reduced motion). Nothing else may move the camera.
  const shots = createKlippShotRig(camera);
  const world = buildCityWorld(THREE, dataset);
  scene.add(world.sky, world.group);
  scene.fog = world.fog;
  // react-native-webgpu renders black through three's output pass, shadow
  // maps and Color backgrounds (metro-live README): linear output, no tone
  // mapping, no shadow maps, and the clear colour as the sky's fallback.
  if (renderer) {
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = false;
    renderer.setClearColor(world.horizon, 1);
  }

  const actors: SceneActor[] = [];
  try {
    for (const factory of initial.actors ?? []) {
      const actor = factory(THREE);
      actors.push(actor);
      scene.add(actor.object as InstanceType<typeof THREE.Object3D>);
    }
  } catch (error) {
    for (const actor of actors) actor.dispose();
    world.dispose();
    throw error;
  }

  /**
   * Feeds the chase pose and this frame's shot to the Klipp rig, then keys
   * LOD, fog and the sky to the blended output — the camera that actually
   * renders — not the chase params. Returns true while a blend still moves.
   */
  function positionCamera(value: CityCamera, cinematicShot: KlippCameraShot | null | undefined, delta: number, reducedMotion: boolean) {
    if (![value.x, value.z, value.yaw, value.distance].every(Number.isFinite)) throw new Error('Invalid city camera');
    const pose = cameraPose(value);
    const near = Math.max(0.1, Math.min(5, pose.distance * 0.02));
    const far = Math.max(3000, pose.distance * 6);
    shots.setChase(pose.position, pose.target, near, far);
    shots.setShot(cinematicShot);
    shots.setReducedMotion(reducedMotion);
    const moving = shots.update(delta);
    const out = shots.shot;
    const focusX = out.hasLookAtTarget ? out.lookAtTarget[0] : camera.position.x;
    const focusZ = out.hasLookAtTarget ? out.lookAtTarget[2] : camera.position.z;
    const viewDistance = out.hasLookAtTarget
      ? Math.hypot(camera.position.x - focusX, camera.position.y - out.lookAtTarget[1], camera.position.z - focusZ)
      : pose.distance;
    world.setViewDistance(viewDistance, camera.far);
    // After the distance: tree LOD reads it.
    world.setFocus(focusX, focusZ);
    world.sky.position.copy(camera.position);
    world.sky.scale.setScalar(camera.far * 0.9);
    return moving;
  }
  positionCamera(initial.camera, initial.cinematicShot, 0, false);

  // The canvas clock stands still while it is paused (on demand), so actors keep their own.
  let actorTime = 0;
  let lastActorTick = 0;
  let moving = false;
  let disposed = false;
  return {
    scene,
    camera,
    update: (frame, params) => {
      if (params.dataset !== initial.dataset) throw new Error('Remount city scene when changing datasets');
      if (actors.length > 0) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        let delta = frame.delta > 0 ? frame.delta : 0;
        // A redraw requested by a moving actor: measure the gap ourselves. The first frame after rest moves nothing.
        if (delta === 0 && moving && lastActorTick > 0) delta = Math.min(Math.max((now - lastActorTick) / 1000, 0), 0.1);
        lastActorTick = now;
        actorTime += delta;
        const actorFrame: ActorFrame = { delta, time: actorTime, reducedMotion: frame.reducedMotion === true };
        let anyMoving = false;
        for (const actor of actors) if (actor.update(actorFrame)) anyMoving = true;
        moving = anyMoving;
      }
      // After the actors: a chase camera reads the Caller's position in this frame's params.
      const cameraMoving = positionCamera(params.camera, params.cinematicShot, frame.delta, frame.reducedMotion === true);
      if (moving || cameraMoving) invalidate?.();
    },
    resize: (width, height) => {
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      // Klipp converts normalised viewOffset to pixels with this size.
      shots.setSize(width, height);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      shots.dispose();
      for (const actor of actors) actor.dispose();
      world.dispose();
      scene.clear();
    },
  };
}
