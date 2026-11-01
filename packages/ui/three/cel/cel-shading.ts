// Ported from the dsts-viewer cel shader (nuffle.me/dsts-viewer), a recreation of Digimon Story: Time Stranger's body shader.
//
// The body path of the kit's fragment.glsl, term for term, as TypeGPU
// functions: the acos-wrapped toon-ramp coordinate, the order-2 SH ambient,
// the per-light ramp sum with the key-light self-shadow slide, the fresnel
// rim glow (curve A) and the global shadow floor. three.js runs them in the
// fragment shader through @typegpu/three (WGSL on WebGPU, GLSL on the WebGL2
// backend); the unit tests call the same functions on the CPU.
//
// The kit samples three textures this port has no source for, and each is
// replaced by a uniform with the maths around it unchanged:
// - uCLUT / uCLUTFill, the neutral and cool 1D toon ramps, become
//   `toonBandAtU`: a three-step ramp read at the same u, with the cool ramp
//   as the neutral ramp times a tint.
// - uSpecMap's alpha, the rim-glow mask, becomes 1.
// - getShadowMask() becomes an input (1 = lit): react-native-webgpu has no
//   shadow maps, so the slide and the floor are wired but idle.
import { d, std } from 'typegpu';

const ACOS_C0 = 1.5707288;
const ACOS_C1 = -0.2121144;
const ACOS_C2 = 0.0742611;
const ACOS_C3 = -0.0187293;
const TWO_OVER_PI = 0.6366197724;
export const INV_PI = 0.3183098862;
export const SH_L0 = 0.8862269254;
export const SH_L1 = 1.0233267546;
const SH_L2_CROSS = 0.8580855131;
const SH_L2_M0 = 0.247707963;
const SH_L2_M2 = 0.4290427567;
/** The engine's shadow floor: shadowed light bottoms out near half, never black. */
export const SHADOW_FLOOR = 0.498;
/** The ramp's shadow end, where the key's self-shadow slides the lookup. */
export const KEY_SHADOW_U = 0.005;

/** The kit's polynomial acos, accurate to about 7e-5 rad. */
export const acosApprox = (x: number): number => {
  'use gpu';
  const ax = std.abs(x);
  const s = std.sqrt(std.max(d.f32(0), 1 - ax));
  const p = ((ACOS_C3 * ax + ACOS_C2) * ax + ACOS_C1) * ax + ACOS_C0;
  const q = s * p;
  return std.select(q, 3.14159265 - q, x < 0);
};

/**
 * Toon-ramp coordinate from N.L: linear in the light's angle, so u = 0.5 at
 * the terminator, 0.995 facing the light and 0.005 facing away.
 */
export const toonRampU = (ndotl: number): number => {
  'use gpu';
  const wrap = 1 - acosApprox(std.clamp(ndotl, -1, 1)) * TWO_OVER_PI;
  return wrap * 0.495 + 0.5;
};

/**
 * Stand-in for the CLUT lookup at `u`. Packed inputs, four floats each:
 * - `ramp`: shadow/mid edge (u), mid/lit edge (u), half-width of each step (u), unused.
 * - `bands`: shadow, mid and lit levels, unused.
 * `tint` is (1, 1, 1) for the key's neutral ramp and the cool tint for the fills.
 */
export const toonBandAtU = (u: number, ramp: d.v4f, bands: d.v4f, tint: d.v3f): d.v3f => {
  'use gpu';
  const soft = std.max(ramp.z, 0.0001);
  const low = std.smoothstep(ramp.x - soft, ramp.x + soft, u);
  const high = std.smoothstep(ramp.y - soft, ramp.y + soft, u);
  const level = std.mix(std.mix(bands.x, bands.y, low), bands.z, high);
  return std.mul(tint, level);
};

export const toonBand = (ndotl: number, ramp: d.v4f, bands: d.v4f, tint: d.v3f): d.v3f => {
  'use gpu';
  return toonBandAtU(std.clamp(toonRampU(ndotl), 0, 1), ramp, bands, tint);
};

/** Order-2 spherical-harmonic ambient, in the kit's coefficient order and signs. */
export const evalSH9 = (
  n: d.v3f, sh0: d.v3f, sh1: d.v3f, sh2: d.v3f, sh3: d.v3f, sh4: d.v3f, sh5: d.v3f, sh6: d.v3f, sh7: d.v3f, sh8: d.v3f,
): d.v3f => {
  'use gpu';
  const l1 = std.neg(std.add(std.add(std.mul(sh3, n.x), std.mul(sh1, n.y)), std.mul(sh2, n.z)));
  const cross = std.add(std.add(std.mul(sh4, n.x * n.y), std.mul(sh5, n.y * n.z)), std.mul(sh7, n.x * n.z));
  let acc = std.mul(sh0, SH_L0);
  acc = std.add(acc, std.mul(l1, SH_L1));
  acc = std.add(acc, std.mul(cross, SH_L2_CROSS));
  acc = std.add(acc, std.mul(sh6, SH_L2_M0 * (3 * n.z * n.z - 1)));
  return std.add(acc, std.mul(sh8, SH_L2_M2 * (n.x * n.x - n.y * n.y)));
};

/** Fresnel rim glow, curve A. `base` is (exponent, scale, mode); mode 1 means a bias of -0.999. */
export const innerGrowA = (ndotv: number, base: d.v3f): number => {
  'use gpu';
  const fres = 1 - ndotv;
  const ratio = std.max(fres / (base.x * ndotv + fres), 0);
  const bias = std.select(-base.z, d.f32(-0.999), base.z === 1);
  const t = std.max(ratio * base.y + bias, 0);
  return std.clamp(t / (bias + 1), 0, 1);
};

