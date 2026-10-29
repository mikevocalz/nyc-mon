// Valdrada's viaduct materials (client/src/city/vk/vkMats.js @ 2724c79, MIT) as three r186 TSL node materials, built
// from the descriptors tooling/city/vd-port/describe-vk.mjs reads off Valdrada's live materials.
//
//   vkSteel   steelMat (L179-L210), program "vkSteel8": rivet heads, bevelled arrises, the patchy repaint, rust (chips,
//             joints, run streaks, pooled rust, rivet halos and bleed), soot, chalking, pigeon droppings, corrugation,
//             all from the face attributes vkKit.js writes (uv in metres, aRv = (W, e, c, p), aJ = (L, seed)), and the
//             light balance after accumulation (STEEL_FS_LIGHT). Every steel slot is ONE node graph: the per-slot values
//             are material references (material.userData.vk.<name>.value, the shape Valdrada keeps them in), so every
//             slot compiles to the same WGSL and shares one pipeline.
//   vkOther   otherMat's FALL path (L216-L259): a standard material of the mean colour.
//   vkLit     litMat (L262-L276): emissive x mix(dayK, nightK, ENV.night).
//   vkTex     the canvas-textured cards: netMat, fenceMat, spikeMat (L281-L341), stations/irt125.js's sign and name
//             boards, vk/park.js's name lettering and column tags.
//
// Carried in the descriptor, not applied (lane C rule, furniture/materials.ts header): applyLightTrim's diffuse trim
// mix(0.30, 0.88, night) x scale and its ST34 specular trim. nyc-mon's ground and buildings are untrimmed, so trimming
// the viaduct alone would set it at ~0.3x its neighbours. vkMats.js pairs ST34 with a 1.6x day boost on vkSpecK
// (VK_ST34K); with the trim off this is Valdrada's `?st34=0` configuration, so the boost uniform (vkSt34K) starts at
// 1.0 and the descriptor's st34K (1.6) is there for the same switch.
//
// Deviations forced by WGSL, results unchanged where Valdrada's are defined:
//   * vkRivet's and the bleed's ifs are TSL selects over values computed first, with a safe divisor on the side not
//     taken. WGSL rejects derivatives in non-uniform control flow, and Valdrada takes the bleed's screen-space TBN
//     inside its `if`; here the TBN, fwidth and every dFdx/dFdy run unconditionally (vk-materials.test.ts checks the
//     WGSL), and the bleed is selected to 0 where Valdrada skips it.
//   * vWn is the world normal of three's instanced normal (inverse-transpose of instanceMatrix) where Valdrada takes
//     mat3(instanceMatrix); the two agree for the rotations and uniform scales the rivet heads use.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';

type Material = InstanceType<Three['Material']>;
type Texture = InstanceType<Three['Texture']>;
type StdMat = InstanceType<Three['MeshStandardNodeMaterial']>;

/** Structural view of the TSL values this file builds (see physical/loose-tsl.ts for why). */
interface V {
  readonly x: V; readonly y: V; readonly z: V; readonly w: V;
  readonly xy: V; readonly xz: V; readonly yz: V; readonly xyz: V; readonly rgb: V; readonly g: V; readonly a: V;
  add(v: A): V; sub(v: A): V; mul(v: A): V; div(v: A): V;
  lessThan(v: A): V; greaterThan(v: A): V; and(v: V): V;
  mulAssign(v: A): V; toVar(): V;
}
type A = V | number;
interface VkTsl {
  Fn(body: (args: V[]) => V): (...a: A[]) => V;
  float(v: A): V; vec2(...v: A[]): V; vec3(...v: A[]): V; vec4(...v: A[]): V;
  select(c: V, a: A, b: A): V;
  abs(v: A): V; floor(v: A): V; fract(v: A): V; sin(v: A): V; cos(v: A): V; sqrt(v: A): V; inverseSqrt(v: A): V;
  length(v: A): V; normalize(v: A): V; fwidth(v: A): V; dFdx(v: A): V; dFdy(v: A): V;
  min(a: A, b: A): V; max(a: A, b: A): V; dot(a: A, b: A): V; cross(a: A, b: A): V; step(e: A, x: A): V;
  clamp(v: A, lo: A, hi: A): V; mix(a: A, b: A, t: A): V; smoothstep(a: A, b: A, x: A): V;
  sRGBTransferOETF(v: A): V;
  attribute(name: string, type: string): V;
  varying(v: A): V;
  materialReference(path: string, type: string): V;
  uv(): V;
  positionWorld: V; positionView: V; normalLocal: V; normalViewGeometry: V; modelWorldMatrix: V; cameraViewMatrix: V;
  materialRoughness: V; materialMetalness: V; materialColor: V; materialEmissive: V; materialOpacity: V;
}
const asNode = <T extends string>(v: V) => v as unknown as Node<T>;

