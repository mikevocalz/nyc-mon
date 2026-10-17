// world/sky-rig.ts — lane L1, "one light". When EXPO_PUBLIC_WORLD_SKY_RIG is
// on, the sky dome, sun DirectionalLight, exponential fog and the scene
// environment map all come from a single verified sky JSON
// (@acme/assets/skies — morning = qwantani_morning_puresky,
// dusk = qwantani_sunset_puresky, night = qwantani_moonrise_puresky, the
// README's verified recommendation trio). The JSON is committed; the matching
// 2k .hdr files are not — they live only in each machine's
// packages/assets/skies/.cache and are fetched from the JSON's recorded
// source.fileUrl at rig time.
//
// DEVICE-PENDING: react-native-webgpu float/half-float texture upload is
// UNVERIFIED (skies README §HDR upload). The HDR path — HDRLoader fetch,
// half-float upload, PMREMGenerator.fromEquirectangular — is therefore wrapped
// so any failure keeps the JSON-colour dome and falls back to a CPU-baked
// half-float equirect for the environment. Even the baked path uploads a
// HalfFloatType DataTexture, so the env map is device-pending too; the dome
// itself never needs a texture. Confirm on a device before relying on either.

import { SKY_PRESETS, type SkyLighting, type SkyName } from '@acme/assets/skies';
import type { Three } from '@acme/ui/three';

export type { SkyLighting, SkyName };

type DataTextureT = InstanceType<Three['DataTexture']>;
type DomeMaterialT = InstanceType<Three['MeshBasicNodeMaterial']>;
type RenderTargetT = InstanceType<Three['RenderTarget']>;
type RendererT = InstanceType<Three['WebGPURenderer']>;
type SceneT = InstanceType<Three['Scene']>;
type TextureT = InstanceType<Three['Texture']>;

export const FOG_DENSITY = 0.00028; // Flying Roadster measured, TODO(tune)

/**
 * Dome/env tuning constants. Colour stops mirror the existing gradient dome's
 * elevation bands (materials.ts: haze 0→0.22, mid→zenith 0.18→0.75); the sun
 * key level anchors on the unflagged dusk DirectionalLight in index.ts.
 */
export const SKY_RIG = {
  /** dir.y where the horizon blend starts/ends — matches the gradient dome. */
  hazeLo: 0,
  hazeHi: 0.22,
  midLo: 0.18,
  midHi: 0.75,
  /** Halo half-power width ≈ acos((1/2)^(1/160)) ≈ 9.4° around the disc. */
  glowPower: 160,
  /** Halo share of the disc tint. */
  glowLevel: 0.55, // TODO(tune) — halo level vs the raw HDR disc, needs device eyeball
  /** Disc multiplier — over-bright so the key reads past 1.0 linear. */
  discLevel: 4,
  /** Soft outer edge of the disc, as a multiple of the JSON's measured spread. */
  discSoftEdge: 1.5,
  /** Floor for the measured disc spread (degrees) so star-tight picks still resolve. */
  discMinDeg: 0.1,
  /** Key-light level of the unflagged dusk sun — the anchor for irradiance scaling. */
  sunKeyLevel: 2.2,
  /**
   * Environment equirect width: PMREM cube size is sourceWidth/4
   * (PMREMGenerator.fromEquirectangular → _setSize(image.width / 4)),
   * so 1024 → a 256px cube — the phone env size.
   */
  envWidth: 1024,
  envHeight: 512,
  /** Half-float ceiling — same clamp HDRLoader applies when converting to halfs. */
  maxRadiance: 65504,
} as const;

const TRUTHY_FLAG = new Set(['1', 'true', 'on', 'yes']);

export function parseSkyRigFlag(value: string | undefined | null): boolean {
  return value != null && TRUTHY_FLAG.has(value.trim().toLowerCase());
}

