// Adapted from mrdoob/slop-newyork @ be65d0a, js/lighting.js LightingSystem and createAerialFogNode,
// js/tsl-materials.js cityUniforms, js/main.js initApp (renderer setup and the StorageInstancedBufferAttribute
// swap) (MIT, © 2026 Mr.doob). Slop credits three.js's SkyMesh.js (Preetham sky with Beer-Powder clouds),
// SunLight.js / SunLightNode.js and ClusteredLighting.js, used here from the installed three@0.186.1.
//
// The physically lit city's light rig: SkyMesh baked to PMREM without its
// sun disc, the aerial-perspective fog node, SunLight with two cascades,
// a HemisphereLight fill, ClusteredLighting, and the shared cityUniforms the
// materials read. Each piece mounts only when its PhysicalFeatures bit is
// set, so a Phase 0 probe can isolate it.
//
// r186 against Slop's three@dev, checked before porting:
// - SunLight has no static registerNode in r186 (examples/jsm/lights/SunLight.js);
//   the light node is registered with SunLight.registerNode, Slop's
//   fallback branch (r187 deprecated library.addLight/getLightNodeClass).
// - SunLightShadow fixes the cascade count at 2 (SunLightShadow.js _cascadeCount),
//   so the shadow1 probe uses a DirectionalLight with one map instead.
// - SkyMesh's vertexNode writes z = w (objects/SkyMesh.js); the reversed-depth
//   fix overrides z to 0, the far plane when Renderer.reversedDepthBuffer is on.
// - ClusteredLightsNode.setLights clusters only unshadowed PointLights
//   (tsl/lighting/ClusteredLightsNode.js); SpotLights and the sun stay on the
//   per-material path.
import type { Three } from '@acme/ui/three';
import type { CubeRenderTarget, Node, RenderTarget, Texture, UniformNode } from 'three/webgpu';
import { createSourceLightProbe } from './source-light-probe.ts';
import { createSourceCloudDeck } from './source-cloud-deck.ts';
import { createSourceSky } from './source-sky.ts';
import { SkyMesh } from 'three/examples/jsm/objects/SkyMesh.js';
import { SunLight } from 'three/examples/jsm/lights/SunLight.js';
import { SunLightNode } from 'three/examples/jsm/lights/SunLightNode.js';
import { ClusteredLighting } from 'three/examples/jsm/lighting/ClusteredLighting.js';
import {
  DEFAULT_PHYSICAL_PRESET,
  PHYSICAL_RIG,
  shadowFarForAltitude,
  sunShadowTile,
  type PhysicalFeatures,
  type PhysicalPresetId,
} from './physical-look.ts';
import { resolveSourceLook, type SourceLook, type SourceLookWeather } from './source-look.ts';
import { PHYSICAL_NIGHT_SKY, PHYSICAL_PRESETS } from './physical-presets.ts';
import { createSoftShadowFilter, SOFT_SHADOW_RADIUS } from './physical/soft-shadow-filter.ts';

type RendererT = InstanceType<Three['WebGPURenderer']>;
type SceneT = InstanceType<Three['Scene']>;
type Object3DT = InstanceType<Three['Object3D']>;
type ColorT = InstanceType<Three['Color']>;
type Vector3T = InstanceType<Three['Vector3']>;
type TextureT = Texture;
type RenderTargetT = RenderTarget<TextureT>;

/** The per-preset values the city's materials read (js/tsl-materials.js cityUniforms). */
export interface CityUniforms {
  uSunColor: UniformNode<'color', ColorT>;
  uSkyTopColor: UniformNode<'color', ColorT>;
  uSkyHorizonColor: UniformNode<'color', ColorT>;
  uSkySunDir: UniformNode<'vec3', Vector3T>;
  uInteriorGlow: UniformNode<'float', number>;
  uRoadWetness: UniformNode<'float', number>;
  uCanyonBounce: UniformNode<'float', number>;
}

