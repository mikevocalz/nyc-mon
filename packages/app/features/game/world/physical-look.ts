// Adapted from mrdoob/slop-newyork @ be65d0a, js/lighting.js TIME_PRESETS and LightingSystem,
// js/post-processing.js LOOKS and createPostProcessing, js/main.js initApp (MIT, © 2026 Mr.doob).
// Slop builds on three.js's SkyMesh (Preetham sky with clouds), SunLight and
// ClusteredLighting addons; the values here are the numbers it feeds them.
//
// The physically lit city's constants and its two env switches. Pure: no
// three import, so node tests pin every value, and the render runtime can
// read the flags without loading three.
//
// - EXPO_PUBLIC_WORLD_PHYSICAL: the master flag, default ON. Set it to
//   0/false/off/no to fall back to the old look; with it off nothing in
//   this module changes a frame.
// - EXPO_PUBLIC_WORLD_PROBE=<name>: Phase 0, read only under
//   EXPO_PUBLIC_WORLD_PHYSICAL. Turns on one feature of the physical stack,
//   alone, over today's look, so a black frame on hardware points at that
//   one feature. See physicalFeaturesFor.
//
// Colours are not here: they live in @acme/theme physicalCityLight.
// "Slop measured" marks a value copied from Slop; TODO(tune) marks a value
// nyc-mon chose that still needs an iPhone 17 / iPad Pro frame.
import { parseDefaultOnFlag } from './sky-rig.ts';

/** Master flag, default on; EXPO_PUBLIC_WORLD_PHYSICAL=0 is the kill switch. */
export const EXPERIMENTAL_WORLD_PHYSICAL = parseDefaultOnFlag(process.env.EXPO_PUBLIC_WORLD_PHYSICAL);

// ---- Phase 0 probes ---------------------------------------------------------

/** Probes this lane implements on the Harlem tile. */
export const RIG_PROBES = [
  'srgb', 'aces', 'shadow1', 'shadow2', 'bgnull', 'pmrem', 'mrt', 'ssr', 'bloom', 'clustered', 'storage', 'msaa',
] as const;
/** Probes the shared-device lane implements; accepted here so one env var names every probe. */
export const DEVICE_LANE_PROBES = ['shared', 'skiatex', 'pipecache'] as const;

export type RigProbe = (typeof RIG_PROBES)[number];
export type DeviceLaneProbe = (typeof DEVICE_LANE_PROBES)[number];
export type WorldProbe = RigProbe | DeviceLaneProbe;

/** Exact probe names, case- and space-insensitive; anything else is null (no probe). */
export function parseWorldProbe(value: string | undefined | null): WorldProbe | null {
  const v = value?.trim().toLowerCase();
  if (!v) return null;
  return (RIG_PROBES as readonly string[]).includes(v) || (DEVICE_LANE_PROBES as readonly string[]).includes(v)
    ? (v as WorldProbe)
    : null;
}

export function isDeviceLaneProbe(probe: WorldProbe | null): probe is DeviceLaneProbe {
  return probe !== null && (DEVICE_LANE_PROBES as readonly string[]).includes(probe);
}

/**
 * A probe counts only under the master flag, for the rig probes and the
 * device-lane ones alike: EXPO_PUBLIC_WORLD_PROBE alone changes nothing.
 */
export function activeWorldProbe(physical: boolean, probe: WorldProbe | null): WorldProbe | null {
  return physical ? probe : null;
}

/** The active probe, inlined at bundle time; null when unset or without EXPO_PUBLIC_WORLD_PHYSICAL. */
export const WORLD_PROBE: WorldProbe | null = activeWorldProbe(
  EXPERIMENTAL_WORLD_PHYSICAL,
  parseWorldProbe(process.env.EXPO_PUBLIC_WORLD_PROBE),
);

/**
 * The shared-device lane's probe (shared, skiatex, pipecache); null for a rig
 * probe or none. Here rather than in render-runtime/device-probes.ts so a
 * caller can test it without loading the probes.
 */
export const WORLD_DEVICE_PROBE: DeviceLaneProbe | null = isDeviceLaneProbe(WORLD_PROBE) ? WORLD_PROBE : null;