// ---------------------------------------------------------------- descriptors (tooling/city/vd-port/describe-vk.mjs)

/** applyLightTrim's parameters as the material carries them (customProgramCacheKey `|lighttrim<r,g,b>|st34`). */
export interface VkTrim {
  /** The diffuse calibration (the `scale` argument): mix(0.30, 0.88, night) x scale. */
  scale: [number, number, number];
  /** ST34 on: the specular takes ENV.st34.x by day (sky.js ST34_DAY 0.5); false for MeshStandard-less materials. */
  st34: boolean;
}

/** Every steelMat uniform (vkMats.js L183-L190), colours as linear [r, g, b]. */
export interface VkSteelUniforms {
  vkPaint: [number, number, number]; vkPaint2: [number, number, number];
  vkRustC: [number, number, number]; vkRustD: [number, number, number];
  vkRustAmt: number;
  /** The street's y in Valdrada's datum (a world height, like the positions). */
  vkGround: number;
  vkSeed: number; vkRivOn: number;
  /** setRivBand: (y1, cx, cz, r^2) in Valdrada world metres; x = -1e4 when no band is set. */
  vkBand: [number, number, number, number];
  vkGuanoAmt: number; vkChalk: number; vkCorr: number;
  vkSpecK: number; vkAmbK: number; vkDirK: number; vkDnK: number; vkGrime: number;
}

export interface VkSteelDesc {
  family: 'vkSteel';
  name: string;
  uniforms: VkSteelUniforms;
  roughness: number; metalness: number;
  /** vkMats.js VK_ST34K: 1.6 with ST34 (the default), 1.0 with `?st34=0`. */
  st34K: number;
  trim: VkTrim | null;
  noShadow: boolean;
}

interface VkBase {
  name: string;
  color: [number, number, number];
  roughness: number; metalness: number;
  opacity: number; transparent: boolean; depthWrite: boolean; alphaTest: number;
  /** THREE.FrontSide 0, BackSide 1, DoubleSide 2. */
  side: number;
  emissive: [number, number, number]; emissiveIntensity: number;
  trim: VkTrim | null;
  noShadow: boolean;
}
export interface VkOtherDesc extends VkBase { family: 'vkOther'; }
export interface VkLitDesc extends VkBase { family: 'vkLit'; dayK: number; nightK: number; }

/** A texture slot: the key env.texture() resolves, the size, and the sampler state Valdrada set on it. */
export interface VkTexRef {
  key: string; width: number; height: number;
  /** 'srgb' (decoded on sampling) or 'linear'. */
  colorSpace: 'srgb' | 'linear';
  repeat: [number, number];
  /** THREE wrap constants (RepeatWrapping 1000, ClampToEdgeWrapping 1001). */
  wrapS: number; wrapT: number;
  anisotropy: number;
}
export interface VkTexDesc extends VkBase {
  family: 'vkTex';
  texture: VkTexRef;
  /** Which of the material's maps the canvas fills (netting and fence: alphaMap; spikes, park: map; signs: map + emissiveMap). */
  slots: ('map' | 'alphaMap' | 'emissiveMap')[];
}

export type VkDesc = VkSteelDesc | VkOtherDesc | VkLitDesc | VkTexDesc;

export interface VkEnv {
  /** Valdrada's ENV.night (ctx.night). */
  night: Node<'float'>;
  /** Colours in linear when true; display values (sRGB OETF) for the direct path. */
  physical: boolean;
  /** The packed canvas texture for a VkTexRef key (pixels from vkTexturePixels, rows bottom-up), or null. */
  texture(key: string): Texture | null;
}

// ---------------------------------------------------------------- the steel shader's pieces

/** The arithmetic vkRivet needs, so one definition runs as TSL and as numbers (vk-materials.test.ts checks the latter). */
export interface RivetAlg<T, B> {
  n(v: number): T;
  add(a: T, b: T): T; sub(a: T, b: T): T; mul(a: T, b: T): T; div(a: T, b: T): T;
  floor(a: T): T; abs(a: T): T; max(a: T, b: T): T; clamp(a: T, lo: T, hi: T): T;
  lt(a: T, b: T): B; gt(a: T, b: T): B; and(a: B, b: B): B;
  sel(c: B, a: T, b: T): T;
}