const uniformsByRuntime = new WeakMap<object, CityUniforms>();

/**
 * One cityUniforms set per three runtime (keyed by its TSL namespace), so
 * the materials and the rig share uniform nodes. Seeded from the default
 * preset; Slop seeds ad-hoc values that its first applyPreset overwrites.
 */
export function cityUniforms(THREE: Three): CityUniforms {
  const existing = uniformsByRuntime.get(THREE.TSL);
  if (existing) return existing;
  const T = THREE.TSL;
  const p = PHYSICAL_PRESETS[DEFAULT_PHYSICAL_PRESET];
  const created: CityUniforms = {
    uSunColor: T.uniform(new THREE.Color(p.colors.sun)),
    uSkyTopColor: T.uniform(new THREE.Color(p.colors.skyTop)),
    uSkyHorizonColor: T.uniform(new THREE.Color(p.colors.skyHorizon)),
    uSkySunDir: T.uniform(new THREE.Vector3(...p.sunDirection)),
    uInteriorGlow: T.uniform(p.interiorGlow),
    uRoadWetness: T.uniform(p.roadWetness),
    uCanyonBounce: T.uniform(p.canyonBounce),
  };
  uniformsByRuntime.set(THREE.TSL, created);
  return created;
}

export interface PhysicalRigOptions {
  features: PhysicalFeatures;
  wake?(): void;
  /** Per-cascade shadow tile the tier allows (perf/tier.ts); the device limit can lower it. */
  shadowTile: number;
  /** ClusteredLighting maxLights from the tier. */
  clusteredMaxLights: number;
  preset?: PhysicalPresetId;
  /**
   * Drawn frames between sun shadow re-renders (EXPO_PUBLIC_WORLD_SHADOW_INTERVAL,
   * physical-look.ts). >1 sets the light's shadow.autoUpdate = false and raises
   * needsUpdate on ticks and on sun/preset/far changes. Default 1: every frame.
   */
  shadowInterval?: number;
}

export interface PhysicalRig {
  /** The SkyMesh when `skyPmrem` is on, else null. */
  sky: InstanceType<typeof SkyMesh> | null;
  /** SunLight (2 cascades) or the shadow1 DirectionalLight; null when no shadow feature is on. */
  sun: SunLight | InstanceType<Three['DirectionalLight']> | null;
  hemi: InstanceType<Three['HemisphereLight']> | null;
  /** The per-cascade tile actually used, after the device limit. */
  shadowTile: number;
  /** PMREM render target, reused across presets; null until the first bake or without a renderer. */
  readonly environment: TextureT | null;
  uniforms: CityUniforms;
  readonly preset: PhysicalPresetId;
  readonly sourceLook: SourceLook;
  readonly sourceProbePreparation: {camera: import('three/webgpu').Camera; target: import('three/webgpu').CubeRenderTarget} | null;
  readonly animated: boolean;
  setSourceWeather(weather: SourceLookWeather): void;
  setSourceHazeActive(active: boolean): void;
  beforeRender(camera: InstanceType<Three['PerspectiveCamera']>, timeS: number, reducedMotion?: boolean, sourceYOffset?:number): void;
  afterRender(camera: InstanceType<Three['PerspectiveCamera']>, dt: number): void;
  /** Re-light for a preset; rebakes the environment into the same render target. */
  applyPreset(id: PhysicalPresetId, force?: boolean): void;
  /**
   * perf/adaptive-tiers.ts: the shadow refresh interval at runtime — the same
   * autoUpdate/needsUpdate throttle EXPO_PUBLIC_WORLD_SHADOW_INTERVAL sets at
   * construction. 1 restores every-frame refresh; >1 throttles and pokes one
   * immediate refresh so the change lands on the next frame, not the next tick.
   * No-op without a sun. The explicit env pick beats adaptive (the scene
   * suppresses this action kind while EXPO_PUBLIC_WORLD_SHADOW_INTERVAL is set).
   */
  setShadowInterval(interval: number): void;
  /** Per frame: shadow far plane from camera altitude; the shadow1 light follows the focus. */
  update(cameraY: number, focusX: number, focusZ: number, timeS?: number): void;
  dispose(): void | Promise<void>;
}



