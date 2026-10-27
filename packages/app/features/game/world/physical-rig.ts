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
//   the light node is registered with renderer.library.addLight, Slop's
//   fallback branch. NodeLibrary.addClass warns on a second registration,
//   so it is guarded with getLightNodeClass.
// - SunLightShadow fixes the cascade count at 2 (SunLightShadow.js _cascadeCount),
//   so the shadow1 probe uses a DirectionalLight with one map instead.
// - SkyMesh's vertexNode writes z = w (objects/SkyMesh.js); the reversed-depth
//   fix overrides z to 0, the far plane when Renderer.reversedDepthBuffer is on.
// - ClusteredLightsNode.setLights clusters only unshadowed PointLights
//   (tsl/lighting/ClusteredLightsNode.js); SpotLights and the sun stay on the
//   per-material path.
import type { Three } from '@acme/ui/three';
import type { Node, RenderTarget, Texture, UniformNode } from 'three/webgpu';
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
import { PHYSICAL_NIGHT_SKY, PHYSICAL_PRESETS } from './physical-presets.ts';

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
  /** Per-cascade shadow tile the tier allows (perf/tier.ts); the device limit can lower it. */
  shadowTile: number;
  /** ClusteredLighting maxLights from the tier. */
  clusteredMaxLights: number;
  preset?: PhysicalPresetId;
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
  /** Re-light for a preset; rebakes the environment into the same render target. */
  applyPreset(id: PhysicalPresetId, force?: boolean): void;
  /** Per frame: shadow far plane from camera altitude; the shadow1 light follows the focus. */
  update(cameraY: number, focusX: number, focusZ: number): void;
  dispose(): void;
}

