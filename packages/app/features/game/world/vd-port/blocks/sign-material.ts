// Valdrada city/fk/signKit.js @2724c7938f20e068748ad1fd66e907d2bc662e3e (MIT).
// Exact SG face/glow/shade/halo/dust terms. Texture sampling, render state,
// common LT/ST34 and material/variant tables remain the scene bank's ownership.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';

type F = Node<'float'>;
type V2 = Node<'vec2'>;
type V3 = Node<'vec3'>;
type V4 = Node<'vec4'>;
type Triple<S> = readonly [S, S, S];
type Pair<S> = readonly [S, S];
type Quad<S> = readonly [S, S, S, S];

export const SIGN_OUTPUT_STAGE = { domain: 'linear-hdr', stage: 'before-fog', basis: 'source ScenePrePass regularRT; OutputPass later' } as const;

export const SIGN_SOURCE_PIN = '2724c7938f20e068748ad1fd66e907d2bc662e3e';
export const SIGN_SOURCE_SHA256 = '9736faa6153bf9b4f21b8c5e2e10ef9c5316ef89a557f2967c9568d3c122ee46';
/** Actual expanded source shader hashes from the 175-structure census; unknown programs must not become a generic sign. */
export const SIGN_SOURCE_PROGRAMS = {
  ar33sg3Md: '7bb98467', ar33sg3Ml: 'fe98b3e3', ar33sg3Fd: '5668f93b', ar33sg3Fl: 'fb4dcb86',
  ar33sgDu: '9eb838cb', ar33sgG: '66bd388e', ar33sgS3: '3a8efa79', ar33sgH: 'b7cc64a9',
} as const;

/** Validate the expanded source program, not only its user-visible material name. */
export function sourceSignProgram(key: string, hash: string): keyof typeof SIGN_SOURCE_PROGRAMS {
  const suffix = key.slice(key.lastIndexOf('|') + 1) as keyof typeof SIGN_SOURCE_PROGRAMS;
  if (!Object.hasOwn(SIGN_SOURCE_PROGRAMS, suffix) || SIGN_SOURCE_PROGRAMS[suffix] !== hash) throw new Error(`Unsupported authored sign program: ${key} (${hash})`);
  return suffix;
}

