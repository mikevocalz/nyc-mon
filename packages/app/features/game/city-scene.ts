import { createSourceTemplateCompiler } from './source-template-compiler.ts';
import { createSceneBuildProgress } from './scene-build-progress.ts';
import { awaitPreparationAssets, finishPreparation, runPreparation } from './scene-preparation.ts';
// The Game world scene: the static Harlem city from world/, the camera that
// orbits its look-at point, and the actors (the Caller first) that live in
// it. The canvas draws on demand; while any actor reports motion the scene
// asks for the next frame itself.
import { VD_LANE, VD_SHADOWS, VD_TONEMAP } from './world/curb.ts';
import type { ThreeContext, ThreeScene } from '@acme/ui/three';
import type { PerspectiveCamera, Vector3 } from 'three/webgpu';
import type { CityDatasetV3 } from './city-dataset.ts';
import type { ActorFrame, SceneActor, SceneActorFactory } from './scene-actor.ts';
import { prepareCityWorld } from './world/index.ts';
import { createKlippShotRig, type KlippCameraShot } from './camera/klipp-shot-bridge.ts';
import { shadowSafeCasters } from './world/vd-port/shared/shadow-safe.ts';
import { cityCompilePass, restoreCompileForFrame, type CompilePass } from './compile-pass.ts';
import { EXPERIMENTAL_WORLD_POST, mountCityPostPipeline, resolvePostOptions } from './post/pipeline.ts';
import { livingCityAdaptiveBridge } from './living-city/adaptive-bridge.ts';
import { EXPERIMENTAL_WORLD_RENDER_SCALE, mountRenderScale } from './perf/render-scale.ts';
import { EXPERIMENTAL_WORLD_THERMAL, thermalSignal, thermalWorsened } from './perf/thermal.ts';
import { TIER, tierBundle, WORLD_TIER, WORLD_TIER_SELECTED } from './perf/tier.ts';
import { adaptiveFrameBridge, createAdaptiveTierController, EXPERIMENTAL_WORLD_ADAPTIVE } from './perf/adaptive-tiers.ts';
import { detectWorldPreset, screenErrorScale, WORLD_PRESETS, WORLD_PRESET_SELECTED, worldStreamEnabled } from './perf/tier-presets.ts';
import type { CellStreamStats } from './world/cells/cell-stream.ts';
import { parseSkyRigFlag, type SkyName } from './world/sky-rig.ts';
import { FrameSampleWindow } from './perf/frame-sampler.ts';
import {
  DEFAULT_PHYSICAL_PRESET,
  EXPERIMENTAL_WORLD_PHYSICAL,
  isDeviceLaneProbe,
  physicalFeaturesFor,
  WORLD_PROBE,
  WORLD_SHADOW_INTERVAL,
  WORLD_SHADOW_INTERVAL_SELECTED,
  type DeviceLaneProbe,
  type PhysicalFeatures,
  type PhysicalPresetId,
  type WorldProbe,
} from './world/physical-look.ts';
import { PHYSICAL_PRESETS } from './world/physical-presets.ts';
import type { PhysicalRig } from './world/physical-rig.ts';
import { loadPhysicalRig } from './physical-graph.ts';
import { backendUploaded, createUploadedReleaser, RELEASE_UPLOADED } from './world/release-uploaded.ts';
import { applyReversedDepthOffsets } from './world/reversed-depth-offset.ts';
import { createFloatingOrigin, updateFloatingOrigin } from './world/floating-origin.ts';
import { setRenderOrigin } from './world/render-space.ts';
import { CELL } from './world/cells/cell-rules.ts';
import { cameraPose, type CameraPose } from './city-camera-pose.ts';
import { residentSourceBlocked, residentCollisionRevision, residentCollisionStats } from './resident-collision.ts';
import { createSourceHeightFrame } from './world/vd-port/blocks/source-height-frame.ts';
import { authoredBuildingBlocked } from './world/vd-port/blocks/building-colliders.ts';
import { CAMERA_CLEARANCE, createCameraBlocker, createChaseCameraConstraint } from './camera-collision.ts';

/** Night-light ranking requires a unit horizontal forward even for quaternion-only or vertical shots. */
export function nightLightForward(camera: PerspectiveCamera, dx: number, dz: number, out: Vector3): Vector3 {
  let length = Math.hypot(dx, dz);
  if (!(length > 1e-6)) {
    camera.getWorldDirection(out);
    dx = out.x;
    dz = out.z;
    length = Math.hypot(dx, dz);
  }
  if (!(length > 1e-6)) return out.set(0, 0, -1);
  return out.set(dx / length, 0, dz / length);
}