function maxTextureDimension(renderer: RendererT | null): number | undefined {
  const backend = renderer?.backend as unknown as { device?: { limits?: { maxTextureDimension2D?: number } } } | undefined;
  return backend?.device?.limits?.maxTextureDimension2D;
}

/**
 * Builds the rig and adds its objects to `scene`. `renderer` is null in node
 * tests: then nothing is registered, baked or reassigned on a renderer, the
 * same way Slop's LightingSystem runs without one.
 */
export function createPhysicalRig(
  THREE: Three,
  renderer: RendererT | null,
  scene: SceneT,
  options: PhysicalRigOptions,
): PhysicalRig {
  const T = THREE.TSL;
  const { features } = options;
  const uniforms = cityUniforms(THREE);
  let presetId: PhysicalPresetId = options.preset ?? DEFAULT_PHYSICAL_PRESET;
  const start = PHYSICAL_PRESETS[presetId];
  let sourceWeather: SourceLookWeather = {};
  let sourceProbe: ReturnType<typeof createSourceLightProbe> | null = null;
  let sourceLook = resolveSourceLook(presetId, sourceWeather);
  const added: Object3DT[] = [];

  // ---- Sky, PMREM, aerial fog -------------------------------------------------
  let sky: InstanceType<typeof SkyMesh> | null = null;
  let sourceSky: ReturnType<typeof createSourceSky> | null = null;
  let sourceEnvSky: ReturnType<typeof createSourceSky> | null = null;
  let sourceClouds:ReturnType<typeof createSourceCloudDeck>|null=null;
  let uFogDensity: UniformNode<'float', number> | null = null;
  let fog: InstanceType<Three['FogExp2']> | null = null;
  if (features.skyPmrem) {
    sourceSky = createSourceSky(THREE, false, renderer?.reversedDepthBuffer === true);
    sourceEnvSky = createSourceSky(THREE, true, renderer?.reversedDepthBuffer === true);
    sky = sourceSky.sky;
    sourceSky.apply(sourceLook);sourceEnvSky.apply(sourceLook);
    sourceClouds=createSourceCloudDeck(THREE);sourceClouds.apply(sourceLook);scene.add(sourceClouds.mesh);added.push(sourceClouds.mesh);
    scene.add(sky);
    added.push(sky);
    fog = new THREE.FogExp2(new THREE.Color(start.colors.fog), start.fogDensity);
    uFogDensity = T.uniform(start.fogDensity);
  }
  const pmrem = renderer && sky ? new THREE.PMREMGenerator(renderer) : null;
  const envScene = new THREE.Scene();
  let envTarget: CubeRenderTarget | null = null;
  const priorFog = scene.fog;
  const priorEnvironment = scene.environment;
  const priorEnvIntensity = scene.environmentIntensity;
  if (fog) scene.fog = fog;

  function bakeEnvironment() {
    if (!pmrem || !sky) return;
    if (!sourceEnvSky) return;
    envScene.add(sourceEnvSky.sky);
    envTarget = pmrem.fromScene(envScene, .02, PHYSICAL_RIG.pmremNear, PHYSICAL_RIG.pmremFar, {
      renderTarget: envTarget,
    });
    scene.environment = envTarget.texture;
    scene.add(sky);
  }

  function aerialFogNode(envTexture: TextureT, density: UniformNode<'float', number>) {
    const toFrag = T.positionWorld.sub(T.cameraPosition);
    const dist = T.length(toFrag);
    const dir = toFrag.div(T.max(dist, 0.001));
    const horizonDir = T.normalize(T.vec3(dir.x, T.max(dir.y, PHYSICAL_RIG.fogHorizonMinY), dir.z));
    const skyColor = T.pmremTexture(envTexture, horizonDir, T.float(PHYSICAL_RIG.fogPmremLevel)).rgb;
    // Mean haze density exp(-y / H) along the ray between fragment and camera.
    const H = T.float(PHYSICAL_RIG.fogHeight);
    const ya = T.max(T.positionWorld.y, 0);
    const yb = T.max(T.cameraPosition.y, 0);
    const dy = yb.sub(ya);
    const ea = T.exp(ya.div(H).negate());
    const eb = T.exp(yb.div(H).negate());
    const meanDensity = T.select(T.abs(dy).greaterThan(1), ea.sub(eb).mul(H).div(dy), ea);
    const tau = density.mul(dist).mul(meanDensity);
    return T.fog(skyColor, T.float(1).sub(T.exp(tau.mul(tau).negate())));
  }

  // ---- Sun --------------------------------------------------------------------
  const shadowTile = sunShadowTile(options.shadowTile, maxTextureDimension(renderer));
  let sun: SunLight | InstanceType<Three['DirectionalLight']> | null = null;
  if (features.sunShadow === 2) {
    if (renderer) {
      (SunLight as unknown as { registerNode(node: unknown): void }).registerNode(SunLightNode);
    }
    const s = new SunLight(new THREE.Color(start.colors.sun), start.sunIntensity);
    s.name = 'city:physical-sun';
    s.position.set(...start.sunDirection);
    s.castShadow = true;
    s.shadow.mapSize.set(shadowTile, shadowTile);
    s.shadow.camera.near = PHYSICAL_RIG.shadowNear;
    s.shadow.camera.far = PHYSICAL_RIG.shadowFarMin;
    s.shadow.normalBias = PHYSICAL_RIG.normalBias;
    // Noise-free tent filter in place of three's IGN-rotated PCF (physical/soft-shadow-filter.ts): canopy shadows read soft, not dithered.
    (s.shadow as unknown as { filterNode: unknown }).filterNode = createSoftShadowFilter(THREE);
    s.shadow.radius = SOFT_SHADOW_RADIUS;
    sun = s;
  } else if (features.sunShadow === 1) {
    const d = new THREE.DirectionalLight(new THREE.Color(start.colors.sun), start.sunIntensity);
    d.name = 'city:physical-sun';
    d.castShadow = true;
    d.shadow.mapSize.set(shadowTile, shadowTile);
    const half = PHYSICAL_RIG.singleShadowHalf;
    const cam = d.shadow.camera;
    cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
    cam.near = PHYSICAL_RIG.shadowNear;
    cam.far = PHYSICAL_RIG.singleShadowDistance * 2;
    cam.updateProjectionMatrix();
    d.shadow.normalBias = PHYSICAL_RIG.normalBias;
    (d.shadow as unknown as { filterNode: unknown }).filterNode = createSoftShadowFilter(THREE);
    d.shadow.radius = SOFT_SHADOW_RADIUS;
    scene.add(d.target);
    added.push(d.target);
    sun = d;
  }
  if (sun) {
    scene.add(sun);
    added.push(sun);
  }

  // EXPO_PUBLIC_WORLD_SHADOW_INTERVAL: refresh the atlas every Nth drawn
  // frame instead of every frame. ShadowNode.updateBefore honours
  // shadow.autoUpdate/needsUpdate (three r187 ShadowNode.js:806-824), so the
  // atlas holds between ticks — a moving caster's shadow lags up to N-1
  // frames, which is why this stays a flag. needsUpdate starts true so the
  // first frame still renders the map. `let`: the adaptive tier policy moves
  // the interval at runtime through setShadowInterval.
  let shadowInterval = Math.max(1, Math.floor(options.shadowInterval ?? 1));
  let throttled = shadowInterval > 1 && sun !== null;
  const lightShadow = () => sun?.shadow as unknown as { autoUpdate: boolean; needsUpdate: boolean } | undefined;
  if (throttled) {
    const sh = lightShadow()!;
    sh.autoUpdate = false;
    sh.needsUpdate = true;
  }
  let intervalTick = 0;
  /** A sun change that can't wait for the tick (preset direction, shadow far, focus move). */
  const pokeShadow = () => {
    if (throttled) lightShadow()!.needsUpdate = true;
  };

  let hemi: InstanceType<Three['HemisphereLight']> | null = null;
  if (features.hemisphere) {
    hemi = new THREE.HemisphereLight(new THREE.Color(start.colors.hemiSky), new THREE.Color(start.colors.hemiGround), start.hemiIntensity);
    hemi.name = 'city:physical-hemi';
    hemi.position.set(0, PHYSICAL_RIG.hemiHeight, 0);
    scene.add(hemi);
    added.push(hemi);
  }

  let bounce: InstanceType<Three['HemisphereLight']> | null = null;
  if (features.hemisphere) {
    bounce = new THREE.HemisphereLight();
    bounce.name = 'city:source-warm-bounce';
    bounce.position.set(0, PHYSICAL_RIG.hemiHeight, 0);
    scene.add(bounce); added.push(bounce);
  }

  // ---- Clustered lighting -------------------------------------------------------
  const priorLighting = renderer?.lighting ?? null;
  // Kept so dispose can free the scene's clustered node and its storage buffers.
  let clustered: InstanceType<typeof ClusteredLighting> | null = null;
  if (renderer && features.clustered) {
    clustered = new ClusteredLighting(
      options.clusteredMaxLights,
      PHYSICAL_RIG.clusterTileSize,
      PHYSICAL_RIG.clusterZSlices,
      PHYSICAL_RIG.clusterMaxPerCluster,
    );
    renderer.lighting = clustered;
  }

  let focusX = 0;
  let focusZ = 0;
  function placeSun(direction: readonly [number, number, number]) {
    if (!sun) return;
    if (features.sunShadow === 1) {
      const r = PHYSICAL_RIG.singleShadowDistance;
      sun.position.set(focusX + direction[0] * r, direction[1] * r, focusZ + direction[2] * r);
      (sun as InstanceType<Three['DirectionalLight']>).target.position.set(focusX, 0, focusZ);
      (sun as InstanceType<Three['DirectionalLight']>).target.updateMatrixWorld();
    } else {
      // SunLight shines from its position toward the origin.
      sun.position.set(direction[0], direction[1], direction[2]);
    }
    sun.updateMatrixWorld();
  }

  function applyPreset(id: PhysicalPresetId, force = false) {
    if (!force && id === presetId && envTarget !== null) return;
    presetId = id;
    const p = PHYSICAL_PRESETS[id];
    sourceLook = resolveSourceLook(id, sourceWeather);
    sourceProbe?.setLook(sourceLook);
    if (sun) {
      sun.color.setRGB(...sourceLook.sunColor);
      sun.intensity = sourceLook.sunIntensity;
      placeSun(sourceLook.sunDirection);
      // The sun moved: the atlas can't wait for the interval tick.
      pokeShadow();
    }
    if (hemi) {
      hemi.color.setRGB(...sourceLook.hemiSky);
      hemi.groundColor.setRGB(...sourceLook.hemiGround);
      hemi.intensity = sourceLook.hemiIntensity;
    }
    if (bounce) {
      bounce.color.setRGB(...sourceLook.bounceSky); bounce.groundColor.setRGB(...sourceLook.bounceGround); bounce.intensity = sourceLook.bounceIntensity;
    }
    if (fog) {
      fog.color.setRGB(...sourceLook.horizon);
      fog.density = sourceLook.sceneFogDensity;
    }
    if (uFogDensity) uFogDensity.value = sourceLook.fogDensity;
    sourceSky?.apply(sourceLook);sourceEnvSky?.apply(sourceLook);sourceClouds?.apply(sourceLook);
    if (sky) {
      sky.turbidity.value = sourceLook.sky.turbidity;
      sky.rayleigh.value = sourceLook.sky.rayleigh;
      sky.mieCoefficient.value = sourceLook.sky.mieCoefficient;
      sky.mieDirectionalG.value = sourceLook.sky.mieDirectionalG;
      sky.sunPosition.value.set(...sourceLook.sunDirection);
    }
    uniforms.uSunColor.value.setRGB(...sourceLook.sunColor);
    uniforms.uSkyTopColor.value.setRGB(...sourceLook.skyAmbient);
    uniforms.uSkyHorizonColor.value.setRGB(...sourceLook.horizon);
    uniforms.uSkySunDir.value.set(...sourceLook.sunDirection);
    uniforms.uInteriorGlow.value = p.interiorGlow;
    uniforms.uRoadWetness.value = p.roadWetness;
    uniforms.uCanyonBounce.value = p.canyonBounce;
    if (sky) {
      scene.environmentIntensity = sourceLook.envIntensity;
      bakeEnvironment();
    }
  }

  applyPreset(presetId, true);
  // The fog node needs the baked texture; Slop also attaches it only when a bake happened.
  const priorFogNode = (scene as unknown as { fogNode?: unknown }).fogNode;
  // TS narrows the closure-assigned target to null here; applyPreset above may have baked it.
  const baked = envTarget as CubeRenderTarget | null;
  if (baked && uFogDensity) {
    (scene as unknown as { fogNode: unknown }).fogNode = aerialFogNode(baked.texture, uFogDensity);
  }

  sourceProbe = renderer && features.hemisphere ? createSourceLightProbe(THREE, renderer, scene, () => options.wake?.()) : null;
  sourceProbe?.setLook(sourceLook);
  let previousWeather: SourceLookWeather | undefined;
  let previousPreset: PhysicalPresetId | undefined, previousProbe = -1;
  let hazeActive = false;
  let skyTime = 0, previousSkyTime: number | undefined, skyPaused = false;
  let disposed = false;
  let disposal: Promise<void> | undefined;
  function composeWeather() {
    const probeOn = sourceProbe?.probeOn ?? 0;
    if (previousPreset === presetId && previousProbe === probeOn && previousWeather &&
      previousWeather.rain===sourceWeather.rain && previousWeather.cloud===sourceWeather.cloud && previousWeather.snow===sourceWeather.snow &&
      previousWeather.flash===sourceWeather.flash && previousWeather.lampBounceK===sourceWeather.lampBounceK && previousWeather.timeSquareDayK===sourceWeather.timeSquareDayK) return;
    previousPreset=presetId;previousProbe=probeOn;previousWeather={...sourceWeather};
    sourceLook = resolveSourceLook(presetId, { ...sourceWeather, probeOn: sourceProbe?.probeOn ?? 0 });
    sourceProbe?.setLook(sourceLook);
    if (sun) sun.intensity = sourceLook.sunIntensity;
    if (hemi) hemi.intensity = sourceLook.hemiIntensity;
    if (bounce) bounce.intensity = sourceLook.bounceIntensity;
    if (fog) fog.density = sourceLook.sceneFogDensity;
    if (uFogDensity) uFogDensity.value = sourceLook.fogDensity;
    if (sky) scene.environmentIntensity = sourceLook.envIntensity;
    sourceClouds?.apply(sourceLook);
  }
  return {
    sky,
    sun,
    hemi,
    shadowTile,
    get environment() {
      return envTarget ? envTarget.texture : null;
    },
    uniforms,
    get preset() {
      return presetId;
    },
    applyPreset,
    get sourceLook() { return sourceLook; },
    get sourceProbePreparation() { return sourceProbe?.preparation ?? null; },
    get animated() { return sourceSky !== null && (sourceLook.sourceMode === 'golden' || sourceLook.clouds.visible); },
    setSourceWeather(weather) {
      sourceWeather.rain=weather.rain;sourceWeather.cloud=weather.cloud;sourceWeather.snow=weather.snow;
      sourceWeather.flash=weather.flash;sourceWeather.lampBounceK=weather.lampBounceK;sourceWeather.timeSquareDayK=weather.timeSquareDayK;
      composeWeather();
    },
    setSourceHazeActive(active) {
      if (hazeActive === active) return; hazeActive=active;
      (scene as unknown as {fogNode:unknown}).fogNode = active ? null : (baked && uFogDensity ? aerialFogNode(baked.texture,uFogDensity) : priorFogNode);
    },
    beforeRender(camera, timeS, reducedMotion = false, sourceYOffset = 0) {
      if (previousSkyTime !== undefined && !reducedMotion && !skyPaused) skyTime += Math.max(0, timeS-previousSkyTime);
      previousSkyTime=timeS;skyPaused=reducedMotion;
      if (sourceSky) { sourceSky.sky.position.copy(camera.position); sourceSky.update(skyTime); sourceEnvSky?.update(skyTime); }
      sourceClouds?.update(camera,skyTime,sourceYOffset);
    },
    afterRender(camera, dt) { sourceProbe?.afterRender(camera, dt); composeWeather(); },
    setShadowInterval(interval: number) {
      const next = Math.max(1, Math.min(8, Math.floor(interval)));
      if (next === shadowInterval || !sun) return;
      shadowInterval = next;
      throttled = shadowInterval > 1;
      intervalTick = 0;
      const sh = lightShadow();
      if (sh) {
        sh.autoUpdate = !throttled;
        // The change itself can't wait for a tick — refresh the atlas once now.
        sh.needsUpdate = true;
      }
    },
    update(cameraY, x, z) {
      if (!sun) return;
      // Every Nth frame the atlas re-renders; preset/far/focus changes poke it directly.
      if (throttled) {
        intervalTick = (intervalTick + 1) % shadowInterval;
        if (intervalTick === 0) lightShadow()!.needsUpdate = true;
      }
      if (features.sunShadow === 2) {
        const far = shadowFarForAltitude(cameraY);
        if (sun.shadow.camera.far !== far) {
          sun.shadow.camera.far = far;
          pokeShadow();
        }
      } else if (x !== focusX || z !== focusZ) {
        focusX = x;
        focusZ = z;
        placeSun(sourceLook.sunDirection);
        pokeShadow();
      }
    },
    dispose() {
      if (disposed) return disposal;
      disposed = true;
      const drain = sourceProbe?.dispose();
      const release = () => {
      for (const object of added) object.removeFromParent();
      if (renderer && clustered) releaseClusteredNode(renderer, clustered, scene);
      if (renderer && features.clustered && priorLighting) renderer.lighting = priorLighting;
      if (fog) scene.fog = priorFog;
      if (sky) {
        scene.environment = priorEnvironment;
        scene.environmentIntensity = priorEnvIntensity;
        (scene as unknown as { fogNode: unknown }).fogNode = priorFogNode;
        sourceSky?.dispose();sourceEnvSky?.dispose();sourceClouds?.dispose();
      }
      sun?.dispose();
      hemi?.dispose();
      bounce?.dispose();
      envTarget?.dispose();
      pmrem?.dispose();
      };
      if (drain) { disposal = drain.then(release); return disposal; }
      release();
    },
  };
}

