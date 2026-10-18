// The Game world scene: the static Harlem city from world/, the camera that
// orbits its look-at point, and the actors (the Caller first) that live in
// it. The canvas draws on demand; while any actor reports motion the scene
// asks for the next frame itself.
import { VD_SHADOWS, VD_TONEMAP } from './world/curb.ts';
import type { ThreeContext, ThreeScene } from '@acme/ui/three';
import type { CityDatasetV3 } from './city-dataset.ts';
import type { ActorFrame, SceneActor, SceneActorFactory } from './scene-actor.ts';
import { buildCityWorld } from './world/index.ts';
import { EXPERIMENTAL_WORLD_POST, mountCityPostPipeline, resolvePostOptions } from './post/pipeline.ts';
import { livingCityAdaptiveBridge } from './living-city/adaptive-bridge.ts';
import { EXPERIMENTAL_WORLD_RENDER_SCALE, mountRenderScale } from './perf/render-scale.ts';
import { EXPERIMENTAL_WORLD_THERMAL, thermalSignal, thermalWorsened } from './perf/thermal.ts';
import { tierBundle, WORLD_TIER, WORLD_TIER_SELECTED } from './perf/tier.ts';
import type { SkyName } from './world/sky-rig.ts';

export interface CityCamera {
  x: number;
  z: number;
  yaw: number;
  distance: number;
}
export interface CitySceneParams {
  dataset: CityDatasetV3;
  camera: CityCamera;
  /** Created once from the first params with the scene's THREE; later changes need a remount, like the dataset. */
  actors?: readonly SceneActorFactory[];
  /** L1 sky pick (morning/dusk/night) — only read when the sky rig flag is on. */
  sky?: SkyName;
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

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  pitch: number;
  distance: number;
}

/**
 * Where the camera sits for a CityCamera. Horizontal offset `distance`
 * behind the target along (sin yaw, cos yaw), height `distance * tan(pitch)`,
 * so from 220 m out it matches the original framing (height 0.8 x distance)
 * that camera-input.ts's pan maths assumes. Pure, for tests; `out` reuses the
 * caller's pose object so the frame loop allocates nothing.
 */
export function cameraPose(value: CityCamera, out: CameraPose = { position: [0, 0, 0], target: [0, 0, 0], pitch: 0, distance: 0 }): CameraPose {
  const distance = Math.max(CAMERA_MIN_DISTANCE, Math.min(CAMERA_MAX_DISTANCE, value.distance));
  const t = smooth(Math.max(0, Math.min(1, (distance - CAMERA_MIN_DISTANCE) / (OVERVIEW_DISTANCE - CAMERA_MIN_DISTANCE))));
  const pitch = CHASE_PITCH + (OVERVIEW_PITCH - CHASE_PITCH) * t;
  const lookY = CHASE_LOOK_HEIGHT * (1 - t);
  out.position[0] = value.x + Math.sin(value.yaw) * distance;
  out.position[1] = lookY + distance * Math.tan(pitch);
  out.position[2] = value.z + Math.cos(value.yaw) * distance;
  out.target[0] = value.x;
  out.target[1] = lookY;
  out.target[2] = value.z;
  out.pitch = pitch;
  out.distance = distance;
  return out;
}

