// The Game world scene: the static Harlem city from world/, the camera that
// orbits its look-at point, and the actors (the Caller first) that live in
// it. The canvas draws on demand; while any actor reports motion the scene
// asks for the next frame itself.
import { VD_LANE, VD_SHADOWS, VD_TONEMAP } from './world/curb.ts';
import type { ThreeContext, ThreeScene } from '@acme/ui/three';
import type { CityDatasetV3 } from './city-dataset.ts';
import type { ActorFrame, SceneActor, SceneActorFactory } from './scene-actor.ts';
import { buildCityWorld } from './world/index.ts';
import { EXPERIMENTAL_WORLD_POST, mountCityPostPipeline, resolvePostOptions } from './post/pipeline.ts';
import { livingCityAdaptiveBridge } from './living-city/adaptive-bridge.ts';
import { EXPERIMENTAL_WORLD_RENDER_SCALE, mountRenderScale } from './perf/render-scale.ts';
import { EXPERIMENTAL_WORLD_THERMAL, thermalSignal, thermalWorsened } from './perf/thermal.ts';
import { TIER, tierBundle, WORLD_TIER, WORLD_TIER_SELECTED } from './perf/tier.ts';
import { parseSkyRigFlag, type SkyName } from './world/sky-rig.ts';
import { FrameSampleWindow } from './perf/frame-sampler.ts';
import {
  DEFAULT_PHYSICAL_PRESET,
  EXPERIMENTAL_WORLD_PHYSICAL,
  isDeviceLaneProbe,
  physicalFeaturesFor,
  WORLD_PROBE,
  type DeviceLaneProbe,
  type PhysicalFeatures,
  type PhysicalPresetId,
  type WorldProbe,
} from './world/physical-look.ts';
import { PHYSICAL_PRESETS } from './world/physical-presets.ts';
import { applyPhysicalShadowRoles, createPhysicalRig, swapInstanceMatricesToStorage, type PhysicalRig } from './world/physical-rig.ts';

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
  /** Time-of-day preset for the physically lit city (world/time-of-day.store.ts); default twilight. */
  preset?: PhysicalPresetId;
}

/** What a device-lane probe (shared, skiatex, pipecache) gets from the scene. */
export interface DeviceLaneProbeContext {
  THREE: ThreeContext['THREE'];
  renderer: NonNullable<ThreeContext['renderer']>;
  scene: ThreeScene<CitySceneParams>['scene'];
  camera: ThreeScene<CitySceneParams>['camera'];
}

/**
 * The shared-device lane registers its Phase 0 probes here. city-scene runs
 * the hook for the active device-lane probe once the scene is built and calls
 * the returned cleanup on dispose.
 */
export const deviceLaneProbeHooks: Partial<Record<DeviceLaneProbe, (context: DeviceLaneProbeContext) => (() => void) | void>> = {};

/** The physical features this build mounts; null is today's path. Exported for tests. */
export function cityPhysicalFeatures(
  physical: boolean = EXPERIMENTAL_WORLD_PHYSICAL,
  probe: WorldProbe | null = WORLD_PROBE,
): PhysicalFeatures | null {
  return physicalFeaturesFor(physical, probe, TIER[WORLD_TIER].physical.ssr !== null);
}