/**
 * vkMats.js vkRivet (L46-L63): the nearest rivet on this face, (du, dv) metres from its centre, and z = 1 when the face
 * has rivets. Valdrada's ifs are selects here (both sides evaluated, the divisors made safe on the side not taken).
 */
export function vkRivet<T, B>(o: RivetAlg<T, B>, u: T, v: T, W: T, e: T, c: T, p: T, L: T): [T, T, T] {
  const zero = o.n(0), half = o.n(0.5);
  const none = o.lt(o.abs(p), o.n(1e-4));
  const pSafe = o.sel(none, o.n(1), p);
  // p > 0: the nearest station of the pitch; p < 0: one rivet |p| in from each end
  const uaPitch = o.mul(o.add(o.floor(o.div(u, pSafe)), half), pSafe);
  const uaEnds = o.sel(o.lt(u, o.mul(half, L)), o.sub(zero, p), o.add(L, p));
  const ua = o.sel(o.gt(p, zero), uaPitch, uaEnds);
  // c < 0: a grid at spacing -c between the edge rows
  const grid = o.lt(c, zero);
  const g = o.sel(grid, o.sub(zero, c), o.n(1));
  const nMax = o.max(o.floor(o.add(o.div(o.sub(W, o.mul(o.n(2), e)), g), o.n(1e-3))), zero);
  const vaGrid = o.add(e, o.mul(o.clamp(o.floor(o.add(o.div(o.sub(v, e), g), half)), zero, nMax), g));
  // otherwise the edge rows (e > 0) and the rows either side of the middle (c > 0), the nearer wins; neither: the middle
  const ea = e, eb = o.sub(W, e);
  const vaE = o.sel(o.lt(o.abs(o.sub(v, ea)), o.abs(o.sub(v, eb))), ea, eb);
  const hasE = o.gt(e, zero);
  const va1 = o.sel(hasE, vaE, o.mul(half, W));
  const best = o.sel(hasE, o.abs(o.sub(v, vaE)), o.n(1e3));
  const ca = o.sub(o.mul(half, W), c), cb = o.add(o.mul(half, W), c);
  const vb = o.sel(o.lt(o.abs(o.sub(v, ca)), o.abs(o.sub(v, cb))), ca, cb);
  const va2 = o.sel(o.and(o.gt(c, zero), o.lt(o.abs(o.sub(v, vb)), best)), vb, va1);
  const va = o.sel(grid, vaGrid, va2);
  return [o.sel(none, o.n(1e3), o.sub(u, ua)), o.sel(none, o.n(1e3), o.sub(v, va)), o.sel(none, zero, o.n(1))];
}

/** The steel uniforms read from material.userData.vk.<name>.value (one graph for every slot). */
const STEEL_UNIFORM_TYPES: Readonly<Record<keyof VkSteelUniforms | 'vkSt34K', string>> = {
  vkPaint: 'vec3', vkPaint2: 'vec3', vkRustC: 'vec3', vkRustD: 'vec3', vkRustAmt: 'float', vkGround: 'float',
  vkSeed: 'float', vkRivOn: 'float', vkBand: 'vec4', vkGuanoAmt: 'float', vkChalk: 'float', vkCorr: 'float',
  vkSpecK: 'float', vkAmbK: 'float', vkDirK: 'float', vkDnK: 'float', vkGrime: 'float', vkSt34K: 'float',
};

interface SteelGraph {
  color: Node<'vec4'>;
  roughness: Node<'float'>;
  metalness: Node<'float'>;
  normal: Node<'vec3'>;
  /** STEEL_FS_LIGHT on the accumulated light. */
  light(reflected: { directDiffuse: V; directSpecular: V; indirectDiffuse: V; indirectSpecular: V }): void;
}