/** Opt-in L1 flag — default OFF. Matches the EXPERIMENTAL_SURFACE_DETAIL pattern. */
export const EXPERIMENTAL_SKY_RIG = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_SKY_RIG);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstepJs = (lo: number, hi: number, x: number) => {
  const t = clamp01((x - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
};
const luma = (rgb: readonly number[]) =>
  (rgb[0] ?? 0) * 0.2126 + (rgb[1] ?? 0) * 0.7152 + (rgb[2] ?? 0) * 0.0722;

function normalize3(v: readonly number[]): [number, number, number] {
  const [x = 0, y = 0, z = 0] = v;
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

/** Fail loudly on a malformed JSON rather than shipping NaN into a dome. */
export function assertSkyLighting(sky: SkyLighting): void {
  if (!Array.isArray(sky.sunDirection) || sky.sunDirection.length !== 3) {
    throw new Error(`sky-rig: ${sky.id} sunDirection must be a 3-vector`);
  }
  if (!Array.isArray(sky.skyIrradianceSH) || sky.skyIrradianceSH.length !== 9) {
    throw new Error(`sky-rig: ${sky.id} skyIrradianceSH must have 9 coefficients`);
  }
  for (const row of sky.skyIrradianceSH) {
    if (!Array.isArray(row) || row.length !== 3) {
      throw new Error(`sky-rig: ${sky.id} SH rows must be RGB triples`);
    }
  }
  if (!Array.isArray(sky.horizonColor) || sky.horizonColor.length !== 3) {
    throw new Error(`sky-rig: ${sky.id} horizonColor must be an RGB triple`);
  }
}

/**
 * Sky irradiance for a world direction, per the JSON's own convention:
 * E(n) = Σ coeff[i] · shConstant_i · basis_i(n), basis order
 * [1, x, y, z, x·y, y·z, 3y²−1, x·z, x²−z²], cosine lobe already folded in.
 */
export function evalSkyIrradiance(
  sky: SkyLighting,
  dir: readonly number[],
): [number, number, number] {
  const [x, y, z] = normalize3(dir);
  const c = sky.shConvention.shConstants;
  const sh = sky.skyIrradianceSH;
  const basis = [
    c.c0,
    c.c1 * x,
    c.c1 * y,
    c.c1 * z,
    c.c2 * x * y,
    c.c2 * y * z,
    c.c3 * (3 * y * y - 1),
    c.c2 * x * z,
    c.c4 * (x * x - z * z),
  ];
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 9; i++) {
    const coeff = sh[i] ?? [0, 0, 0];
    const b = basis[i] ?? 0;
    out[0] += (coeff[0] ?? 0) * b;
    out[1] += (coeff[1] ?? 0) * b;
    out[2] += (coeff[2] ?? 0) * b;
  }
  return out;
}

/**
 * Sun key light derived from the JSON: direction is the measured
 * sunDirection, colour is the sunIrradiance normalised to its peak channel,
 * and intensity scales with the irradiance luma — sqrt-compressed and
 * anchored so the dusk pick lands on the unflagged key's 2.2.
 */
export function sunKeyLight(sky: SkyLighting): {
  direction: [number, number, number];
  color: [number, number, number];
  intensity: number;
} {
  const direction = normalize3(sky.sunDirection);
  const irr: [number, number, number] = [
    sky.sunIrradiance[0] ?? 0,
    sky.sunIrradiance[1] ?? 0,
    sky.sunIrradiance[2] ?? 0,
  ];
  const peak = Math.max(irr[0], irr[1], irr[2], 1);
  const color: [number, number, number] = [irr[0] / peak, irr[1] / peak, irr[2] / peak];
  const intensity =
    SKY_RIG.sunKeyLevel * Math.sqrt(luma(irr) / luma(SKY_PRESETS.dusk.sunIrradiance));
  return { direction, color, intensity };
}

/**
 * CPU mirror of the dome's direction→equirect UV: u = atan2(x, z)/2π + 0.5
 * (the JSON's axes convention — u = 0.5 faces +Z, increasing toward +X) and
 * v = asin(y)/π + 0.5 (v = 1 at zenith, matching an HDRLoader texture after
 * flipY; the baked equirect stores rows bottom-up so it uses the same UV with
 * flipY left false).
 */
export function skyEquirectUV(dir: readonly number[]): [number, number] {
  const [x, y, z] = normalize3(dir);
  const yClamped = Math.min(1, Math.max(-1, y));
  return [Math.atan2(x, z) / (2 * Math.PI) + 0.5, Math.asin(yClamped) / Math.PI + 0.5];
}

/**
 * Dome radiance stops from the JSON, no invented colours: horizon is the
 * measured horizonColor; the mid band (45°) and the zenith are the SH sky
 * irradiance evaluated there, azimuth-averaged for the mid ring and divided
 * by π to turn irradiance into the dome's radiance.
 */
export function skyGradientRadiance(sky: SkyLighting): {
  horizon: [number, number, number];
  mid: [number, number, number];
  zenith: [number, number, number];
} {
  const c = sky.shConvention.shConstants;
  const sh = sky.skyIrradianceSH;
  const y = Math.SQRT1_2; // 45° — the gradient dome's mid band
  const zenithIrr = evalSkyIrradiance(sky, [0, 1, 0]);
  // Ring average at 45°: every x/z-dependent basis term averages to zero.
  const midIrr = [0, 1, 2].map(
    (ch) =>
      (sh[0]?.[ch] ?? 0) * c.c0 +
      (sh[2]?.[ch] ?? 0) * c.c1 * y +
      (sh[6]?.[ch] ?? 0) * c.c3 * (3 * y * y - 1),
  );
  const toRadiance = (irr: readonly number[]): [number, number, number] => [
    Math.max((irr[0] ?? 0) / Math.PI, 0),
    Math.max((irr[1] ?? 0) / Math.PI, 0),
    Math.max((irr[2] ?? 0) / Math.PI, 0),
  ];
  return {
    horizon: [sky.horizonColor[0] ?? 0, sky.horizonColor[1] ?? 0, sky.horizonColor[2] ?? 0],
    mid: toRadiance(midIrr),
    zenith: toRadiance(zenithIrr),
  };
}

/**
 * Dome colour node. Texture path samples the equirect by direction and blends
 * a haze band toward the fog/horizon colour near y = 0; the fallback path is
 * the same band structure over the JSON-derived gradient. Both add the
 * over-bright sun disc + glow at the JSON sunDirection so capability flips
 * never move the key.
 */
function skyDomeColorNode(THREE: Three, sky: SkyLighting, equirect: TextureT | null) {
  const T = THREE.TSL;
  const dir = T.normalize(T.positionLocal);
  const gradient = skyGradientRadiance(sky);
  const sun = sunKeyLight(sky);

  const sunDirection = T.uniform(
    new THREE.Vector3(sun.direction[0], sun.direction[1], sun.direction[2]),
    'vec3',
  );
  const horizonColor = T.uniform(new THREE.Color(...gradient.horizon));
  const midColor = T.uniform(new THREE.Color(...gradient.mid));
  const zenithColor = T.uniform(new THREE.Color(...gradient.zenith));
  const sunTint = T.uniform(new THREE.Color(...sun.color));

  const cosA = T.dot(dir, sunDirection);
  const spreadRad = Math.max(sky.sunClusterSpreadDeg, SKY_RIG.discMinDeg) * (Math.PI / 180);
  const disc = T.smoothstep(Math.cos(spreadRad * SKY_RIG.discSoftEdge), Math.cos(spreadRad), cosA);
  const glow = T.pow(T.max(cosA, 0), SKY_RIG.glowPower).mul(SKY_RIG.glowLevel);
  const sunDisc = sunTint.mul(disc.mul(SKY_RIG.discLevel).add(glow));

  const haze = T.smoothstep(SKY_RIG.hazeLo, SKY_RIG.hazeHi, dir.y);

  let base;
  if (equirect) {
    // Same UV as skyEquirectUV above — keep them in lockstep.
    const u = dir.x.atan(dir.z).mul(1 / (Math.PI * 2)).add(0.5);
    const v = dir.y.clamp(-1, 1).asin().mul(1 / Math.PI).add(0.5);
    base = T.mix(horizonColor, T.texture(equirect, T.vec2(u, v)).rgb, haze);
  } else {
    const upper = T.smoothstep(SKY_RIG.midLo, SKY_RIG.midHi, dir.y);
    base = T.mix(T.mix(horizonColor, midColor, haze), zenithColor, upper);
  }
  return base.add(sunDisc);
}

/**
 * BackSide dome material — unlit, same construction as the gradient sky
 * material it replaces (MeshBasicNodeMaterial, depthWrite/depthTest off).
 */
export function createSkyDomeMaterial(
  THREE: Three,
  sky: SkyLighting,
  equirect: TextureT | null = null,
): DomeMaterialT {
  assertSkyLighting(sky);
  const material = new THREE.MeshBasicNodeMaterial();
  material.side = THREE.BackSide;
  material.depthWrite = false;
  material.depthTest = false;
  material.fog = false;
  material.colorNode = skyDomeColorNode(THREE, sky, equirect);
  return material;
}

/**
 * CPU-baked sky equirect for the environment map when no HDR is available:
 * SH sky irradiance (÷π, as dome radiance) plus the measured sun disc at
 * sunIrradiance scale, clamped to the half-float ceiling. Rows are stored
 * bottom-up (row 0 = nadir) with flipY left false, so the standard
 * v = asin(y)/π + 0.5 sampling matches without depending on the WebGPU
 * backend's flipY pass.
 */
export function bakeSkyEquirect(THREE: Three, sky: SkyLighting): DataTextureT {
  assertSkyLighting(sky);
  const w = SKY_RIG.envWidth;
  const h = SKY_RIG.envHeight;
  const data = new Uint16Array(w * h * 4);
  const toHalf = THREE.DataUtils.toHalfFloat;
  const sun = sunKeyLight(sky);
  const spreadRad = Math.max(sky.sunClusterSpreadDeg, SKY_RIG.discMinDeg) * (Math.PI / 180);
  const cosIn = Math.cos(spreadRad);
  const cosOut = Math.cos(spreadRad * SKY_RIG.discSoftEdge);
  for (let r = 0; r < h; r++) {
    const v = (r + 0.5) / h;
    const y = -Math.cos(Math.PI * v); // v 0 = nadir … 1 = zenith
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    for (let col = 0; col < w; col++) {
      const phi = ((col + 0.5) / w - 0.5) * 2 * Math.PI;
      const dir: [number, number, number] = [ring * Math.sin(phi), y, ring * Math.cos(phi)];
      const irr = evalSkyIrradiance(sky, dir);
      const cosA =
        dir[0] * sun.direction[0] + dir[1] * sun.direction[1] + dir[2] * sun.direction[2];
      const disc = smoothstepJs(cosOut, cosIn, cosA);
      const o = (r * w + col) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const radiance = Math.max(irr[ch]! / Math.PI, 0) + (sky.sunIrradiance[ch] ?? 0) * disc;
        data[o + ch] = toHalf(Math.min(radiance, SKY_RIG.maxRadiance));
      }
      data[o + 3] = 0x3c00; // half 1.0
    }
  }
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Stride-downsample an equirect (Uint16 or Float32 data) to the env width. */
function downsampleEquirect(
  THREE: Three,
  texture: TextureT,
  targetWidth: number,
): { texture: DataTextureT; owned: boolean } {
  const image = texture.image as { width: number; height: number; data: Uint16Array | Float32Array };
  const step = Math.max(1, Math.floor(image.width / targetWidth));
  if (step === 1) return { texture: texture as unknown as DataTextureT, owned: false };
  const w = Math.floor(image.width / step);
  const h = Math.floor(image.height / step);
  const Ctor = image.data.constructor as new (length: number) => Uint16Array | Float32Array;
  const out = new Ctor(w * h * 4);
  for (let r = 0; r < h; r++) {
    const srcRow = r * step * image.width * 4;
    const dstRow = r * w * 4;
    for (let col = 0; col < w; col++) {
      const s = srcRow + col * step * 4;
      out[dstRow + col * 4] = image.data[s] ?? 0;
      out[dstRow + col * 4 + 1] = image.data[s + 1] ?? 0;
      out[dstRow + col * 4 + 2] = image.data[s + 2] ?? 0;
      out[dstRow + col * 4 + 3] = image.data[s + 3] ?? 0;
    }
  }
  const copy = new THREE.DataTexture(
    out,
    w,
    h,
    THREE.RGBAFormat,
    image.data instanceof Float32Array ? THREE.FloatType : THREE.HalfFloatType,
  );
  copy.flipY = texture.flipY;
  copy.mapping = texture.mapping;
  copy.colorSpace = texture.colorSpace;
  copy.minFilter = THREE.LinearFilter;
  copy.magFilter = THREE.LinearFilter;
  copy.needsUpdate = true;
  return { texture: copy, owned: true };
}

/**
 * Default equirect loader: HDRLoader (three r186 ships it; RGBELoader is a
 * deprecated subclass) against the JSON's recorded source URL. HDRLoader
 * hands back a HalfFloatType DataTexture with flipY + linear filtering +
 * EquirectangularReflectionMapping already set.
 */
async function defaultLoadEquirect(THREE: Three, sky: SkyLighting): Promise<TextureT> {
  const { HDRLoader } = await import('three/examples/jsm/loaders/HDRLoader.js');
  const texture = (await new HDRLoader().loadAsync(sky.source.fileUrl)) as unknown as TextureT;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

export interface SkyRigRequest {
  /** Time-of-day preset; defaults to 'dusk' — the sun elevation closest to the unflagged SUN. */
  sky?: SkyName;
  /** Pre-decoded equirect (a bundled asset later, a DataTexture in tests). Skips the network load. */
  equirect?: TextureT | null;
  /** Equirect loader override — tests inject a stub so nothing hits the network. */
  loadEquirect?: (THREE: Three, sky: SkyLighting) => Promise<TextureT | null>;
}

/**
 * Builds the flagged rig: non-shadowing sun at the JSON direction, FogExp2 at
 * the measured horizon colour, and the dome material. HDR load + PMREM are
 * deferred to attachEnvironment so buildCityWorld stays synchronous — the
 * fallback dome renders from frame one while the HDR streams in.
 */
export function createSkyRig(THREE: Three, request: SkyRigRequest = {}) {
  const name = request.sky ?? 'dusk';
  const sky = SKY_PRESETS[name];
  assertSkyLighting(sky);
  const key = sunKeyLight(sky);

  const sunDirection = key.direction;
  const sun = new THREE.DirectionalLight(
    new THREE.Color(key.color[0], key.color[1], key.color[2]),
    key.intensity,
  );
  sun.position.set(sunDirection[0] * 1000, sunDirection[1] * 1000, sunDirection[2] * 1000);
  // react-native-webgpu renders black through shadow maps — stays off, same as
  // the unflagged sun (renderer.shadowMap.enabled = false in city-scene.ts).
  sun.castShadow = false;

  // Linear RGB straight from the JSON — Color(color) copies components as-is,
  // no colour-space encode (renderer runs linear, no output pass).
  const horizon = new THREE.Color(
    sky.horizonColor[0] ?? 0,
    sky.horizonColor[1] ?? 0,
    sky.horizonColor[2] ?? 0,
  );
  const fog = new THREE.FogExp2(horizon, FOG_DENSITY);

  let equirect: TextureT | null = request.equirect ?? null;
  let loadedEquirect: TextureT | null = null; // rig-owned: disposed by dispose()
  let environment: RenderTargetT | null = null;
  let disposed = false;
  const dome = createSkyDomeMaterial(THREE, sky, equirect);

  /** Swap the dome onto the texture path once an equirect exists. */
  const setEquirect = (texture: TextureT) => {
    equirect = texture;
    dome.colorNode = skyDomeColorNode(THREE, sky, texture);
    dome.needsUpdate = true;
  };

  /**
   * Async second stage — call once the renderer exists. Tries the HDR path
   * (fetch → half-float upload → PMREM); any failure keeps the fallback dome
   * and bakes the env equirect from the JSON instead. Returns true when a PMREM
   * environment actually landed on scene.environment.
   */
  const attachEnvironment = async (renderer: RendererT, scene: SceneT): Promise<boolean> => {
    if (!renderer || disposed) return false;
    if (environment) return true; // already attached — callers may retry after a failed attempt

    if (!equirect) {
      let loaded: TextureT | null = null;
      try {
        loaded = await (request.loadEquirect ?? defaultLoadEquirect)(THREE, sky);
      } catch {
        loaded = null; // HDR fetch/decode/upload pending on rn-webgpu — JSON dome stays
      }
      if (disposed) {
        loaded?.dispose();
        return false;
      }
      if (loaded) {
        loadedEquirect = loaded;
        setEquirect(loaded);
      }
    }

    // Env input: the HDR downsampled to 1k (→ PMREM 256 cube), else the baked
    // SH equirect — either way the env comes from this one sky asset.
    // Construction lives inside the try so a bake/downsample throw degrades
    // like every other stage instead of rejecting the whole promise.
    let envSource: { texture: TextureT; owned?: boolean } | null = null;
    try {
      envSource = equirect
        ? downsampleEquirect(THREE, equirect, SKY_RIG.envWidth)
        : { texture: bakeSkyEquirect(THREE, sky), owned: true };
      const pmrem = new THREE.PMREMGenerator(renderer);
      const rt = pmrem.fromEquirectangular(envSource.texture);
      pmrem.dispose();
      if (disposed) {
        rt.dispose();
        return false;
      }
      environment = rt;
      scene.environment = rt.texture;
      return true;
    } catch {
      return false; // PMREM needs an initialised WebGPU backend — device-pending
    } finally {
      if (envSource?.owned) envSource.texture.dispose();
    }
  };

  const dispose = () => {
    disposed = true;
    dome.dispose();
    loadedEquirect?.dispose();
    environment?.dispose();
    loadedEquirect = null;
    environment = null;
  };

  return {
    name,
    sky,
    sunDirection,
    sun,
    fog,
    horizon,
    dome,
    setEquirect,
    attachEnvironment,
    dispose,
    get equirect() {
      return equirect;
    },
    get environment() {
      return environment;
    },
  };
}

export type SkyRig = ReturnType<typeof createSkyRig>;