/**
 * Which pieces of the physical stack a scene mounts. With the flag off,
 * `physicalFeaturesFor` returns null and city-scene runs today's
 * path untouched.
 */
export interface PhysicalFeatures {
  /** renderer.outputColorSpace = SRGBColorSpace. */
  srgbOutput: boolean;
  /** Mount the RenderPipeline with ACESFilmicToneMapping (one ACES, one output conversion). */
  pipeline: boolean;
  /** 0 none; 1 a DirectionalLight with one shadow map; 2 SunLight's two cascades. */
  sunShadow: 0 | 1 | 2;
  /** Put a Color on scene.background (the bgnull probe's failure case); otherwise it stays null. */
  colorBackground: boolean;
  /** SkyMesh in the scene and baked to PMREM as scene.environment, with the aerial fog node. */
  skyPmrem: boolean;
  /** HemisphereLight fill per preset. */
  hemisphere: boolean;
  /** Scene pass writes output + normalView + metalRough. Needs `pipeline`. */
  mrt: boolean;
  /** Screen-space reflections from the MRT. Needs `mrt`. */
  ssr: boolean;
  /** Peak-limited bloom. Needs `pipeline`. */
  bloom: boolean;
  /** Slop's grade: exposure, white balance, split-tone, contrast, saturation, vibrance, vignette. Needs `pipeline`. */
  grade: boolean;
  /** renderer.lighting = ClusteredLighting. */
  clustered: boolean;
  /** InstancedMesh.instanceMatrix becomes a StorageInstancedBufferAttribute (WebGPU backend only). */
  storage: boolean;
  /** scenePass.renderTarget.storeMultisampledColorBuffer = false. Needs `pipeline`. */
  msaaDiscard: boolean;
  /** Use the PBR city materials so the rig has surfaces to light. */
  pbrMaterials: boolean;
}

const NONE: PhysicalFeatures = {
  srgbOutput: false, pipeline: false, sunShadow: 0, colorBackground: false, skyPmrem: false, hemisphere: false,
  mrt: false, ssr: false, bloom: false, grade: false, clustered: false, storage: false, msaaDiscard: false,
  pbrMaterials: false,
};

/** Every piece on: the EXPO_PUBLIC_WORLD_PHYSICAL stack. SSR follows the tier (§5.7: off first on the phone). */
export function fullPhysicalFeatures(ssr: boolean): PhysicalFeatures {
  return {
    srgbOutput: true, pipeline: true, sunShadow: 2, colorBackground: false, skyPmrem: true, hemisphere: true,
    mrt: true, ssr, bloom: true, grade: true, clustered: true, storage: true, msaaDiscard: true, pbrMaterials: true,
  };
}

/**
 * One probe, one feature, plus only what it cannot run without. `bgnull`
 * is shadow2 with a Color background: compare it against the shadow2
 * capture, which keeps the background null. Device-lane probes mount
 * nothing here; that lane hooks in through city-scene's probe hook.
 */
export function probeFeatures(probe: WorldProbe): PhysicalFeatures {
  switch (probe) {
    case 'srgb': return { ...NONE, srgbOutput: true };
    case 'aces': return { ...NONE, pipeline: true };
    case 'shadow1': return { ...NONE, sunShadow: 1 };
    case 'shadow2': return { ...NONE, sunShadow: 2 };
    case 'bgnull': return { ...NONE, sunShadow: 2, colorBackground: true };
    case 'pmrem': return { ...NONE, skyPmrem: true };
    case 'mrt': return { ...NONE, pipeline: true, mrt: true };
    case 'ssr': return { ...NONE, pipeline: true, mrt: true, ssr: true };
    case 'bloom': return { ...NONE, pipeline: true, bloom: true };
    case 'clustered': return { ...NONE, clustered: true };
    case 'storage': return { ...NONE, storage: true };
    case 'msaa': return { ...NONE, pipeline: true, msaaDiscard: true };
    case 'shared':
    case 'skiatex':
    case 'pipecache':
      return { ...NONE };
  }
}