/** Log tag for every Phase 0 probe line. */
const PROBE_LOG = '[NYC-Mon/probe]';

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
  // Slop-grade city: null with EXPO_PUBLIC_WORLD_PHYSICAL and _PROBE unset,
  // and then nothing below differs from the path before this lane.
  const physical = cityPhysicalFeatures();
  const physicalTier = TIER[WORLD_TIER].physical;
  const world = buildCityWorld(THREE, dataset, {
    sky: initial.sky,
    ...(bundle ? { glassTier: bundle.glassTier, envWidth: bundle.envWidth } : {}),
    ...(physical?.pbrMaterials ? { pbr: true, carPbr: true, physical: true } : {}),
  });
  scene.add(world.sky, world.group);
  scene.fog = world.fog;
  // react-native-webgpu renders black through three's output pass, shadow
  // maps and Color backgrounds (metro-live README): linear output, no tone
  // mapping, no shadow maps, and the clear colour as the sky's fallback.
  if (renderer) {
    renderer.outputColorSpace = physical?.srgbOutput ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
    renderer.toneMapping = VD_TONEMAP === 'agx' ? THREE.AgXToneMapping
      : VD_TONEMAP === 'aces' ? THREE.ACESFilmicToneMapping
        : VD_TONEMAP === 'neutral' ? THREE.NeutralToneMapping : THREE.NoToneMapping;
    // AgX compresses highlights and pulls mids down; a lift keeps the palette's daylight read.
    renderer.toneMappingExposure = VD_TONEMAP ? 1.6 : 1;
    renderer.shadowMap.enabled = VD_SHADOWS || (physical !== null && physical.sunShadow > 0);
    renderer.setClearColor(world.horizon, 1);
  }
  // The bgnull probe's failure case. Slop (js/lighting.js): a Color background
  // makes the renderer force a clear that wipes cascade 0 while cascade 1 renders.
  if (physical?.colorBackground) scene.background = new THREE.Color(world.horizon);
  const rig: PhysicalRig | null = physical
    ? createPhysicalRig(THREE, renderer ?? null, scene, {
        features: physical,
        shadowTile: physicalTier.shadowTile,
        clusteredMaxLights: physicalTier.clusteredMaxLights,
        preset: initial.preset ?? DEFAULT_PHYSICAL_PRESET,
      })
    : null;
  if (rig) {
    // The rig's lights and sky replace the world's own, one for one.
    if (rig.sky) world.sky.visible = false;
    world.group.traverse((object) => {
      const light = object as typeof object & { isDirectionalLight?: boolean; isHemisphereLight?: boolean };
      if ((rig.sun && light.isDirectionalLight) || (rig.hemi && light.isHemisphereLight)) object.visible = false;
    });
  }
  // L5 "finishing pass": flagged post stack on the renderer — the mount
  // swaps renderer.render for the RenderPipeline's quad path (post/pipeline.ts).
  // Flag OFF mounts nothing and the direct path stays byte-identical.
  const post = renderer && physical?.pipeline
    ? mountCityPostPipeline(THREE, {
        renderer,
        scene,
        camera,
        options: {},
        physical: {
          mrt: physical.mrt,
          ssr: physical.ssr,
          bloom: physical.bloom,
          grade: physical.grade,
          msaaDiscard: physical.msaaDiscard,
          settings: {
            look: PHYSICAL_PRESETS[rig?.preset ?? DEFAULT_PHYSICAL_PRESET].grade,
            ssr: physicalTier.ssr,
            bloomResolutionScale: physicalTier.bloomResolutionScale,
          },
        },
      })
    : renderer && EXPERIMENTAL_WORLD_POST && physical === null
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
  // The vd lane implies the controller: without it the Duo measured
  // ~16 fps (2026-10-18) — unplayable. An explicit
  // EXPO_PUBLIC_WORLD_RENDER_SCALE=0 still turns it off.
  const renderScaleEnv = process.env.EXPO_PUBLIC_WORLD_RENDER_SCALE;
  const renderScaleOff =
    renderScaleEnv != null && renderScaleEnv.trim() !== '' && !parseSkyRigFlag(renderScaleEnv);
  const renderScale =
    renderer && !renderScaleOff && (EXPERIMENTAL_WORLD_RENDER_SCALE || VD_LANE)
      ? mountRenderScale(renderer, (bundle ?? tierBundle(WORLD_TIER)).scale)
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
    rig?.dispose();
    for (const actor of actors) actor.dispose();
    world.dispose();
    throw error;
  }

  if (physical && physical.sunShadow > 0) applyPhysicalShadowRoles(scene);
  // After the actors joined, so their instanced meshes are swapped too.
  const storageSwapped = renderer && physical?.storage ? swapInstanceMatricesToStorage(THREE, renderer, scene) : 0;
  let probeCleanup: (() => void) | void = undefined;
  if (renderer && isDeviceLaneProbe(WORLD_PROBE)) {
    probeCleanup = deviceLaneProbeHooks[WORLD_PROBE]?.({ THREE, renderer, scene, camera });
  }
  if (WORLD_PROBE !== null) {
    console.info(`${PROBE_LOG} active`, {
      probe: WORLD_PROBE,
      tier: WORLD_TIER,
      features: physical,
      shadowTile: rig?.shadowTile ?? null,
      storageSwapped,
      postWired: post?.physical?.applied ?? null,
      deviceLaneHook: isDeviceLaneProbe(WORLD_PROBE) ? deviceLaneProbeHooks[WORLD_PROBE] !== undefined : null,
    });
  }
  // Probe cadence: the gap between scene updates is the draw cadence on this
  // runtime, and cpuMs is update() alone (JS work, not GPU time). The
  // render/present split comes from EXPO_PUBLIC_GAME_PERF on either runtime.
  const probeWindow = WORLD_PROBE !== null ? new FrameSampleWindow() : null;
  const probeSample = { cpuMs: 0, intervalMs: null as number | null };
  let probeLast = 0;

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
      if (rig) {
        rig.update(camera.position.y, params.camera.x, params.camera.z);
        const preset = params.preset ?? DEFAULT_PHYSICAL_PRESET;
        if (preset !== rig.preset) {
          rig.applyPreset(preset);
          post?.physical?.applyLook(PHYSICAL_PRESETS[preset].grade);
          invalidate?.();
        }
      }
      // Precipitation animates on the shader clock — while rain or snow is
      // live the loop must keep drawing, or the on-demand canvas freezes
      // the weather with the world.
      const precip = world.weather;
      if (moving || (precip !== null && Math.max(precip.wet.value, precip.snow.value) > 0.01)) invalidate?.();
      if (probeWindow) {
        const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
        probeSample.cpuMs = end - now;
        probeSample.intervalMs = probeLast > 0 ? now - probeLast : null;
        probeLast = now;
        const summary = probeWindow.push(probeSample);
        if (summary) {
          console.info(`${PROBE_LOG} ${WORLD_PROBE} scene cadence`, {
            ...summary,
            drawCalls: renderer?.info.render.drawCalls ?? null,
            triangles: renderer?.info.render.triangles ?? null,
          });
        }
      }
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
      probeCleanup?.();
      post?.dispose();
      rig?.dispose();
      for (const actor of actors) actor.dispose();
      world.dispose();
      scene.clear();
    },
  };
}