type RendererAttributes = { _attributes?: { delete(attribute: object): unknown } | null };

/**
 * Frees the scene's ClusteredLightsNode. Its light-index list is a storage
 * buffer (about 16 MB at the iPad Pro's drawing buffer), and node.dispose()
 * only frees bindings, which skip storage buffers, so the attribute is
 * deleted from the renderer first. Neither `_lightsNodeMap`, `_lightIndexes`
 * nor `_attributes` is public API (three r186). Returns whether a node was freed.
 */
export function releaseClusteredNode(renderer: RendererT, lighting: object, scene: object): boolean {
  const map = (lighting as { _lightsNodeMap?: WeakMap<object, { _lightIndexes?: { value?: object } | null; dispose(): void }> })._lightsNodeMap;
  const node = map?.get(scene);
  if (!node) return false;
  const indexes = node._lightIndexes?.value;
  if (indexes) (renderer as unknown as RendererAttributes)._attributes?.delete(indexes);
  node.dispose();
  map!.delete(scene);
  return true;
}

/**
 * Deletes the GPU buffers of every InstancedMesh whose instanceMatrix
 * swapInstanceMatricesToStorage moved to a storage attribute: geometry
 * dispose never reaches the instance matrix, so they waited for a GC on the
 * shared device. Call first in the scene's dispose. Returns how many were freed.
 */