/**
 * The feature set for a scene. Nothing mounts without the master flag,
 * probe or not. Under the flag a probe wins over the full stack, so a probe
 * build measures one feature. Null means today's path.
 */
export function physicalFeaturesFor(
  physical: boolean,
  probe: WorldProbe | null,
  tierSsr: boolean,
): PhysicalFeatures | null {
  if (!physical) return null;
  return probe !== null ? probeFeatures(probe) : fullPhysicalFeatures(tierSsr);
}

/**
 * Extra WebGPURenderer constructor parameters, spread where the renderer is
 * built (packages/ui/three/surface.native.tsx and surface.web.tsx on the JS
 * path, render-runtime/game-render.ts on the worklet path). js/main.js
 * constructs with `reversedDepthBuffer: true`; three r186 reads it in the
 * Renderer constructor (build/three.webgpu.js, `this.reversedDepthBuffer =
 * reversedDepthBuffer`), so it cannot be switched on after construction.
 * Only the full stack asks for it: a probe keeps today's depth buffer so it
 * isolates its own feature. Empty with the flag off.
 */
export function physicalRendererParams(
  physical: boolean = EXPERIMENTAL_WORLD_PHYSICAL,
  probe: WorldProbe | null = WORLD_PROBE,
): { reversedDepthBuffer?: true } {
  return physical && probe === null ? { reversedDepthBuffer: true } : {};
}

// ---- Time-of-day presets (numbers; colours are tokens) ----------------------

export const PHYSICAL_PRESET_IDS = ['golden', 'midday', 'twilight', 'midnight'] as const;
export type PhysicalPresetId = (typeof PHYSICAL_PRESET_IDS)[number];
/** G2 default: closest to D17's canon dusk. */
export const DEFAULT_PHYSICAL_PRESET: PhysicalPresetId = 'twilight';

export function parsePhysicalPreset(value: string | undefined | null): PhysicalPresetId {
  const v = value?.trim().toLowerCase();
  return (PHYSICAL_PRESET_IDS as readonly string[]).includes(v ?? '') ? (v as PhysicalPresetId) : DEFAULT_PHYSICAL_PRESET;
}

export interface PhysicalLightNumbers {
  /** Direction toward the sun (moon at midnight), unnormalised as Slop writes it; scene axes. */
  sunDir: readonly [number, number, number];
  /** SunLight intensity, three.js physical units (lux-scaled). Slop measured. */
  sunIntensity: number;
  /** HemisphereLight intensity. Slop measured. */
  hemiIntensity: number;
  /** Aerial haze density, 1/m. Slop measured. */
  fogDensity: number;
  /** cityUniforms.uInteriorGlow, 0..~1.6 multiplier on lit rooms. Slop measured. */
  interiorGlow: number;
  /** cityUniforms.uRoadWetness, 0..1. Slop measured. */
  roadWetness: number;
  /** scene.environmentIntensity. Slop measured. */
  envIntensity: number;
  /** cityUniforms.uCanyonBounce, 0..1. Slop measured. */
  canyonBounce: number;
  /** SkyMesh Preetham inputs. Slop measured. */
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  cloudCoverage: number;
  cloudDensity: number;
  /** Scale on SkyMesh raw radiance (EE 1000 x 0.04) into the exposure-1 range. Slop measured. */
  skyExposure: number;
  /** Mix of the sky toward physicalCityLight.nightSky, 0..1. Slop measured. */
  nightFactor: number;
}