function steelGraph(THREE: Three, night: Node<'float'>, physical: boolean): SteelGraph {
  const T = THREE.TSL as unknown as VkTsl;
  const ltNight = night as unknown as V;
  const u = (name: keyof typeof STEEL_UNIFORM_TYPES) => T.materialReference(`userData.vk.${name}.value`, STEEL_UNIFORM_TYPES[name]);
  const vkPaint = u('vkPaint'), vkPaint2 = u('vkPaint2'), vkRustC = u('vkRustC'), vkRustD = u('vkRustD');
  const vkRustAmt = u('vkRustAmt'), vkGround = u('vkGround'), vkSeed = u('vkSeed'), vkRivOn = u('vkRivOn');
  const vkBand = u('vkBand'), vkGuanoAmt = u('vkGuanoAmt'), vkChalk = u('vkChalk'), vkCorr = u('vkCorr');
  const vkSpecK = u('vkSpecK'), vkAmbK = u('vkAmbK'), vkDirK = u('vkDirK'), vkDnK = u('vkDnK'), vkGrime = u('vkGrime');
  const vkSt34K = u('vkSt34K');

  const one = (v: A) => T.float(1).sub(v);
  const ss = (a: A, b: A, x: A) => T.smoothstep(a, b, x);

  // vkH3 / vkN3 (L39-L44)
  const vkH3 = T.Fn(([q]) => {
    const p = T.fract(q!.mul(0.3183099).add(0.1)).mul(17.0).toVar();
    return T.fract(p.x.mul(p.y).mul(p.z).mul(p.x.add(p.y).add(p.z)));
  });
  const vkN3 = T.Fn(([x]) => {
    const i = T.floor(x!).toVar();
    const f0 = T.fract(x!);
    const f = f0.mul(f0).mul(T.float(3.0).sub(f0.mul(2.0))).toVar();
    const h = (a: number, b: number, c: number) => vkH3(i.add(T.vec3(a, b, c)));
    return T.mix(
      T.mix(T.mix(h(0, 0, 0), h(1, 0, 0), f.x), T.mix(h(0, 1, 0), h(1, 1, 0), f.x), f.y),
      T.mix(T.mix(h(0, 0, 1), h(1, 0, 1), f.x), T.mix(h(0, 1, 1), h(1, 1, 1), f.x), f.y), f.z);
  });
  // vkTBN (L64-L70): the scaled tangent and bitangent (N is the third column)
  const vkTBN = (eye: V, N: V, uv: V): [V, V] => {
    const q0 = T.dFdx(eye), q1 = T.dFdy(eye), st0 = T.dFdx(uv), st1 = T.dFdy(uv);
    const q1perp = T.cross(q1, N), q0perp = T.cross(N, q0);
    const Tt = q1perp.mul(st0.x).add(q0perp.mul(st1.x)), Bt = q1perp.mul(st0.y).add(q0perp.mul(st1.y));
    const det = T.max(T.dot(Tt, Tt), T.dot(Bt, Bt));
    const sc = T.select(det.greaterThan(0), T.inverseSqrt(T.max(det, 1e-30)), 0).toVar();
    return [Tt.mul(sc).toVar(), Bt.mul(sc).toVar()];
  };
  const rivAlg: RivetAlg<V, V> = {
    n: (v) => T.float(v), add: (a, b) => a.add(b), sub: (a, b) => a.sub(b), mul: (a, b) => a.mul(b), div: (a, b) => a.div(b),
    floor: (a) => T.floor(a), abs: (a) => T.abs(a), max: (a, b) => T.max(a, b), clamp: (a, lo, hi) => T.clamp(a, lo, hi),
    lt: (a, b) => a.lessThan(b), gt: (a, b) => a.greaterThan(b), and: (a, b) => a.and(b), sel: (c, a, b) => T.select(c, a, b),
  };

  // STEEL_VS (L26-L33): uv, the face attributes, world position and the world normal from the vertex stage
  const vUvM = T.uv().toVar();
  const vRv = T.attribute('aRv', 'vec4');
  const vJ = T.attribute('aJ', 'vec2');
  const vWp = T.positionWorld;
  const vWn = T.varying(T.normalize(T.modelWorldMatrix.mul(T.vec4(T.normalLocal, 0)).xyz));

  // STEEL_FS_COLOR (L72-L141)
  const rv = vkRivet(rivAlg, vUvM.x, vUvM.y, vRv.x, vRv.y, vRv.z, vRv.w, vJ.x);
  const vkRv3 = T.vec3(rv[0], rv[1], rv[2]).toVar();
  const vkRr = 0.018;
  const vkFw = T.fwidth(vUvM);
  const vkPix = T.max(T.max(vkFw.x, vkFw.y), 1e-5).toVar();
  const bd = vWp.xz.sub(vkBand.yz);
  const vkAA = one(ss(0.25, 0.7, vkPix.div(vkRr))).mul(vkRv3.z).mul(vkRivOn)
    .mul(one(T.step(vWp.y, vkBand.x).mul(T.step(T.dot(bd, bd), vkBand.w)))).toVar();
  const vkD = T.length(vkRv3.xy).div(vkRr).toVar();
  const vkIn = one(ss(0.86, 1.0, vkD)).mul(vkAA).toVar();
  const vkRing = ss(0.75, 1.0, vkD).mul(one(ss(1.0, 1.9, vkD))).mul(vkAA).toVar();
  const vkHalo = one(ss(1.0, 3.2, vkD)).mul(vkRv3.z).mul(one(ss(0.6, 1.4, vkPix.div(vkRr))));
  const vkN = T.normalize(vWn);
  const vkUp = vkN.y.toVar();
  const vkP = vWp.add(T.vec3(vkSeed.mul(17.3), 0.0, vkSeed.mul(5.1))).add(T.vec3(vJ.y.mul(0.37))).toVar();
  const vkBlot = vkN3(vkP.mul(0.33)).toVar();
  const vkBlot2 = vkN3(vkP.mul(0.9).add(7.0)).toVar();
  const vkFine = vkN3(vkP.mul(4.3)).toVar();
  const vkMic = vkN3(vkP.mul(21.0)).toVar();
  const vkStreak = vkN3(T.vec3(vkP.x.mul(7.0), vkP.y.mul(0.28), vkP.z.mul(7.0)));
  const vkStreak2 = vkN3(T.vec3(vkP.x.mul(23.0), vkP.y.mul(0.9), vkP.z.mul(23.0))).toVar();
  const vkVert = one(ss(0.3, 0.7, T.abs(vkUp))).toVar();
  const vkEdgeV = T.min(vUvM.y, vRv.x.sub(vUvM.y)), vkEdgeU = T.min(vUvM.x, vJ.x.sub(vUvM.x)).toVar();
  const vkEdge = T.min(vkEdgeV, vkEdgeU);
  const vkChip = one(ss(0.0, 0.016, vkEdge)).mul(ss(0.5, 0.78, vkFine.mul(0.6).add(vkMic.mul(0.4))));
  const vkJoint = one(ss(0.03, 0.4, vkEdgeU)).mul(ss(0.5, 0.8, vkBlot2.mul(0.55).add(vkFine.mul(0.45))));
  const vkRun = vkVert.mul(ss(0.6, 0.86, vkStreak.mul(0.7).add(vkStreak2.mul(0.3)))).mul(ss(0.35, 0.75, vkBlot)).toVar();
  const vkPool = ss(0.65, 0.95, vkUp).mul(ss(0.45, 0.8, vkFine.mul(0.7).add(vkBlot.mul(0.3))));
  // the screen-space frame of the face (vkTBN on the interpolated view normal; the normal stage reads it too)
  const nGeo = T.normalViewGeometry;
  const [tT, tB] = vkTBN(T.positionView, nGeo, vUvM);
  // rust bleed (L102-L118): a thin run down the face from under each rivet
  const bleed = (() => {
    const dn = T.cameraViewMatrix.mul(T.vec4(0.0, -1.0, 0.0, 0.0)).xyz;
    const duv = T.vec2(T.dot(dn, tT).div(T.max(T.dot(tT, tT), 1e-8)), T.dot(dn, tB).div(T.max(T.dot(tB, tB), 1e-8))).toVar();
    const dl = T.length(duv).toVar();
    const d = duv.div(T.max(dl, 1e-6)).toVar();
    const C = T.floor(vUvM.sub(vkRv3.xy).mul(97.0).add(0.5));
    const rid = T.fract(T.sin(T.dot(C, T.vec2(12.9898, 78.233)).add(vJ.y)).mul(43758.5453)).toVar();
    const ls = T.float(0.06).add(rid.mul(rid).mul(0.32)).toVar();
    const s = T.dot(vkRv3.xy, d).toVar();
    const lat = T.abs(T.dot(vkRv3.xy, T.vec2(d.y.mul(-1), d.x)));
    const w = T.float(vkRr).mul(T.float(0.55).add(one(s.div(ls)).mul(0.5))).toVar();
    const b = ss(vkRr * 0.7, vkRr * 1.4, s).mul(one(ss(ls.mul(0.4), ls, s))).mul(one(ss(w.mul(0.5), w, lat)))
      .mul(T.step(0.42, rid)).mul(vkVert).mul(one(ss(0.008, 0.03, vkPix))).mul(T.float(0.6).add(vkStreak2.mul(0.4)));
    const on = vkRv3.z.greaterThan(0.5).and(vkVert.greaterThan(0.05)).and(dl.greaterThan(1e-6));
    return T.select(on, b, 0).toVar();
  })();
  const vkLow = one(ss(0.0, 1.4, vWp.y.sub(vkGround)));
  const vkRust = T.clamp(vkRustAmt.mul(
    vkChip.mul(1.1).add(vkJoint.mul(0.75)).add(vkRun.mul(0.6)).add(vkPool.mul(0.55))
      .add(vkHalo.mul(0.4).mul(ss(0.3, 0.7, vkFine))).add(vkRing.mul(0.35))
      .add(vkLow.mul(ss(0.45, 0.8, vkFine.mul(0.5).add(vkBlot2.mul(0.5)))).mul(0.8)),
  ).add(bleed.mul(0.75)), 0.0, 1.0).toVar();
  let vkCol = T.mix(vkPaint, vkPaint2, ss(0.35, 0.65, vkBlot)).mul(T.float(0.95).add(vkBlot2.mul(0.1))).mul(T.float(0.96).add(vkFine.mul(0.08))).toVar();
  const rc0 = T.mix(vkRustD, vkRustC, ss(0.2, 0.8, vkFine.mul(0.6).add(vkMic.mul(0.4))));
  const vkRc = T.mix(rc0, vkCol.mul(T.vec3(0.85, 0.72, 0.62)), 0.3);
  vkCol = T.mix(vkCol, vkRc, vkRust);
  const vkUnder = ss(0.25, 0.9, vkUp.mul(-1)).toVar();
  const vkSplash = one(ss(0.0, 2.2, vWp.y.sub(vkGround))).toVar();
  vkCol = vkCol.mul(one(vkUnder.mul(0.22)).sub(vkSplash.mul(0.28).mul(T.float(0.55).add(vkFine.mul(0.45)))).sub(vkRing.mul(0.35)));
  vkCol = vkCol.mul(one(T.float(0.12).add(vkGrime).mul(vkRun).mul(one(vkRust))));
  vkCol = T.mix(vkCol, vkCol.mul(1.45).add(T.vec3(0.018, 0.022, 0.02)),
    vkChalk.mul(ss(0.5, 0.95, vkUp)).mul(T.float(0.35).add(vkBlot2.mul(0.65))).mul(one(vkRust)));
  const guanoA = ss(0.6, 0.95, vkUp).mul(ss(0.74, 0.9, vkN3(vkP.mul(7.0)).mul(0.6).add(vkMic.mul(0.4)))).mul(ss(0.35, 0.7, vkBlot2));
  const vkGuano = guanoA.add(vkVert.mul(ss(0.86, 0.97, vkN3(T.vec3(vkP.x.mul(31.0), vkP.y.mul(2.2), vkP.z.mul(31.0)))))
    .mul(ss(0.55, 0.85, vkBlot)).mul(0.5));
  vkCol = T.mix(vkCol, T.vec3(0.72, 0.71, 0.66), T.clamp(vkGuano, 0.0, 0.85).mul(vkGuanoAmt));
  // corrugated pan / buckle plate (L138-L140): vkCorr > 0 gates both terms, its divisor made safe when it is not
  const corrOn = vkCorr.greaterThan(0);
  const corrSafe = T.select(corrOn, vkCorr, 1);
  const vkCph = T.select(corrOn, vUvM.y.div(corrSafe).mul(6.2831853), 0).toVar();
  const vkCaa = T.select(corrOn, one(ss(0.25, 0.8, vkPix.div(corrSafe))), 0).toVar();
  vkCol = vkCol.mul(one(T.float(0.5).sub(T.cos(vkCph).mul(0.5)).mul(0.2).mul(vkCaa)));
  const shade = (rgb: V) => (physical ? rgb : T.sRGBTransferOETF(T.max(rgb, T.vec3(0))));

  // STEEL_FS_ROUGH / STEEL_FS_METAL (L142-L145) on the material's own roughness and metalness
  const roughness = T.clamp(T.mix(T.materialRoughness.mul(T.float(0.9).add(vkFine.mul(0.25))), 0.88, vkRust)
    .add(vkSplash.mul(0.12)).add(vkUnder.mul(0.08)), 0.25, 1.0);
  const metalness = T.mix(T.materialMetalness, 0.0, vkRust);

  // STEEL_FS_NORMAL (L146-L160), in view space: rivet domes, 6 mm bevels, corrugation, orange peel
  const g = vkRv3.xy.div(vkRr).toVar();
  const q = T.max(one(T.dot(g, g)), 0.06);
  const bw = 0.006, bAA = one(ss(0.5, 1.5, vkPix.div(bw)));
  const bevY = one(ss(0.0, bw, vUvM.y)).mul(-0.9).add(one(ss(0.0, bw, vRv.x.sub(vUvM.y))).mul(0.9)).mul(bAA);
  const bevX = one(ss(0.0, bw, vUvM.x)).mul(-0.9).add(one(ss(0.0, bw, vJ.x.sub(vUvM.x))).mul(0.9)).mul(bAA);
  const pAA = one(ss(0.004, 0.02, vkPix));
  const peel = T.vec2(vkN3(vkP.mul(60.0)), vkN3(vkP.mul(60.0).add(3.7))).sub(0.5).mul(T.float(0.05).add(vkRust.mul(0.35))).mul(pAA);
  // vkIn >= 0 and the corrugation terms are 0 when vkCorr <= 0, so Valdrada's two ifs add nothing when false
  const dome = g.mul(T.float(0.55).div(T.sqrt(q))).mul(vkIn);
  const tnx = dome.x.add(bevX).add(peel.x);
  const tny = dome.y.add(bevY).add(T.sin(vkCph).mul(-0.75).mul(vkCaa)).add(peel.y);
  // |result| >= 1: tT and tB are both square to nGeo, which enters with weight 1, so the normalize is safe
  const normal = T.normalize(tT.mul(tnx).add(tB.mul(tny)).add(nGeo));

  return {
    color: asNode<'vec4'>(T.vec4(shade(vkCol), 1)),
    roughness: asNode<'float'>(roughness),
    metalness: asNode<'float'>(metalness),
    normal: asNode<'vec3'>(normal),
    light(r) {
      // STEEL_FS_LIGHT (L170-L175)
      const vkSK = vkSpecK.mul(T.mix(vkSt34K, 1.0, ltNight));
      r.directDiffuse.mulAssign(vkDirK);
      r.directSpecular.mulAssign(vkSK.mul(vkDirK));
      r.indirectSpecular.mulAssign(vkSK.mul(vkAmbK));
      r.indirectDiffuse.mulAssign(vkAmbK.mul(T.float(1.0).add(vkDnK.mul(T.clamp(vWn.y.mul(-1), 0.0, 1.0)).mul(one(ltNight)))));
    },
  };
}