export function createCityScene(context: ThreeContext, initial: CitySceneParams): ThreeScene<CitySceneParams> {
  const { THREE, invalidate, renderer } = context;
  if (![initial.camera.x, initial.camera.z, initial.camera.yaw, initial.camera.distance].every(Number.isFinite)) throw new Error('Invalid city camera');
  // The dataset arrives parsed (city-data.ts runs parseCityDataset once per runtime); only check the shape here.
  const dataset = initial.dataset;
  if (dataset?.version !== 3 || !Array.isArray(dataset.buildings) || !Array.isArray(dataset.roads) || !Array.isArray(dataset.areas)) {
    throw new Error('City scene needs a parsed v3 dataset');
  }
  const featureCount = dataset.buildings.length + dataset.roads.length + dataset.areas.length;
  if (featureCount > MAX_SCENE_FEATURES) throw new Error('City scene feature budget exceeded');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  // L6 "holding frame rate": the tier bundle contributes the option
  // defaults the lower lanes expose (env size, glass tier, post picks)
  // when the selector is set or the render-scale controller is on — with
  // neither, every lane keeps its own defaults (perf/tier.ts).
  const bundle = WORLD_TIER_SELECTED || EXPERIMENTAL_WORLD_RENDER_SCALE ? tierBundle(WORLD_TIER) : null;
  const world = buildCityWorld(THREE, dataset, {
    sky: initial.sky,
    ...(bundle ? { glassTier: bundle.glassTier, envWidth: bundle.envWidth } : {}),
  });
  // With render bundles on, the sky dome records into the bundle (it must
  // draw first and bundles execute before the opaque list) — it is then a
  // child of world.group already (world/index.ts).
  if (world.skyBundled) scene.add(world.group);
  else scene.add(world.sky, world.group);
  scene.fog = world.fog;
  // react-native-webgpu renders black through three's output pass, shadow
  // maps and Color backgrounds (metro-live README): linear output, no tone
  // mapping, no shadow maps, and the clear colour as the sky's fallback.
  if (renderer) {
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.toneMapping = VD_TONEMAP === 'agx' ? THREE.AgXToneMapping
      : VD_TONEMAP === 'aces' ? THREE.ACESFilmicToneMapping
        : VD_TONEMAP === 'neutral' ? THREE.NeutralToneMapping : THREE.NoToneMapping;
    // AgX compresses highlights and pulls mids down; a lift keeps the palette's daylight read.
    renderer.toneMappingExposure = VD_TONEMAP ? 1.6 : 1;
    renderer.shadowMap.enabled = VD_SHADOWS;
    renderer.setClearColor(world.horizon, 1);
  }
  // L5 "finishing pass": flagged post stack on the renderer — the mount
  // swaps renderer.render for the RenderPipeline's quad path (post/pipeline.ts).
  // Flag OFF mounts nothing and the direct path stays byte-identical.
  const post =
    renderer && EXPERIMENTAL_WORLD_POST
      ? mountCityPostPipeline(THREE, {
          renderer,
          scene,
          camera,
          // The bundle's post picks are the base; the per-effect env
          // flags force on over it (resolvePostOptions).
          options: resolvePostOptions(process.env, bundle?.post ?? {}),
        })
      : null;
  // The render-scale controller samples draw pacing from this scene's
  // update clock and steps the drawing buffer through the pixel ratio.
  // It cannot fix the UI-thread/Rive ceiling — GPU-side gains are
  // reported separately on device (perf/render-scale.ts header).
  const renderScale =
    renderer && EXPERIMENTAL_WORLD_RENDER_SCALE && bundle
      ? mountRenderScale(renderer, { band: bundle.scale.band, floor: bundle.scale.floor })
      : null;
  // Last consumed thermalSignal sample — the monitor (perf/thermal.ts,
  // flag-gated) bumps seq on each poll; a move to a worse level forces a
  // render-scale down-step so the tier drops before the device throttles.
  // Seeded from the signal as it stands, so a remount never replays a
  // sample an earlier scene already acted on.
  let thermalSeqSeen = thermalSignal.seq;
  let thermalLevelSeen = thermalSignal.level;
  // The rig's async stage: HDR fetch + PMREM env. It resolves off the build
  // path — the fallback dome already renders, and a landed env invalidates
  // one redraw. Failure (float upload unverified on rn-webgpu) keeps the JSON
  // dome and bakes the env from it.
  if (renderer && world.skyRig) {
    void world.skyRig.attachEnvironment(renderer, scene)
      .then((applied) => {
        if (applied) invalidate?.();
      })
      .catch(() => {
        // Degraded env keeps the fallback dome — the rig never black-frames.
      });
  }

  const actors: SceneActor[] = [];
  try {
    for (const factory of initial.actors ?? []) {
      const actor = factory(THREE);
      actors.push(actor);
      scene.add(actor.object as InstanceType<typeof THREE.Object3D>);
    }
  } catch (error) {
    post?.dispose();
    for (const actor of actors) actor.dispose();
    world.dispose();
    throw error;
  }

  // Per-frame scratch: the pose, the actor frame and the camera write into
  // preallocated objects, so the update loop allocates nothing.
  const pose: CameraPose = { position: [0, 0, 0], target: [0, 0, 0], pitch: 0, distance: 0 };
  const actorFrame: { -readonly [K in keyof ActorFrame]: ActorFrame[K] } = { delta: 0, time: 0, reducedMotion: false };

  function positionCamera(value: CityCamera) {
    if (![value.x, value.z, value.yaw, value.distance].every(Number.isFinite)) throw new Error('Invalid city camera');
    cameraPose(value, pose);
    // No spreads in the frame loop: each would materialise an arguments array.
    camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
    camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);
    // Near and far follow the zoom so depth precision holds from 8 m to 3 km.
    const near = Math.max(0.1, Math.min(5, pose.distance * 0.02));
    const far = Math.max(3000, pose.distance * 6);
    if (camera.near !== near || camera.far !== far) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
    world.setViewDistance(pose.distance, far);
    // After the distance: tree LOD reads it.
    world.setFocus(value.x, value.z);
    world.sky.position.copy(camera.position);
    world.sky.scale.setScalar(far * 0.9);
  }
  positionCamera(initial.camera);

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
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      // Frame pacing for the scale controller: the interval between these
      // calls is the draw cadence — JS submission pacing, not GPU or UI
      // thread time (perf/render-scale.ts header says what it is not).
      renderScale?.frame(now, frame.pixelRatio);
      // PR09: adaptive living-city crowd caps — once the controller has
      // surrendered real fill rate, thin the ambient population one tier
      // (living-city/bundled-host.ts owns the marks; one-way). The bridge
      // stays null unless a flag-gated path evaluated bundled-host.
      if (renderScale) livingCityAdaptiveBridge.frame?.(renderScale.scale);
      // PR5.1: thermal pressure is a forced down-step on the scale
      // controller — the early warning frame pacing would only see too late.
      if (renderScale && EXPERIMENTAL_WORLD_THERMAL && thermalSignal.seq !== thermalSeqSeen) {
        thermalSeqSeen = thermalSignal.seq;
        const worsened = thermalWorsened(thermalLevelSeen, thermalSignal.level);
        thermalLevelSeen = thermalSignal.level;
        if (worsened) {
          renderScale.forceDown(
            now,
            `thermal ${thermalSignal.level} (status ${thermalSignal.status}, headroom ${thermalSignal.headroom ?? 'n/a'})`,
          );
        }
      }
      if (actors.length > 0) {
        let delta = frame.delta > 0 ? frame.delta : 0;
        // A redraw requested by a moving actor: measure the gap ourselves. The first frame after rest moves nothing.
        if (delta === 0 && moving && lastActorTick > 0) delta = Math.min(Math.max((now - lastActorTick) / 1000, 0), 0.1);
        lastActorTick = now;
        actorTime += delta;
        actorFrame.delta = delta;
        actorFrame.time = actorTime;
        actorFrame.reducedMotion = frame.reducedMotion === true;
        let anyMoving = false;
        for (const actor of actors) if (actor.update(actorFrame)) anyMoving = true;
        moving = anyMoving;
      }
      // After the actors: a chase camera reads the Caller's position in this frame's params.
      positionCamera(params.camera);
      // Precipitation animates on the shader clock — while rain or snow is
      // live the loop must keep drawing, or the on-demand canvas freezes
      // the weather with the world.
      const precip = world.weather;
      if (moving || (precip !== null && Math.max(precip.wet.value, precip.snow.value) > 0.01)) invalidate?.();
    },
    resize: (width, height) => {
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      // The canvas just re-stamped the raw device pixel ratio — re-apply the scale.
      renderScale?.resized();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      renderScale?.dispose();
      post?.dispose();
      for (const actor of actors) actor.dispose();
      world.dispose();
      scene.clear();
    },
  };
}