/** js/lighting.js TIME_PRESETS, numeric fields. Slop measured, every one. */
export const PHYSICAL_LIGHT: Record<PhysicalPresetId, PhysicalLightNumbers> = {
  golden: {
    sunDir: [-0.44, 0.58, -0.68], sunIntensity: 5.8, hemiIntensity: 1.48, fogDensity: 0.00024,
    interiorGlow: 0.48, roadWetness: 0.28, envIntensity: 0.54, canyonBounce: 0.52,
    turbidity: 8.0, rayleigh: 2.8, mieCoefficient: 0.008, mieDirectionalG: 0.88,
    cloudCoverage: 0.36, cloudDensity: 0.38, skyExposure: 0.148, nightFactor: 0.0,
  },
  midday: {
    sunDir: [-0.34, 0.82, -0.46], sunIntensity: 6.6, hemiIntensity: 1.58, fogDensity: 0.00018,
    interiorGlow: 0.24, roadWetness: 0.08, envIntensity: 0.58, canyonBounce: 0.58,
    turbidity: 6.5, rayleigh: 2.4, mieCoefficient: 0.006, mieDirectionalG: 0.86,
    cloudCoverage: 0.32, cloudDensity: 0.35, skyExposure: 0.142, nightFactor: 0.0,
  },
  twilight: {
    sunDir: [-0.52, 0.36, -0.77], sunIntensity: 3.1, hemiIntensity: 0.85, fogDensity: 0.00032,
    interiorGlow: 1.25, roadWetness: 0.55, envIntensity: 0.36, canyonBounce: 0.32,
    turbidity: 9.5, rayleigh: 3.4, mieCoefficient: 0.010, mieDirectionalG: 0.90,
    cloudCoverage: 0.40, cloudDensity: 0.42, skyExposure: 0.115, nightFactor: 0.28,
  },
  midnight: {
    sunDir: [0.42, 0.68, -0.60], sunIntensity: 1.45, hemiIntensity: 0.72, fogDensity: 0.00036,
    interiorGlow: 1.55, roadWetness: 0.62, envIntensity: 0.30, canyonBounce: 0.18,
    turbidity: 4.0, rayleigh: 1.5, mieCoefficient: 0.004, mieDirectionalG: 0.80,
    cloudCoverage: 0.22, cloudDensity: 0.25, skyExposure: 0.022, nightFactor: 0.86,
  },
};

export interface PhysicalGradeNumbers {
  /** Scene-linear exposure multiplier applied before bloom. Slop measured. */
  exposure: number;
  /** Contrast exponent around the 0.18 pivot. Slop measured. */
  contrast: number;
  saturation: number;
  /** Per-channel white balance multiplier. Slop measured. */
  balance: readonly [number, number, number];
  /** BloomNode strength and threshold. Slop measured. */
  bloom: number;
  threshold: number;
}

/** js/post-processing.js LOOKS. Slop measured, every one. */
export const PHYSICAL_GRADE: Record<PhysicalPresetId, PhysicalGradeNumbers> = {
  golden: { exposure: 1.04, contrast: 1.12, saturation: 1.08, balance: [1.045, 1.0, 0.955], bloom: 0.24, threshold: 1.20 },
  midday: { exposure: 1.0, contrast: 1.10, saturation: 1.06, balance: [1.015, 1.0, 0.985], bloom: 0.18, threshold: 1.35 },
  twilight: { exposure: 1.06, contrast: 1.10, saturation: 1.08, balance: [1.025, 0.995, 1.015], bloom: 0.28, threshold: 1.05 },
  midnight: { exposure: 1.04, contrast: 1.08, saturation: 1.06, balance: [0.985, 1.0, 1.035], bloom: 0.30, threshold: 1.00 },
};

// ---- Rig constants -----------------------------------------------------------

/** js/lighting.js LightingSystem constructor and update(). */
export const PHYSICAL_RIG = {
  /** SkyMesh scale, metres. Slop measured (sized for 13.6 km of Manhattan; the Harlem tile fits inside). */
  skyScale: 200_000,
  /** SkyMesh cloud inputs. Slop measured. */
  cloudScale: 0.00018,
  cloudSpeed: 0.000015,
  cloudElevation: 0.52,
  /** Aerial haze scale height, metres. Slop measured. */
  fogHeight: 900,
  /** Lowest view elevation the fog samples the sky at, so it never reads the ground half. Slop measured. */
  fogHorizonMinY: 0.015,
  /** PMREM roughness level the fog samples. Slop measured. */
  fogPmremLevel: 0.3,
  /** PMREMGenerator.fromScene sigma, near, far (metres). Slop measured. */
  pmremSigma: 0,
  pmremNear: 0.1,
  pmremFar: 100,
  /** Sun shadow camera near, metres. Slop measured. */
  shadowNear: 0.5,
  /** Shadow far plane = clamp(base + altitude x slope, min, max), metres. Slop measured. */
  shadowFarMin: 300,
  shadowFarMax: 720,
  shadowFarBase: 260,
  shadowFarPerAltitude: 1.6,
  /** Shadow normal bias, world metres. Slop measured. */
  normalBias: 0.05,
  /** Fallback when the device limit is unreadable; Slop's default. */
  maxTextureFallback: 4096,
  /** HemisphereLight height, metres (direction only matters). Slop measured. */
  hemiHeight: 300,
  /** ClusteredLighting cluster tile (px), depth slices and per-cluster list size; Slop passes (256, 32, 28, 48). Slop measured. */
  clusterTileSize: 32,
  clusterZSlices: 28,
  clusterMaxPerCluster: 48,
  /** shadow1 probe: one DirectionalLight map over a caller-centred box, half-size metres. TODO(tune). */
  singleShadowHalf: 150,
  /** shadow1 probe: sun distance from the focus, metres. TODO(tune). */
  singleShadowDistance: 400,
} as const;