interface MathOps<S> {
  n(value: number): S;
  add(a: S, b: S): S;
  sub(a: S, b: S): S;
  mul(a: S, b: S): S;
  div(a: S, b: S): S;
  min(a: S, b: S): S;
  max(a: S, b: S): S;
  cos(a: S): S;
  mix(a: S, b: S, t: S): S;
  smooth(a: number, b: number, value: S): S;
  positive(value: S, yes: S, no: S): S;
}
function nodeMath(THREE: Three): MathOps<F> {
  const T = THREE.TSL;
  return {
    n: (value) => T.float(value), add: (a, b) => a.add(b), sub: (a, b) => a.sub(b), mul: (a, b) => a.mul(b), div: (a, b) => a.div(b),
    min: (a, b) => T.min(a, b), max: (a, b) => T.max(a, b), cos: (value) => T.cos(value), mix: (a, b, t) => T.mix(a, b, t),
    // The source deliberately uses reversed smoothstep edges for bottom grime.
    // Explicit Hermite arithmetic retains its intent on Metal, where reversed builtin edges are undefined.
    smooth: (a, b, value) => { const t = T.clamp(value.sub(a).div(b - a), 0, 1); return t.mul(t).mul(T.float(3).sub(t.mul(2))); },
    positive: (value, yes, no) => T.select(value.greaterThan(0), yes, no),
  };
}
const numberMath: MathOps<number> = {
  n: (x) => x, add: (a, b) => a + b, sub: (a, b) => a - b, mul: (a, b) => a * b, div: (a, b) => a / b,
  min: Math.min, max: Math.max, cos: Math.cos, mix: (a, b, t) => a * (1 - t) + b * t,
  smooth: (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); },
  positive: (value, yes, no) => value > 0 ? yes : no,
};
function on<S>(m: MathOps<S>, night: S): S { return m.smooth(0.12, 0.55, night); }
function saturation<S>(m: MathOps<S>, color: Triple<S>, amount: S): S {
  const sum = m.add(m.add(color[0], color[1]), color[2]);
  const redShare = m.positive(m.sub(sum, m.n(1e-4)), m.div(color[0], m.max(sum, m.n(1e-4))), m.n(0));
  return m.sub(m.n(1), m.mul(amount, m.smooth(0.5, 0.9, redShare)));
}
function falloff<S>(m: MathOps<S>, uv: Pair<S>, f: Triple<S>): S {
  const ex = m.mul(m.min(uv[0], m.sub(m.n(1), uv[0])), f[1]);
  const ey = m.min(uv[1], m.sub(m.n(1), uv[1]));
  const edge = m.smooth(0, 0.3, m.min(ex, ey));
  const rows = m.add(m.n(0.5), m.mul(m.n(0.5), m.cos(m.mul(m.sub(m.mul(uv[1], f[2]), m.n(0.5)), m.n(6.2832)))));
  const lit = m.mul(m.mul(m.add(m.n(0.58), m.mul(m.n(0.42), edge)), m.add(m.n(0.86), m.mul(m.n(0.14), rows))), m.n(1.12));
  return m.positive(f[0], m.mix(m.n(1), lit, f[0]), m.n(1));
}
interface FaceValues<S> {
  color: Triple<S>; opacity: S; sample: Quad<S>; uv: Pair<S>;
  bg: Triple<S>; fg: Triple<S>; lamp: Triple<S>; p: Quad<S>; f: Quad<S>; night: S; saturation: S;
}
function face<S>(m: MathOps<S>, input: FaceValues<S>, mask: boolean, decal: boolean) {
  const { color, opacity, sample, uv, bg, fg, lamp, p, f, night } = input;
  const coverage = mask ? sample[0] : sample[3];
  const ink = [0, 1, 2].map((c) => mask ? m.mix(bg[c]!, fg[c]!, coverage) : sample[c]!) as unknown as Triple<S>;
  const grime = mask ? m.sub(m.n(1), m.mul(p[1], m.add(m.mul(m.smooth(0.3, 0, uv[1]), m.n(0.8)), m.mul(m.smooth(0.86, 1, uv[1]), m.n(0.45))))) : m.n(1);
  const glowColor = [0, 1, 2].map((c) => mask ? m.mix(m.mul(fg[c]!, coverage), ink[c]!, p[0]) : m.mul(ink[c]!, coverage)) as unknown as Triple<S>;
  const satColor = [0, 1, 2].map((c) => mask ? m.mix(fg[c]!, ink[c]!, p[0]) : ink[c]!) as unknown as Triple<S>;
  const gain = m.mul(m.mul(m.max(on(m, night), p[2]), falloff(m, uv, [f[0], f[1], f[2]])), saturation(m, satColor, input.saturation));
  return {
    color: [0, 1, 2].map((c) => m.mul(m.mul(color[c]!, ink[c]!), grime)) as unknown as Triple<S>,
    opacity: decal ? m.mul(opacity, coverage) : opacity,
    emission: [0, 1, 2].map((c) => m.mul(m.mul(glowColor[c]!, lamp[c]!), gain)) as unknown as Triple<S>,
    roughness: p[3], metalness: f[3],
  };
}