// ---------------------------------------------------------------- factory

interface Kit {
  steel: SteelGraph;
  SteelMaterial: new () => StdMat;
}
const kits = new WeakMap<object, WeakMap<object, Map<boolean, Kit>>>();

function kit(THREE: Three, night: Node<'float'>, physical: boolean): Kit {
  let byNight = kits.get(THREE);
  if (!byNight) kits.set(THREE, (byNight = new WeakMap()));
  let byPhys = byNight.get(night);
  if (!byPhys) byNight.set(night, (byPhys = new Map()));
  const hit = byPhys.get(physical);
  if (hit) return hit;
  const steel = steelGraph(THREE, night, physical);
  type Builder = { context: { reflectedLight: Parameters<SteelGraph['light']>[0] } };
  // STEEL_FS_LIGHT runs after lights_fragment_end, i.e. once every direct light and the indirect terms are summed.
  // LightingModel.start does exactly that (setupLights, then indirect); LightsNode totals reflectedLight after it.
  class VkSteelLighting extends THREE.PhysicalLightingModel {
    override start(builder: Parameters<InstanceType<Three['PhysicalLightingModel']>['start']>[0]): void {
      super.start(builder);
      steel.light((builder as unknown as Builder).context.reflectedLight);
    }
  }
  class SteelMaterial extends THREE.MeshStandardNodeMaterial {
    override setupLightingModel() { return new VkSteelLighting(); }
  }
  const k: Kit = { steel, SteelMaterial };
  byPhys.set(physical, k);
  return k;
}