export function releaseStorageInstanceMatrices(renderer: RendererT, root: Object3DT): number {
  const attributes = (renderer as unknown as RendererAttributes)._attributes;
  if (!attributes) return 0;
  let freed = 0;
  root.traverse((object) => {
    const mesh = object as Object3DT & { isInstancedMesh?: boolean; instanceMatrix?: object & { isStorageInstancedBufferAttribute?: boolean } };
    if (mesh.isInstancedMesh !== true || mesh.instanceMatrix?.isStorageInstancedBufferAttribute !== true) return;
    if (attributes.delete(mesh.instanceMatrix) !== null) freed++;
  });
  return freed;
}

/** Meshes that never cast a sun shadow: flat ground layers and the sky. */
const NON_CASTERS = new Set([
  'city:ground', 'city:roads', 'city:sidewalks', 'city:areas', 'city:contact-shadows', 'city:sky', 'city:physical-sky',
]);

/**
 * Shadow roles for everything under `root`: opaque meshes cast (unless
 * `userData.noSunShadow`), everything but the sky receives. Returns the
 * caster count.
 */
export function applyPhysicalShadowRoles(root: Object3DT): number {
  let casters = 0;
  root.traverse((object) => {
    const mesh = object as Object3DT & { isMesh?: boolean; material?: { transparent?: boolean } | { transparent?: boolean }[] };
    if (mesh.isMesh !== true) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const transparent = materials.some((m) => m?.transparent === true);
    // `userData.noSunShadow`: a mesh too far out for its shadow to read (the far parked-car level) skips the caster pass.
    const cast = !NON_CASTERS.has(object.name) && !transparent && object.userData.noSunShadow !== true;
    object.castShadow = cast;
    object.receiveShadow = object.name !== 'city:sky' && object.name !== 'city:physical-sky';
    if (cast) casters++;
  });
  return casters;
}