/** Decoded source variant fields. These are flat rows validated constant at every triangle corner by the baker/codec. */
export interface SignVariantNodes {
  rect: V4; bg: V3; fg: V3; lamp: V3; p: V4; f: V4;
}
export interface SignFaceInput {
  color: V3; opacity: F; night: F; saturation: F;
  /** Original vertex UV before mapTransform. */
  uv: V2;
  /** Source vMapUv after its mapTransform; grime and lamp falloff use this frame. */
  mapUv: V2;
  variant: SignVariantNodes;
  /** Exact source sampler/color space. Atlas UV is supplied explicitly; do not apply mapTransform again. */
  sampleAtlas(uv: V2): V4;
}
/** Diffuse/alpha and additional emission only. Apply source LT/ST34 separately; keep the source render state and alphaTest. */
export function signFaceNodes(THREE: Three, input: SignFaceInput, mask: boolean, decal: boolean) {
  const T = THREE.TSL, v = input.variant;
  const atlasUv = v.rect.xy.add(input.uv.mul(v.rect.zw)) as V2;
  const sample = input.sampleAtlas(atlasUv);
  const result = face(nodeMath(THREE), {
    color: [input.color.r, input.color.g, input.color.b], opacity: input.opacity, sample: [sample.r, sample.g, sample.b, sample.a], uv: [input.mapUv.x, input.mapUv.y],
    bg: [v.bg.r, v.bg.g, v.bg.b], fg: [v.fg.r, v.fg.g, v.fg.b], lamp: [v.lamp.r, v.lamp.g, v.lamp.b], p: [v.p.x, v.p.y, v.p.z, v.p.w], f: [v.f.x, v.f.y, v.f.z, v.f.w], night: input.night, saturation: input.saturation,
  }, mask, decal);
  return { color: T.vec3(...result.color), opacity: result.opacity, emission: T.vec3(...result.emission), roughness: result.roughness, metalness: result.metalness, atlasUv };
}

/** Source ar33sgG; Gvc uses the same terms with variant.lamp, p.x and p.y. */
export function signGlowNodes(THREE: Three, color: V3, emission: V3, night: F, day: F, nightDiffuse: F) {
  const T = THREE.TSL, lit = T.smoothstep(0.12, 0.55, night);
  return { color: color.mul(T.mix(1, nightDiffuse, lit)) as V3, emission: emission.mul(T.max(lit, day)) as V3 };
}
/** Source ar33sgDu: settled dust modifies diffuse and roughness, not emission. normalUp is the final shaded normal's world-up dot. */
export function signDustNodes(THREE: Three, color: V3, roughness: F, normalUp: F) {
  const T = THREE.TSL, amount = T.smoothstep(0.5, 0.92, normalUp).mul(0.42);
  return { color: T.mix(color, T.vec3(0.15, 0.138, 0.12), amount) as V3, roughness: T.mix(roughness, 0.86, amount) as F };
}
/** Source ar33sgS3 overrides final RGBA with premultiplied shadow/spill terms. Keep its custom blend factors and fog=false. */
export function signShadeOutput(THREE: Three, sampled: V4, lamp: V3, shade: F, night: F): V4 {
  const T = THREE.TSL, lit = T.smoothstep(0.12, 0.55, night);
  return T.vec4(lamp.mul(sampled.g).mul(lit), sampled.r.mul(shade).mul(T.float(1).sub(lit.mul(0.6)))) as V4;
}
/** Source ar33sgH changes RGB only; alpha and additive render state remain authored. */
export function signHaloOutput(THREE: Three, output: V4, gain: F, night: F): V4 {
  const T = THREE.TSL;
  return T.vec4(output.rgb.mul(gain).mul(T.smoothstep(0.12, 0.55, night)), output.a) as V4;
}
/** Source EASE hook: apply to the lit output BEFORE fog, in linear HDR for the source ScenePrePass regular render target, never to albedo.
 * Direct-to-screen source diagnostics use a different color domain and are not this gameplay contract. */
export function signEaseOutput(THREE: Three, output: V4, night: F): V4 {
  const T = THREE.TSL;
  const peak = T.max(output.r, T.max(output.g, output.b));
  const excess = T.max(peak.sub(1), 0);
  const compress = T.min(1, T.float(1).add(excess.div(T.float(1).add(excess.mul(1.5)))).div(T.max(peak, 1e-4)));
  return T.vec4(output.rgb.mul(T.mix(1, compress, T.smoothstep(0.12, 0.55, night))), output.a) as V4;
}

/** Numeric execution of the same face expression graph, used to compare sampled source RGBA/coverage behavior. */
export function evaluateSignFace(input: FaceValues<number>, mask: boolean, decal: boolean) { return face(numberMath, input, mask, decal); }
export function evaluateSignFalloff(uv: Pair<number>, f: Triple<number>): number { return falloff(numberMath, uv, f); }
export function evaluateSignSaturation(color: Triple<number>, amount: number): number { return saturation(numberMath, color, amount); }