function isLightNodeRegistered(renderer: RendererT, lightClass: unknown): boolean {
  const library = renderer.library as unknown as { getLightNodeClass(light: unknown): unknown };
  return library.getLightNodeClass(lightClass) !== null;
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
  const added: Object3DT[] = [];

  // ---- Sky, PMREM, aerial fog -------------------------------------------------
  let sky: InstanceType<typeof SkyMesh> | null = null;
  let uSkyExposure: UniformNode<'float', number> | null = null;
  let uNightFactor: UniformNode<'float', number> | null = null;
  let uFogDensity: UniformNode<'float', number> | null = null;
  let fog: InstanceType<Three['FogExp2']> | null = null;
  if (features.skyPmrem) {
    sky = new SkyMesh();
    sky.name = 'city:physical-sky';
    sky.scale.setScalar(PHYSICAL_RIG.skyScale);
    sky.cloudScale.value = PHYSICAL_RIG.cloudScale;
    sky.cloudSpeed.value = PHYSICAL_RIG.cloudSpeed;
    sky.cloudElevation.value = PHYSICAL_RIG.cloudElevation;
    const exposure = T.uniform(start.skyExposure);
    const night = T.uniform(start.nightFactor);
    const nightSky = T.uniform(new THREE.Color(PHYSICAL_NIGHT_SKY));
    uSkyExposure = exposure;
    uNightFactor = night;
    const rawColor = sky.material.colorNode as Node<'vec4'>;
    sky.material.colorNode = T.Fn(() => T.vec4(T.mix(rawColor.rgb.mul(exposure), nightSky, night), T.float(1)))();
    // reversedDepthBuffer: far is z = 0, where SkyMesh writes z = w.
    if (renderer?.reversedDepthBuffer === true) {
      const rawVertex = sky.material.vertexNode as Node<'vec4'>;
      sky.material.vertexNode = T.Fn(() => {
        const position = rawVertex.toVar();
        position.z.assign(0);
        return position;
      })();
    }
    scene.add(sky);
    added.push(sky);
    fog = new THREE.FogExp2(new THREE.Color(start.colors.fog), start.fogDensity);
    uFogDensity = T.uniform(start.fogDensity);
  }
  const pmrem = renderer && sky ? new THREE.PMREMGenerator(renderer) : null;
  const envScene = new THREE.Scene();
  let envTarget: RenderTargetT | null = null;
  const priorFog = scene.fog;
  const priorEnvironment = scene.environment;
  const priorEnvIntensity = scene.environmentIntensity;
  if (fog) scene.fog = fog;

  function bakeEnvironment() {
    if (!pmrem || !sky) return;
    sky.showSunDisc.value = 0;
    envScene.add(sky);
    envTarget = pmrem.fromScene(envScene, PHYSICAL_RIG.pmremSigma, PHYSICAL_RIG.pmremNear, PHYSICAL_RIG.pmremFar, {
      renderTarget: envTarget,
    }) as RenderTargetT;
    scene.environment = envTarget.texture;
    sky.showSunDisc.value = 1;
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
    if (renderer && !isLightNodeRegistered(renderer, SunLight)) {
      renderer.library.addLight(SunLightNode as never, SunLight as never);
    }
    const s = new SunLight(new THREE.Color(start.colors.sun), start.sunIntensity);
    s.name = 'city:physical-sun';
    s.position.set(...start.sunDirection);
    s.castShadow = true;
    s.shadow.mapSize.set(shadowTile, shadowTile);
    s.shadow.camera.near = PHYSICAL_RIG.shadowNear;
    s.shadow.camera.far = PHYSICAL_RIG.shadowFarMin;
    s.shadow.normalBias = PHYSICAL_RIG.normalBias;
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
    scene.add(d.target);
    added.push(d.target);
    sun = d;
  }
  if (sun) {
    scene.add(sun);
    added.push(sun);
  }

  let hemi: InstanceType<Three['HemisphereLight']> | null = null;
  if (features.hemisphere) {
    hemi = new THREE.HemisphereLight(new THREE.Color(start.colors.hemiSky), new THREE.Color(start.colors.hemiGround), start.hemiIntensity);
    hemi.name = 'city:physical-hemi';
    hemi.position.set(0, PHYSICAL_RIG.hemiHeight, 0);
    scene.add(hemi);
    added.push(hemi);
  }

  // ---- Clustered lighting -------------------------------------------------------
  const priorLighting = renderer?.lighting ?? null;
  if (renderer && features.clustered) {
    renderer.lighting = new ClusteredLighting(
      options.clusteredMaxLights,
      PHYSICAL_RIG.clusterTileSize,
      PHYSICAL_RIG.clusterZSlices,
      PHYSICAL_RIG.clusterMaxPerCluster,
    );
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
    if (sun) {
      sun.color.set(p.colors.sun);
      sun.intensity = p.sunIntensity;
      placeSun(p.sunDirection);
    }
    if (hemi) {
      hemi.color.set(p.colors.hemiSky);
      hemi.groundColor.set(p.colors.hemiGround);
      hemi.intensity = p.hemiIntensity;
    }
    if (fog) {
      fog.color.set(p.colors.fog);
      fog.density = p.fogDensity;
    }
    if (uFogDensity) uFogDensity.value = p.fogDensity;
    if (sky) {
      sky.turbidity.value = p.turbidity;
      sky.rayleigh.value = p.rayleigh;
      sky.mieCoefficient.value = p.mieCoefficient;
      sky.mieDirectionalG.value = p.mieDirectionalG;
      sky.cloudCoverage.value = p.cloudCoverage;
      sky.cloudDensity.value = p.cloudDensity;
      sky.sunPosition.value.set(...p.sunDirection);
    }
    if (uSkyExposure) uSkyExposure.value = p.skyExposure;
    if (uNightFactor) uNightFactor.value = p.nightFactor;
    uniforms.uSunColor.value.set(p.colors.sun);
    uniforms.uSkyTopColor.value.set(p.colors.skyTop);
    uniforms.uSkyHorizonColor.value.set(p.colors.skyHorizon);
    uniforms.uSkySunDir.value.set(...p.sunDirection);
    uniforms.uInteriorGlow.value = p.interiorGlow;
    uniforms.uRoadWetness.value = p.roadWetness;
    uniforms.uCanyonBounce.value = p.canyonBounce;
    if (sky) {
      scene.environmentIntensity = p.envIntensity;
      bakeEnvironment();
    }
  }

  applyPreset(presetId, true);
  // The fog node needs the baked texture; Slop also attaches it only when a bake happened.
  const priorFogNode = (scene as unknown as { fogNode?: unknown }).fogNode;
  // TS narrows the closure-assigned target to null here; applyPreset above may have baked it.
  const baked = envTarget as RenderTargetT | null;
  if (baked && uFogDensity) {
    (scene as unknown as { fogNode: unknown }).fogNode = aerialFogNode(baked.texture, uFogDensity);
  }

  let disposed = false;
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
    update(cameraY, x, z) {
      if (!sun) return;
      if (features.sunShadow === 2) {
        sun.shadow.camera.far = shadowFarForAltitude(cameraY);
      } else if (x !== focusX || z !== focusZ) {
        focusX = x;
        focusZ = z;
        placeSun(PHYSICAL_PRESETS[presetId].sunDirection);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const object of added) object.removeFromParent();
      if (renderer && features.clustered && priorLighting) renderer.lighting = priorLighting;
      if (fog) scene.fog = priorFog;
      if (sky) {
        scene.environment = priorEnvironment;
        scene.environmentIntensity = priorEnvIntensity;
        (scene as unknown as { fogNode: unknown }).fogNode = priorFogNode;
        sky.geometry.dispose();
        sky.material.dispose();
      }
      sun?.dispose();
      hemi?.dispose();
      envTarget?.dispose();
      pmrem?.dispose();
    },
  };
}

/** Meshes that never cast a sun shadow: flat ground layers and the sky. */
const NON_CASTERS = new Set([
  'city:ground', 'city:roads', 'city:sidewalks', 'city:areas', 'city:contact-shadows', 'city:sky', 'city:physical-sky',
]);

/**
 * Shadow roles for everything under `root`: opaque meshes cast, everything
 * but the sky receives. Returns the caster count.
 */
export function applyPhysicalShadowRoles(root: Object3DT): number {
  let casters = 0;
  root.traverse((object) => {
    const mesh = object as Object3DT & { isMesh?: boolean; material?: { transparent?: boolean } | { transparent?: boolean }[] };
    if (mesh.isMesh !== true) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const transparent = materials.some((m) => m?.transparent === true);
    const cast = !NON_CASTERS.has(object.name) && !transparent;
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