/** Shadow far plane for the camera's altitude (LightingSystem.update). */
export function shadowFarForAltitude(altitude: number): number {
  const a = Number.isFinite(altitude) ? Math.max(0, altitude) : 0;
  const r = PHYSICAL_RIG;
  return Math.max(r.shadowFarMin, Math.min(r.shadowFarMax, r.shadowFarBase + a * r.shadowFarPerAltitude));
}

/**
 * Per-cascade tile size. Slop: 3072 when the 2-tile atlas (6144) fits the
 * device's maxTextureDimension2D, else 2048. The tier caps it from above.
 */
export function sunShadowTile(tierTile: number, maxTextureDimension2D: number | undefined): number {
  const maxTex = typeof maxTextureDimension2D === 'number' && maxTextureDimension2D > 0
    ? maxTextureDimension2D
    : PHYSICAL_RIG.maxTextureFallback;
  const slop = maxTex >= 6144 ? 3072 : 2048;
  return Math.min(tierTile, slop);
}

// ---- Output and post (js/main.js, js/post-processing.js) ----------------------

export const PHYSICAL_POST = {
  /** SSR runs only where roughness is below this. Slop measured. */
  maxSsrRoughness: 0.75,
  /** The reflection mask fades from maxSsrRoughness down to this roughness. Slop measured. */
  ssrMaskRoughness: 0.55,
  /** Metalness fades out between these view distances, metres (near, far). Slop measured. */
  ssrFadeNear: 180,
  ssrFadeFar: 360,
  /** SSRNode settings. Slop measured. */
  ssrMaxDistance: 42,
  ssrThickness: 0.85,
  ssrIntensity: 0.5,
  ssrBlurQuality: 1,
  /** Bloom input is scaled so its brightest channel never exceeds this. Slop measured. */
  bloomPeak: 8,
  bloomRadius: 0.4,
  bloomSmoothWidth: 0.3,
  /** Rec. 709 luma weights. */
  luma: [0.2126, 0.7152, 0.0722] as const,
  /** Split-tone: cool shadows fade out over this luma band, warm highlights fade in over the next. Slop measured. */
  shadowTint: [0.965, 1.005, 1.045] as const,
  shadowBand: [0.02, 0.6] as const,
  highlightTint: [1.035, 1.005, 0.965] as const,
  highlightBand: [0.6, 3.0] as const,
  /** Contrast pivot: 18% grey. Slop measured. */
  contrastPivot: 0.18,
  /** Vibrance boost on low-chroma pixels. Slop measured. */
  vibrance: 0.1,
  /** Vignette over the aspect-normalised corner radius. Slop measured. */
  vignetteInner: 0.35,
  vignetteOuter: 1.0,
  vignetteStrength: 0.12,
} as const;

/** One preset's grade plus the tier's SSR and bloom picks: what the post mount needs. */
export interface PhysicalPostSettings {
  look: PhysicalGradeNumbers;
  /** SSR resolution and quality; null when the tier runs without SSR. */
  ssr: { resolutionScale: number; quality: number; binaryRefine: boolean } | null;
  bloomResolutionScale: number;
}