/**
 * js/main.js: on WebGPU, each InstancedMesh's matrices move from a uniform
 * buffer (re-uploaded every draw of every pass; Slop measured ~2.5 MB/frame
 * with the cascades) to a storage attribute that uploads only when dirty.
 * WebGL2 keeps ordinary instanced attributes. Instanced meshes created after
 * this call keep their uniform path. Returns how many were swapped.
 */
export function swapInstanceMatricesToStorage(THREE: Three, renderer: RendererT, root: Object3DT): number {
  const backend = renderer.backend as unknown as { isWebGPUBackend?: boolean };
  if (backend.isWebGPUBackend !== true) return 0;
  let swapped = 0;
  root.traverse((object) => {
    const mesh = object as Object3DT & { isInstancedMesh?: boolean; instanceMatrix?: InstanceType<Three['InstancedBufferAttribute']> };
    if (mesh.isInstancedMesh !== true || !mesh.instanceMatrix) return;
    if ((mesh.instanceMatrix as unknown as { isStorageInstancedBufferAttribute?: boolean }).isStorageInstancedBufferAttribute) return;
    mesh.instanceMatrix = new THREE.StorageInstancedBufferAttribute(mesh.instanceMatrix.array as Float32Array, 16);
    swapped++;
  });
  return swapped;
}