export interface CityCamera {
  x: number;
  z: number;
  yaw: number;
  distance: number;
}
export interface CitySceneParams {
  dataset: CityDatasetV3;
  camera: CityCamera;
  /** Optional shot output for the Klipp rig; no change to the saved player camera. */
  cinematicShot?: KlippCameraShot | null;
  /** Created once from the first params with the scene's THREE; later changes need a remount, like the dataset. */
  actors?: readonly SceneActorFactory[];
  /** L1 sky pick (morning/dusk/night) — only read when the sky rig flag is on. */
  sky?: SkyName;
  /** Time-of-day preset for the physically lit city (world/time-of-day.store.ts); default twilight. */
  preset?: PhysicalPresetId;
  /** World build progress, 0..1 (world/index.ts CityWorldOptions.onProgress); load-game-scene.ts feeds the load bar. */
  onBuildProgress?: (fraction: number) => void;
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

/** The physical features this build mounts; null is today's path, including a probe without the master flag. Exported for tests. */
export function cityPhysicalFeatures(
  physical: boolean = EXPERIMENTAL_WORLD_PHYSICAL,
  probe: WorldProbe | null = WORLD_PROBE,
): PhysicalFeatures | null {
  return physicalFeaturesFor(physical, probe, TIER[WORLD_TIER].physical.ssr !== null);
}

/** Log tag for every Phase 0 probe line. */
const PROBE_LOG = '[NYC-Mon/probe]';
/** Streaming stage timing (EXPO_PUBLIC_GAME_PERF=1): cells resident, bytes, build ms per cell, evictions. */
const STREAM_LOG = '[NYC-Mon/stream]';
const GAME_PERF = process.env.EXPO_PUBLIC_GAME_PERF === '1';
/**
 * The START set's radius as a share of the preset's resident radius: the cells nearest the first frame's camera are
 * built with the scene, the rest stream in over the next frames, nearest first and fading in.
 */
export const STREAM_START_SHARE = 0.5;

/** The streamer's live counts by scene, for tests and probes; absent for a scene built without streaming. */
export const cityStreamStats = new WeakMap<object, Readonly<CellStreamStats>>();

/** Feature budget for one tile. Geometry is merged per material, so this bounds build time and memory, not draw calls. */
export const MAX_SCENE_FEATURES = 40_000;

// The pose maths lives in city-camera-pose.ts (pure) so the website's walk projects through the same numbers.
export {
  CAMERA_MAX_DISTANCE,
  CAMERA_MIN_DISTANCE,
  cameraPose,
  CHASE_PITCH,
  OVERVIEW_DISTANCE,
  OVERVIEW_PITCH,
  type CameraPose,
} from './city-camera-pose.ts';

export function createCityScene(context: ThreeContext, initial: CitySceneParams): ThreeScene<CitySceneParams> {
  return finishPreparation(prepareCityScene(context, initial));
}

/** JS-thread preparation yields completed world phases; render-runtime callers retain createCityScene. */
export async function createCitySceneAsync(context: ThreeContext, initial: CitySceneParams): Promise<ThreeScene<CitySceneParams>> {
  const prepared = await runPreparation(prepareCityScene(context, initial), context.signal);
  return awaitPreparationAssets(prepared, context.signal);
}

type PreparedCityScene = ThreeScene<CitySceneParams> & { ready?: Promise<void>; finishAssets?(): void };

function* prepareCityScene(context: ThreeContext, initial: CitySceneParams): Generator<number, PreparedCityScene, void> {
  const { THREE, invalidate, renderer } = context;
  const buildProgress = createSceneBuildProgress(initial.onBuildProgress, context.signal);
  // r187 upstreamed the shadow-pass alphaTest bypass (world/shadow-pass-alpha.test.ts pins it).
  if (![initial.camera.x, initial.camera.z, initial.camera.yaw, initial.camera.distance].every(Number.isFinite)) throw new Error('Invalid city camera');
  // The dataset arrives parsed (city-data.ts runs parseCityDataset once per runtime); only check the shape here.
  const dataset = initial.dataset;
  if (dataset?.version !== 3 || !Array.isArray(dataset.buildings) || !Array.isArray(dataset.roads) || !Array.isArray(dataset.areas)) {
    throw new Error('City scene needs a parsed v3 dataset');
  }
  const featureCount = dataset.buildings.length + dataset.roads.length + dataset.areas.length;
  if (featureCount > MAX_SCENE_FEATURES) throw new Error('City scene feature budget exceeded');
  const mappedCameraBlocked = createCameraBlocker(dataset.buildings);
  const constrainCamera = createChaseCameraConstraint((x, y, z, radius) =>
    mappedCameraBlocked(x, y, z, radius) || authoredBuildingBlocked(x, y, z, radius) || residentSourceBlocked(x, y, z, radius), residentCollisionRevision);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  const origin = createFloatingOrigin();
  updateFloatingOrigin(origin, initial.camera.x, initial.camera.z);
  const renderRoot = new THREE.Group();
  renderRoot.position.set(-origin.cx * CELL, 0, -origin.cz * CELL);
  renderRoot.updateMatrix();
  renderRoot.matrixAutoUpdate = false;
  scene.add(renderRoot);
  setRenderOrigin(scene, origin.cx * CELL, 0, origin.cz * CELL);
  // L6 "holding frame rate": the tier bundle contributes the option
  // defaults the lower lanes expose (env size, glass tier, post picks)
  // when the selector is set or the render-scale controller is on — with
  // neither, every lane keeps its own defaults (perf/tier.ts).
  const bundle = WORLD_TIER_SELECTED || EXPERIMENTAL_WORLD_RENDER_SCALE ? tierBundle(WORLD_TIER) : null;
  // Slop-grade city: null with EXPO_PUBLIC_WORLD_PHYSICAL unset (a probe
  // alone mounts nothing), and then nothing below differs from the path
  // before this lane.
  const physical = cityPhysicalFeatures();
  // The streaming and budget preset (perf/tier-presets.ts), from the canvas's logical size; an unsized canvas takes
  // the conservative iPad row. Its shadow tile and bloom scale cap the world tier row's.
  const logical = renderer?.getSize(new THREE.Vector2()) ?? null;
  const preset = logical && logical.x > 0 && logical.y > 0
    ? detectWorldPreset({ width: logical.x, height: logical.y })
    : detectWorldPreset({ width: 1366, height: 1024 });
  const tierRow = TIER[WORLD_TIER].physical;
  const physicalTier = {
    ...tierRow,
    shadowTile: Math.min(tierRow.shadowTile, preset.shadowTile),
    bloomResolutionScale: Math.min(tierRow.bloomResolutionScale, preset.bloomResolutionScale),
  };
  const streamLog = GAME_PERF ? (line: string, data: Record<string, unknown>) => console.info(`${STREAM_LOG} ${line}`, data) : undefined;
  const world = yield* prepareCityWorld(THREE, dataset, {
    sky: initial.sky,
    ...(renderer ? { hasTextureFeature: (name: string) => renderer.hasFeature(name) } : {}),
    onProgress: buildProgress.cpu,
    onAssetProgress: buildProgress.asset,
    ...(bundle ? { glassTier: bundle.glassTier, envWidth: bundle.envWidth } : {}),
    ...(physical?.pbrMaterials ? { pbr: true, carPbr: true, physical: true } : {}),
    // Pooled PointLights only where ClusteredLighting clusters them (physical-rig.ts).
    ...(physical?.pbrMaterials && physical.clustered
      ? { nightLights: { streetlamps: physicalTier.streetlampLights, storefronts: physicalTier.storefrontLights } }
      : {}),
    ...(worldStreamEnabled(physical !== null) ? { stream: { preset, log: streamLog, wake: invalidate } } : {}),
  });
  const owned: (() => void | Promise<void>)[] = [() => { scene.clear(); }, () => world.dispose()];
  let delivered = false;
  let disposed = false;
  let sourceCompiler: ReturnType<typeof createSourceTemplateCompiler> | undefined;
  let disposal: Promise<void> | undefined;
  const disposeScene = () => {
    if (disposed) return disposal;
    disposed = true;
    buildProgress.dispose();
    const cleanup = () => {
      let pending: Promise<void> | undefined;
      const failed = (error: unknown) => { console.warn('[city-scene] resource cleanup failed', error); };
      for (const release of owned.reverse()) {
        if (pending) { pending = pending.then(release).catch(failed); continue; }
        try { const result = release(); if (result) pending = result.catch(failed); } catch (error) { failed(error); }
      }
      return pending;
    };
    const drain = sourceCompiler?.dispose();
    if (drain) { disposal = drain.then(cleanup); return disposal; }
    const result = cleanup();
    if (result) { disposal = result; return disposal; }
  };
  try {
    // Klipp owns camera orientation/lens and blends authored shots with the
    // unobstructed chase pose. Register it before subsequent scene allocation.
    const shots = createKlippShotRig(camera);
    owned.push(() => shots.dispose());
    renderRoot.add(world.sky, world.group);
    scene.fog = world.fog;
    // react-native-webgpu renders black through three's output pass, shadow
    // maps and Color backgrounds (metro-live README): linear output, no tone
    // mapping, no shadow maps, and the clear colour as the sky's fallback.
    // With the physical stack on, its RenderPipeline owns tone mapping (ACES,
    // exposure from the grade) and the vd lane's direct AgX x1.6 stays off:
    // stacked on the physical bloom it blew the facades out.
    const vdTonemap = physical ? '' : VD_TONEMAP;
    if (renderer) {
      renderer.outputColorSpace = physical?.srgbOutput ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
      renderer.toneMapping = vdTonemap === 'agx' ? THREE.AgXToneMapping
        : vdTonemap === 'aces' ? THREE.ACESFilmicToneMapping
          : vdTonemap === 'neutral' ? THREE.NeutralToneMapping : THREE.NoToneMapping;
      // AgX compresses highlights and pulls mids down; a lift keeps the palette's daylight read.
      renderer.toneMappingExposure = vdTonemap ? 1.6 : 1;
      renderer.shadowMap.enabled = VD_SHADOWS || (physical !== null && physical.sunShadow > 0);
      renderer.setClearColor(world.horizon, 1);
    }
    // The bgnull probe's failure case. Slop (js/lighting.js): a Color background
    // makes the renderer force a clear that wipes cascade 0 while cascade 1 renders.
    if (physical?.colorBackground) scene.background = new THREE.Color(world.horizon);
    // The rig module (SkyMesh, SunLight, ClusteredLighting) is evaluated only here, flag on.
    const rigModule = physical ? loadPhysicalRig() : null;
    const rig: PhysicalRig | null = physical && rigModule
      ? rigModule.createPhysicalRig(THREE, renderer ?? null, scene, {
          features: physical,
          shadowTile: physicalTier.shadowTile,
          clusteredMaxLights: physicalTier.clusteredMaxLights,
          preset: initial.preset ?? DEFAULT_PHYSICAL_PRESET,
          shadowInterval: WORLD_SHADOW_INTERVAL,
          wake: invalidate,
        })
      : null;
    if (rig) { owned.push(() => rig.dispose()); world.applySourceLook(rig.sourceLook); }
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
    let renderedDelta = 0;
    const sourceWeatherFrame = {rain:0,snow:0};
    const sourceHazeFrame = {origin:[0,0,0] as [number,number,number],sourceYOffset:0};
    const sourceHeightOffset = createSourceHeightFrame();
    const post = renderer && physical?.pipeline
      ? mountCityPostPipeline(THREE, {
          renderer,
          scene,
          camera,
          options: {},
          wake: invalidate,
          afterRender: () => { rig?.afterRender(camera, renderedDelta); },
          physical: {
            ...(rig ? { sourceLook: rig.sourceLook } : {}),
            mrt: physical.mrt,
            ssr: physical.ssr,
            bloom: physical.bloom,
            grade: physical.grade,
            msaaDiscard: physical.msaaDiscard,
            upscale: physical.upscale,
            upscaleScale: preset.upscaleScale,
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
    if (post) owned.push(() => post.dispose());
    if (rig && post?.physical) rig.setSourceHazeActive(true);
    if (post) cityCompilePass.set(scene, post.scenePass as unknown as CompilePass);
    // The render-scale controller samples draw pacing from this scene's
    // update clock and steps the drawing buffer through the pixel ratio.
    // It cannot fix the UI-thread/Rive ceiling — GPU-side gains are
    // reported separately on device (perf/render-scale.ts header).
    // The vd lane implies the controller on the direct path: without it the
    // Duo measured ~16 fps (2026-10-18) — unplayable. Under the physical stack
    // the pipeline sizes its own targets, so the vd lane leaves the physical
    // path's scale as it was. An explicit EXPO_PUBLIC_WORLD_RENDER_SCALE=0
    // still turns it off.
    //
    // The upscale slot and the pixel-ratio scale path are mutually exclusive
    // mechanisms (upscaling-eval §4): under EXPO_PUBLIC_WORLD_UPSCALE the
    // dynamic knob is the scene pass's setResolutionScale — input-only, so
    // the output buffer (and TAAU's history targets) stays fixed — and the
    // controller must never drive setPixelRatio. The adapter's base ratio is
    // 1, so `base × scale` lands on the pass as the bare scale.
    const upscalePass = physical?.upscale != null ? (post?.scenePass ?? null) : null;
    const renderScaleEnv = process.env.EXPO_PUBLIC_WORLD_RENDER_SCALE;
    const renderScaleOff =
      renderScaleEnv != null && renderScaleEnv.trim() !== '' && !parseSkyRigFlag(renderScaleEnv);
    const renderScale =
      renderer && !renderScaleOff && (EXPERIMENTAL_WORLD_RENDER_SCALE || (VD_LANE && physical === null))
        ? upscalePass
          ? mountRenderScale(
              {
                getPixelRatio: () => 1,
                setPixelRatio: (v: number) => upscalePass.setResolutionScale(v),
              },
              { ...(bundle ?? tierBundle(WORLD_TIER)).scale, startScale: upscalePass.getResolutionScale() },
            )
          : mountRenderScale(renderer, (bundle ?? tierBundle(WORLD_TIER)).scale)
        : null;
    if (renderScale) owned.push(() => renderScale.dispose());
    if (renderScale && upscalePass) {
      console.info(
        '[NYC-Mon/perf] render scale drives the scene pass setResolutionScale — EXPO_PUBLIC_WORLD_UPSCALE owns the output buffer',
      );
    }
    // Phase 6 (PR 6): adaptive quality tiers — the closed frame reports the
    // probe channel already produces step the streaming preset row, the sun
    // shadow interval and the scale channel down and back
    // (perf/adaptive-tiers.ts, EXPO_PUBLIC_WORLD_ADAPTIVE). Explicit picks
    // beat it: an env-pinned preset keeps its row, an env-pinned shadow
    // interval its refresh, and an armed render-scale controller owns the
    // scale channel outright — two controllers on one channel would fight.
    let adaptiveScaleFactor = 1;
    let adaptiveBaseRatio = renderer?.getPixelRatio() ?? 1;
    const adaptive = EXPERIMENTAL_WORLD_ADAPTIVE
      ? createAdaptiveTierController({
          startPreset: preset.name,
          scaleChannel: upscalePass ? 'upscaleScale' : 'renderScale',
          startScale: upscalePass?.getResolutionScale() ?? 1,
          tier: WORLD_PRESET_SELECTED === null && world.stream !== null,
          shadowInterval: !WORLD_SHADOW_INTERVAL_SELECTED && rig?.sun != null,
          scale: renderScale === null,
          // The upscale slot starts at 0.5 input — the pixel-ratio floor would
          // clamp every step; half the eval's start is the provisional bottom.
          scaleFloor: upscalePass ? 0.25 : undefined,
          apply: (action) => {
            switch (action.kind) {
              case 'tier':
                world.stream?.setPreset(WORLD_PRESETS[action.to]);
                break;
              case 'shadowInterval':
                rig?.setShadowInterval(action.to);
                break;
              case 'upscaleScale':
                upscalePass?.setResolutionScale(action.to);
                break;
              case 'renderScale':
                adaptiveScaleFactor = action.to;
                renderer?.setPixelRatio(adaptiveBaseRatio * adaptiveScaleFactor);
                break;
            }
          },
        })
      : null;
    if (adaptive) adaptiveFrameBridge.push = adaptive.push;
    owned.push(() => {
      if (adaptive && adaptiveFrameBridge.push === adaptive.push) adaptiveFrameBridge.push = null;
      if (adaptive && !upscalePass && adaptiveScaleFactor !== 1) renderer?.setPixelRatio(adaptiveBaseRatio);
    });
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
    for (const factory of initial.actors ?? []) {
      const actor = factory(THREE);
      owned.push(() => actor.dispose());
      actors.push(actor);
      (actor.coordinateSpace === 'render' ? scene : renderRoot).add(actor.object as InstanceType<typeof THREE.Object3D>);
    }

    if (rigModule && physical && physical.sunShadow > 0) {
      rigModule.applyPhysicalShadowRoles(scene);
      // one shadow program per mask, side and layout, not one per colour graph (world/vd-port/shared/shadow-safe.ts)
      shadowSafeCasters(THREE, scene);
    }
    // Ground-layer polygon offsets point toward the camera only on a standard depth buffer (world/reversed-depth-offset.ts).
    applyReversedDepthOffsets(scene, renderer as { reversedDepthBuffer?: boolean } | null | undefined);
    // After the actors joined, so their instanced meshes are swapped too.
    const storageSwapped = rigModule && renderer && physical?.storage ? rigModule.swapInstanceMatricesToStorage(THREE, renderer, scene) : 0;
    if (rigModule && renderer && storageSwapped > 0) owned.push(() => { rigModule.releaseStorageInstanceMatrices(renderer, scene); });
    let probeCleanup: (() => void) | void = undefined;
    if (renderer && isDeviceLaneProbe(WORLD_PROBE)) {
      probeCleanup = deviceLaneProbeHooks[WORLD_PROBE]?.({ THREE, renderer, scene, camera });
    }
    if (probeCleanup) owned.push(probeCleanup);
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
    // Screen-error scale K = drawing-buffer height / (2 tan(fov / 2)), re-read each frame (the render-scale
    // controller moves the ratio).
    const drawingBuffer = new THREE.Vector2();
    const errorScale = () => {
      const h = renderer ? renderer.getDrawingBufferSize(drawingBuffer).y : 0;
      return screenErrorScale(h > 0 ? h : 1536, camera.fov);
    };
    // Probe cadence: the gap between scene updates is the draw cadence on this
    // runtime, and cpuMs is update() alone (JS work, not GPU time). The
    // render/present split comes from EXPO_PUBLIC_GAME_PERF on either runtime.
    const probeWindow = WORLD_PROBE !== null ? new FrameSampleWindow() : null;
    const probeSample = { cpuMs: 0, intervalMs: null as number | null };
    let probeLast = 0;

    // Per-frame scratch: the pose, the actor frame and the camera write into
    // preallocated objects, so the update loop allocates nothing.
    const pose: CameraPose = { position: [0, 0, 0], target: [0, 0, 0], pitch: 0, distance: 0 };
    const actorFrame: { -readonly [K in keyof ActorFrame]: ActorFrame[K] } = { delta: 0, time: 0, reducedMotion: false, originX: origin.cx * CELL, originZ: origin.cz * CELL, originChanged: false };
    const streamCamera = { x: 0, y: 0, z: 0 };
    const nightForward = new THREE.Vector3();
    let lastOriginChanged = true;
    const cameraProbeDesired = GAME_PERF ? new Float64Array(3) : null;
    let cameraProbeAt = -Infinity, cameraProbeCount = 0;

    function positionCamera(value: CityCamera, cinematicShot: KlippCameraShot | null | undefined, delta: number, reducedMotion: boolean) {
      if (![value.x, value.z, value.yaw, value.distance].every(Number.isFinite)) throw new Error('Invalid city camera');
      cameraPose(value, pose);
      cameraProbeDesired?.set(pose.position);
      const desiredNear = Math.max(0.1, Math.min(5, pose.distance * 0.02));
      const nearPlaneRadius = desiredNear * Math.hypot(1, Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
      constrainCamera(pose, Math.max(CAMERA_CLEARANCE, nearPlaneRadius));
      const ox = origin.cx * CELL, oz = origin.cz * CELL;
      // Chase clipping follows the unobstructed eye while the saved distance
      // remains the player's requested orbit. Authored shots keep their lens.
      const eyeDistance = Math.hypot(pose.position[0] - pose.target[0], pose.position[2] - pose.target[2]);
      const near = Math.max(0.1, Math.min(5, eyeDistance * 0.02));
      const far = Math.max(3000, pose.distance * 6);
      shots.setChase(pose.position, pose.target, near, far);
      shots.setShot(cinematicShot);
      shots.setReducedMotion(reducedMotion);
      const moving = shots.update(delta);
      const out = shots.shot;
      const focusX = out.hasLookAtTarget ? out.lookAtTarget[0] : out.position[0];
      const focusZ = out.hasLookAtTarget ? out.lookAtTarget[2] : out.position[2];
      const viewDistance = out.hasLookAtTarget
        ? Math.hypot(out.position[0] - focusX, out.position[1] - out.lookAtTarget[1], out.position[2] - focusZ)
        : pose.distance;
      world.setViewDistance(viewDistance, camera.far);
      // After the distance: tree LOD reads it.
      world.setFocus(focusX, focusZ, ox, oz, lastOriginChanged);
      world.sky.position.set(out.position[0], out.position[1], out.position[2]);
      world.sky.scale.setScalar(camera.far * 0.9);
      // The rig and streaming retain world metres; only rendered position
      // shifts into the shared floating origin. Klipp already wrote rotation.
      streamCamera.x = out.position[0];
      streamCamera.y = out.position[1];
      streamCamera.z = out.position[2];
      camera.position.set(out.position[0] - ox, out.position[1], out.position[2] - oz);
      if (GAME_PERF && cameraProbeCount < 120) {
        const now = performance.now();
        if (now - cameraProbeAt >= 500) {
          cameraProbeAt = now; cameraProbeCount++;
          console.info('[NYC-Mon/camera] render pose', {
            version: 'resident-triangle-orbit-v3', phase: 'afterSceneUpdate-beforeRenderer', sequence: cameraProbeCount,
            requested: value, desiredEye: Array.from(cameraProbeDesired!),
            constrainedEye: [...pose.position], chaseTarget: [...pose.target],
            finalEye: [...out.position], finalTarget: out.hasLookAtTarget ? [...out.lookAtTarget] : null,
            finalQuaternion: [...out.quaternion], cameraEye: camera.position.toArray(), cameraQuaternion: camera.quaternion.toArray(),
            matrixAutoUpdate: camera.matrixAutoUpdate, matrixWorldAutoUpdate: camera.matrixWorldAutoUpdate,
            matrixWorld: [...camera.matrixWorld.elements], viewMatrix: [...camera.matrixWorldInverse.elements], projectionMatrix: [...camera.projectionMatrix.elements],
            cameraUuid: camera.uuid,
            origin: [ox, oz], cinematic: cinematicShot != null,
            collision: residentCollisionStats(),
            eyeBlocked: mappedCameraBlocked(out.position[0], out.position[1], out.position[2], CAMERA_CLEARANCE) ||
              authoredBuildingBlocked(out.position[0], out.position[1], out.position[2], CAMERA_CLEARANCE) ||
              residentSourceBlocked(out.position[0], out.position[1], out.position[2], CAMERA_CLEARANCE),
          });
        }
      }
      return moving;
    }
    positionCamera(initial.camera, initial.cinematicShot, 0, false);
    // The START set, after every scene pass above (shadow roles, depth offsets) has reached the layer templates.
    camera.updateMatrixWorld();
    sourceCompiler = createSourceTemplateCompiler(THREE, renderer, scene, camera, post?.scenePass ?? null,
      () => rig?.sourceProbePreparation ? [rig.sourceProbePreparation] : [], buildProgress.compile);
    world.setPrepareTemplates(sourceCompiler.prepare);
    world.primeStream(streamCamera, errorScale(), preset.residentRadiusM * STREAM_START_SHARE);
    if (world.stream) cityStreamStats.set(scene, world.stream.stats);
    if (streamLog && world.stream) {
      streamLog('preset', { preset: preset.name, stream: true, radius: preset.residentRadiusM, k: Math.round(errorScale()) });
    }
    let streamLogAt = 0;

    // The canvas clock stands still while it is paused (on demand), so actors keep their own.
    let actorTime = 0;
    let lastActorTick = 0;
    let moving = false;
    // Opt-in (EXPO_PUBLIC_WORLD_RELEASE_UPLOADED=1; off by default since the
    // iPad's START failed with it on, world/release-uploaded.ts): static world
    // geometry and data-texture pixels leave the CPU once the GPU has held them
    // for RELEASE_SETTLE_FRAMES frames. Each update checks what earlier frames
    // uploaded; once nothing is pending the check costs nothing.
    const releaser = renderer && RELEASE_UPLOADED ? createUploadedReleaser(world.group) : null;
    const uploaded = renderer && releaser ? backendUploaded(renderer) : null;
    const prepared: PreparedCityScene = {
      ready: Promise.resolve(world.ready).then(async () => {
        await sourceCompiler?.prepareScene(context.signal ?? new AbortController().signal);
        // compileAsync has already copied these immutable vertex buffers. Free their CPU
        // copies before compiling the main pass; texture placeholders do not qualify.
        if (renderer && RELEASE_UPLOADED) {
          const preparedGeometry = createUploadedReleaser(world.group, { settleFrames: 1, textures: false });
          const bytes = preparedGeometry.release(backendUploaded(renderer));
          streamLog?.('prepared-geometry-released', { bytes });
        }
      }),
      finishAssets: () => {
        if (world.ready) world.primeStream(streamCamera, errorScale(), preset.residentRadiusM * STREAM_START_SHARE);
        buildProgress.finish();
      },
      scene,
      camera,
      update: (frame, params) => {
        restoreCompileForFrame(scene);
        sourceCompiler?.beforeFrame();
        if (params.dataset !== initial.dataset) throw new Error('Remount city scene when changing datasets');
        if (releaser && uploaded && releaser.pending > 0) releaser.release(uploaded);
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        // Frame pacing for the scale controller: the interval between these
        // calls is the draw cadence — JS submission pacing, not GPU or UI
        // thread time (perf/render-scale.ts header says what it is not).
        // Under the upscale slot the adapter's base ratio is 1, so the
        // controller's output lands on setResolutionScale as the bare scale.
        renderScale?.frame(now, upscalePass ? 1 : frame.pixelRatio);
        // The adaptive controller's render-scale channel: the canvas's
        // applySize re-stamps the raw device ratio on resize, so re-assert the
        // adaptive scale each frame the way mountRenderScale does (three
        // early-returns when unchanged). The upscale slot's pass keeps its own
        // resolution scale — it needs no per-frame assert.
        if (adaptive) {
          adaptiveBaseRatio = upscalePass ? 1 : frame.pixelRatio;
          if (!upscalePass && adaptiveScaleFactor !== 1) {
            renderer?.setPixelRatio(adaptiveBaseRatio * adaptiveScaleFactor);
          }
        }
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
        const originChanged = updateFloatingOrigin(origin, params.camera.x, params.camera.z);
        lastOriginChanged = originChanged;
        if (originChanged) {
          renderRoot.position.set(-origin.cx * CELL, 0, -origin.cz * CELL);
          renderRoot.updateMatrix();
          setRenderOrigin(scene, origin.cx * CELL, 0, origin.cz * CELL);
          invalidate?.();
        }
        if (actors.length > 0) {
          actorFrame.originX = origin.cx * CELL;
          actorFrame.originZ = origin.cz * CELL;
          actorFrame.originChanged = originChanged;
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
          world.updateFacelift(actorTime, actorFrame.reducedMotion);
          moving = anyMoving;
        }
        // After the actors: a chase camera reads the Caller's position in this frame's params.
        const cameraMoving = positionCamera(params.camera, params.cinematicShot, frame.delta, frame.reducedMotion === true);
        // Cells in and out for this camera; while some are still to build or fading, ask for the next frame.
        if (world.updateStream(streamCamera, errorScale(), now / 1000,frame.reducedMotion===true)) invalidate?.();
        if (streamLog && world.stream && now - streamLogAt >= 5000) {
          streamLogAt = now;
          const st = world.stream.stats;
          streamLog('resident', {
            cells: st.cells, mb: +(st.bytes / 1e6).toFixed(1), tris: st.triangles, loads: st.loads, evictions: st.evictions,
            maxBuildMs: +st.maxBuildMs.toFixed(2), pending: st.pending, overBudget: st.overBudget,
          });
        }
        renderedDelta = frame.delta;
        if (rig) {
          const precip = world.weather;
          sourceWeatherFrame.rain=precip?.wet.value ?? 0;sourceWeatherFrame.snow=precip?.snow.value ?? 0;
          rig.setSourceWeather(sourceWeatherFrame);
          rig.beforeRender(camera,frame.time,frame.reducedMotion===true,sourceHeightOffset(camera.position.x+origin.cx*CELL,camera.position.z+origin.cz*CELL));
          world.applySourceLook(rig.sourceLook);
          post?.physical?.applySourceLook(rig.sourceLook);
          post?.physical?.updateSourceFrame(frame.time,frame.reducedMotion===true);
          sourceHazeFrame.origin[0]=origin.cx*CELL;sourceHazeFrame.origin[2]=origin.cz*CELL;
          sourceHazeFrame.sourceYOffset=sourceHeightOffset(camera.position.x+sourceHazeFrame.origin[0],camera.position.z+sourceHazeFrame.origin[2]);
          post?.physical?.updateSourceCamera(sourceHazeFrame);
          const out = shots.shot;
          const focusX = out.hasLookAtTarget ? out.lookAtTarget[0] : out.position[0];
          const focusZ = out.hasLookAtTarget ? out.lookAtTarget[2] : out.position[2];
          rig.update(camera.position.y, focusX - origin.cx * CELL, focusZ - origin.cz * CELL,frame.time);
          const preset = params.preset ?? DEFAULT_PHYSICAL_PRESET;
          if (preset !== rig.preset) {
            // The rebake renders PMREM cube faces through renderer.render, which
            // the post mount has pointed at the pipeline; run it on the direct path.
            if (post) post.withDirectRender(() => rig.applyPreset(preset));
            else rig.applyPreset(preset);
            world.applySourceLook(rig.sourceLook);
            post?.physical?.applySourceLook(rig.sourceLook);
            invalidate?.();
          }
          // Night light follows the camera and the preset's interior glow (world/physical/night-lights.ts).
          nightLightForward(camera, focusX - streamCamera.x, focusZ - streamCamera.z, nightForward);
          world.updateNightLights(
            streamCamera.x, streamCamera.y, streamCamera.z, nightForward.x, nightForward.z, rig.uniforms.uInteriorGlow.value,
          );
        }
        // Precipitation animates on the shader clock — while rain or snow is
        // live the loop must keep drawing, or the on-demand canvas freezes
        // the weather with the world.
        const precip = world.weather;
        if (moving || cameraMoving || (rig?.animated && !frame.reducedMotion) || (precip !== null && Math.max(precip.wet.value, precip.snow.value) > 0.01)) invalidate?.();
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
        // Klipp converts normalised viewOffset to pixels with this size.
        shots.setSize(width, height);
        // The canvas just re-stamped the raw device pixel ratio — re-apply the scale.
        renderScale?.resized();
        if (adaptive && !upscalePass && adaptiveScaleFactor !== 1) {
          renderer?.setPixelRatio(adaptiveBaseRatio * adaptiveScaleFactor);
        }
      },
      dispose: disposeScene,
    };
    buildProgress.beginAssets();
    yield 0.99;
    // Observe immediately; callers still receive the original rejecting prerequisite.
    void prepared.ready?.catch(() => {});
    delivered = true;
    return prepared;
  } finally {
    if (!delivered) disposeScene();
  }
}