/**
 * The lit body colour: SH ambient + toon-ramped key and two fills + rim +
 * flat fill, scaled by the shadow floor. Mirrors the kit's non-textured body
 * branch with uNumLights = 3, so its light loop is unrolled.
 *
 * - `albedo`: diffuse tint x base colour (the kit's base.rgb).
 * - `normal`, `toEye`: world normal and camera - surface, either length.
 * - `sh`: evalSH9 at the normalised normal, before the clamp.
 * - `key`: direction (to the light) and the self-shadow factor in w (1 = lit).
 * - `keyColor`, `fill1Color`, `fill2Color`: rgb, w unused. `fill1`, `fill2`: directions, w unused.
 * - `ramp`, `bands`: see toonBandAtU. `cool`: the fills' ramp tint, w unused.
 * - `rim`: rim colour and the glow-rim scale (0 = off). `rimBase`: innerGrowA's curve, w unused.
 * - `flatFill`: the flat fill add (rgb) and the SH scale (w).
 */
export const celBody = (
  albedo: d.v3f, normal: d.v3f, toEye: d.v3f, sh: d.v3f,
  key: d.v4f, keyColor: d.v4f, fill1: d.v4f, fill1Color: d.v4f, fill2: d.v4f, fill2Color: d.v4f,
  ramp: d.v4f, bands: d.v4f, cool: d.v4f, rim: d.v4f, rimBase: d.v4f, flatFill: d.v4f,
): d.v3f => {
  'use gpu';
  const n = std.normalize(normal);
  const v = std.normalize(toEye);
  const ndotv = std.max(std.dot(n, v), 0);
  const shadow = key.w;
  const ambient = std.mul(std.mul(std.max(sh, d.vec3f(0)), albedo), flatFill.w * INV_PI);

  // Key on the neutral ramp; its self-shadow slides the lookup toward the
  // ramp's shadow end instead of scaling the light. Fills on the cool ramp,
  // unshadowed.
  const neutral = d.vec3f(1, 1, 1);
  const keyShadowBand = toonBandAtU(KEY_SHADOW_U, ramp, bands, neutral);
  const keyBand = std.mix(keyShadowBand, toonBand(std.dot(n, std.normalize(key.xyz)), ramp, bands, neutral), shadow);
  const fill1Band = toonBand(std.dot(n, std.normalize(fill1.xyz)), ramp, bands, cool.xyz);
  const fill2Band = toonBand(std.dot(n, std.normalize(fill2.xyz)), ramp, bands, cool.xyz);
  let lightAccum = std.mul(keyColor.xyz, keyBand);
  lightAccum = std.add(lightAccum, std.mul(fill1Color.xyz, fill1Band));
  lightAccum = std.add(lightAccum, std.mul(fill2Color.xyz, fill2Band));
  // The rim takes the ungated light colours, so it stays lit at the
  // silhouette where N.L goes to zero.
  const rimTint = std.add(std.add(keyColor.xyz, fill1Color.xyz), fill2Color.xyz);
  const direct = std.mul(albedo, lightAccum);

  const rimMask = d.f32(1);
  const glow = std.mul(std.mul(rim.xyz, rim.w * innerGrowA(ndotv, rimBase.xyz) * rimMask), rimTint);
  const color = std.add(std.add(std.add(ambient, direct), glow), flatFill.xyz);
  return std.max(std.mul(color, std.mix(d.f32(SHADOW_FLOOR), d.f32(1), shadow)), d.vec3f(0));
};

type Vec3 = readonly [number, number, number];

/**
 * The dsts-viewer studio rig: a warm key on the neutral ramp, two cool fills
 * and a flat SH ambient (sh0 = 0.55). Directions point at the light.
 */
export const DSTS_DEFAULT_RIG = {
  key: { dir: [0.35, 0.8, 0.5], color: [1.0, 0.98, 0.95] },
  fill1: { dir: [-0.7, 0.25, -0.4], color: [0.35, 0.37, 0.42] },
  fill2: { dir: [0.0, -0.3, -1.0], color: [0.2, 0.2, 0.24] },
  shL0: 0.55,
} as const;

/**
 * The studio rig turned about the vertical so its key sits at `sun`'s
 * azimuth with `sun`'s elevation; the fills keep their own elevation and
 * their azimuth relative to the key.
 */
export function rigAroundSun(sun: Vec3): { key: Vec3; fill1: Vec3; fill2: Vec3 } {
  const unit = (v: Vec3): Vec3 => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const k = DSTS_DEFAULT_RIG.key.dir;
  const turn = Math.atan2(sun[2], sun[0]) - Math.atan2(k[2], k[0]);
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  // Turning by +turn about y in the x-z plane, counter to atan2(z, x).
  const rotate = (v: Vec3): Vec3 => unit([v[0] * c - v[2] * s, v[1], v[0] * s + v[2] * c]);
  return { key: unit(sun), fill1: rotate(DSTS_DEFAULT_RIG.fill1.dir), fill2: rotate(DSTS_DEFAULT_RIG.fill2.dir) };
}

/**
 * Nine SH coefficients for a sky/ground hemisphere: evalSH9 / pi gives
 * `level * sky` straight up and `level * ground` straight down (y is up).
 * Only sh0 and sh1 are non-zero.
 */
export function hemisphereSH(sky: Vec3, ground: Vec3, level: number): [number, number, number][] {
  const out: [number, number, number][] = Array.from({ length: 9 }, () => [0, 0, 0]);
  for (let i = 0; i < 3; i++) {
    out[0]![i] = (Math.PI * level * (sky[i]! + ground[i]!)) / (2 * SH_L0);
    // L1 is -(n.y * sh1), so a brighter sky needs a negative sh1.
    out[1]![i] = (Math.PI * level * (ground[i]! - sky[i]!)) / (2 * SH_L1);
  }
  return out;
}