const rgb = (THREE: Three, c: readonly number[]) => new THREE.Vector3(c[0], c[1], c[2]);

/** vkMats.js setRivBand (L213): the zone where a structure carries instanced rivet heads; the shader draws none there. */
export function setVkRivBand(mat: Material, y1: number, cx: number, cz: number, r: number): void {
  const vk = (mat.userData as { vk?: { vkBand?: { value: { set(x: number, y: number, z: number, w: number): void } } } }).vk;
  vk?.vkBand?.value.set(y1, cx, cz, r * r);
}

/** One node material per descriptor. Steel slots share one node graph (and so one pipeline) per (THREE, night, physical). */
export function createVkMaterial(THREE: Three, desc: VkDesc, env: VkEnv): Material {
  const T = THREE.TSL as unknown as VkTsl;
  const shade = (v: V) => (env.physical ? v : T.sRGBTransferOETF(T.max(v, T.vec3(0))));
  if (desc.family === 'vkSteel') {
    const k = kit(THREE, env.night, env.physical);
    const m = new k.SteelMaterial();
    m.name = desc.name;
    m.roughness = desc.roughness;
    m.metalness = desc.metalness;
    const U = desc.uniforms;
    // Valdrada's shape: userData.vk.<uniform>.value (setRivBand writes vkBand.value)
    m.userData.vk = {
      vkPaint: { value: rgb(THREE, U.vkPaint) }, vkPaint2: { value: rgb(THREE, U.vkPaint2) },
      vkRustC: { value: rgb(THREE, U.vkRustC) }, vkRustD: { value: rgb(THREE, U.vkRustD) },
      vkRustAmt: { value: U.vkRustAmt }, vkGround: { value: U.vkGround }, vkSeed: { value: U.vkSeed },
      vkRivOn: { value: U.vkRivOn }, vkBand: { value: new THREE.Vector4(...U.vkBand) }, vkGuanoAmt: { value: U.vkGuanoAmt },
      vkChalk: { value: U.vkChalk }, vkCorr: { value: U.vkCorr },
      vkSpecK: { value: U.vkSpecK }, vkAmbK: { value: U.vkAmbK }, vkDirK: { value: U.vkDirK }, vkDnK: { value: U.vkDnK },
      vkGrime: { value: U.vkGrime },
      // the ST34 day boost, off with the trim (header); desc.st34K is the shipped value
      vkSt34K: { value: 1.0 },
    };
    m.userData.vkDesc = desc;
    m.colorNode = k.steel.color;
    m.roughnessNode = k.steel.roughness;
    m.metalnessNode = k.steel.metalness;
    m.normalNode = k.steel.normal;
    return m;
  }

  const m = new THREE.MeshStandardNodeMaterial();
  m.name = desc.name;
  m.color.setRGB(desc.color[0], desc.color[1], desc.color[2]);
  m.roughness = desc.roughness;
  m.metalness = desc.metalness;
  m.opacity = desc.opacity;
  m.transparent = desc.transparent;
  m.depthWrite = desc.depthWrite;
  m.alphaTest = desc.alphaTest;
  m.side = desc.side as typeof m.side;
  m.emissive.setRGB(desc.emissive[0], desc.emissive[1], desc.emissive[2]);
  m.emissiveIntensity = desc.emissiveIntensity;
  m.userData.vkDesc = desc;

  if (desc.family === 'vkTex') {
    const t = env.texture(desc.texture.key);
    if (t) {
      // the sampler state Valdrada gave its CanvasTexture; the pixels arrive with flipY baked
      t.flipY = false;
      t.colorSpace = desc.texture.colorSpace === 'srgb' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = desc.texture.wrapS as typeof t.wrapS;
      t.wrapT = desc.texture.wrapT as typeof t.wrapT;
      t.repeat.set(desc.texture.repeat[0], desc.texture.repeat[1]);
      t.anisotropy = desc.texture.anisotropy;
      t.needsUpdate = true;
      for (const s of desc.slots) m[s] = t;
    } else if (desc.slots.includes('alphaMap')) {
      // netMat / fenceMat without a canvas: Valdrada's no-document opacity
      m.opacity = desc.name === 'vk-netting' ? 0.45 : 0.4;
    }
  }
  // materialColor and materialEmissive carry map / emissiveMap; colours to the lane's working space
  m.colorNode = asNode<'vec4'>(T.vec4(shade(T.materialColor.rgb), 1));
  const emissive = desc.family === 'vkLit'
    ? T.materialEmissive.mul(T.mix(T.materialReference('userData.vkLit.dayK', 'float'), T.materialReference('userData.vkLit.nightK', 'float'), env.night as unknown as V))
    : T.materialEmissive;
  if (desc.family === 'vkLit') m.userData.vkLit = { dayK: desc.dayK, nightK: desc.nightK };
  m.emissiveNode = asNode<'vec3'>(shade(emissive));
  return m;
}
