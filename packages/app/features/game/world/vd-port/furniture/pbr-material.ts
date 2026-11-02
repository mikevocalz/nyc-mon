// Valdrada's PBR material library (client/src/city/mat/pbrLib.js makeSurface, L469-L822 @ 2724c79, MIT) as a TSL node
// material: the surface the street props (pk/pkMats.js pkMat), street life (lk/lkMats.js lkMat) and elevated
// structures (vk/vkMats.js otherMat) draw when the library is in. Lane C of the vd port.
//
// One node graph for every set and option set: the texture sets are layers of two DataArrayTextures (bake-pbr.mjs,
// data/pbr-sets.ts) and every per-set and per-material constant is a uniform, including the switches pbrLib bakes
// into its program text (paint, paint-over, street, gum, the city reflection). Every pbr slot is one pipeline, as
// pbrLib's own AR34 s6 `PB_PROG` key aimed at (one program per structure).
//
// The values come from a descriptor read off Valdrada's live material (tooling/city/vd-port/describe-pbr.mjs): the
// uniforms pbrLib's onBeforeCompile installs, with their names, so this file reads pbrLib's own numbers.
//
// Ported, in pbrLib's order (its GLSL names in brackets):
//   * the mapping: mesh uv or world mapping (pbWorld), the rotation (pbRot), metres per repeat (pbSize);
//   * anti-tiling: two taps at pattern-snapped offsets (pbOff, pbUnit) picked by a low-frequency noise, blended by
//     the set's height for brick sets (pbBl), sampled with the derivatives of the continuous coordinate (textureGrad);
//   * the albedo ratio to the set's mean (pbRatio), or the paint branch: the tint on the paint's luminance (pbRatio,
//     pbRefL), chips by the paint mask (pbChips), the substrate with the scan's own paint colour taken out (pbScan,
//     pbSubK);
//   * paint-over wear (pbOver, pbPaint), the world-space tone drift, the wall weathering (splash zone, run-off
//     streaks, soot under pbTopY, ledge dust and soffits, cavity dirt from the height map, soot patches; pbGrimeC,
//     pbDirt, pbSeed) and the street blotches and gum spots;
//   * the facades' value curve (pbFac.x, pbFac.y) as its net value, see below;
//   * roughness (pbRS, pbRough, pbGlazed, grime, paint-over), metalness (pbMetal or the map), the normal map in tangent
//     space from the derivatives of the sampling coordinate (pbNrmK, weakened by grime and paint);
//   * the city in the reflection (CITY_GLSL pbCityK / pbCity on three's environment radiance) and the ORM ambient
//     occlusion on the indirect and direct light, both in a PhysicalLightingModel subclass at the points three's GLSL
//     chunks put them (lights_fragment_end, aomap_fragment).
//
// Carried in the descriptor, not applied (lane C's rule, furniture/materials.ts header):
//   * applyLightTrim (world/materials.js L292): pk and lk pass trim STREET_CAL, vk the default 1. It calibrates against
//     Valdrada's own sun and its trimmed ground; nyc-mon's ground and buildings are untrimmed, so props trimmed alone
//     would sit at ~0.58 of the pavement. With it go its ST34 specular trim and pbrLib's ST34 exemption for dark paint
//     (pbFac.z, pbSt34), which only undoes that trim.
//   * the facades' value curve divides by mix(0.30, 0.88, night): that is applyLightTrim's own factor taken back out, so
//     with the trim not applied the curve is applied as its net value, pow(albedo, 1.22) * 0.88. Only vk's materials take
//     it (pbFac.x is 0 for any material given a trim, i.e. pk and lk).
//   * applyCityAO (L355) and CS34: they sample Valdrada's baked sky-visibility texture (ENV.cityAO), not in the port.
//     The same texture's G channel is where pbrLib reads the street's height under a fragment (pbGy0) when the material
//     has no baseY; `env.groundY` stands in for it (nyc-mon's ground under the props), 0 when not given, which is pbrLib's
//     own value with no bake loaded.
//   * applySkyMetal (L1105) on the metal sets with metal 1 (alu, stainless, galvanised): its comment says why it exists,
//     the trim crushes a metal's specular colour with its diffuse; with no trim nothing is crushed. Its uniforms (uSmTn,
//     uSmP) stay in the descriptor.
//   * the material's own roughness and metalness (pkMat raises metalness): pbrLib's shader overwrites roughnessFactor and
//     metalnessFactor, so they never reached a pixel in Valdrada either. envMapIntensity is set: three uses it when the
//     material has its own envMap (pkEnvSync / lkEnvSync give metals the scene's environment), as Valdrada's three did.
// Not ported: the per-vertex attributes (aGrime, aWeather; opts.grimeAttr, opts.weatherAttr): no pk, lk or vk material
// in the square sets them, and createPbrMaterial throws on a descriptor that does.
//
// Texture channels (data/pbr-sets.ts): albedo RGB + the normal's X in A; ORM R AO, G roughness, B the metalness or the
// ORM alpha (height or paint mask) per set, A the normal's Y. The normal's Z is rebuilt. Rows are bottom-up, so pbrLib's
// sample at (s, -t) of a top-first KTX2 is (s, t) here; its noise and offsets still run in pbrLib's own (s, -t).
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { VD_PBR_BIN, VD_PBR_LAYER_SIZE, VD_PBR_LAYERS, VD_PBR_SETS } from './data/pbr-sets.ts';
import { worldPatternPosition } from '../../render-space.ts';

type DataArrayTexture = InstanceType<Three['DataArrayTexture']>;
type StdMat = InstanceType<Three['MeshStandardNodeMaterial']>;
type V2 = readonly [number, number];
type V3 = readonly [number, number, number];
type V4 = readonly [number, number, number, number];

/** The descriptor tooling/city/vd-port/describe-pbr.mjs reads off a pbrLib material (the fields this file uses). */
export interface PbrDescriptor {
  family: 'pbr';
  name: string;
  set: string;
  side: number;
  envMapIntensity: number;
  trim?: number | readonly number[] | null;
  paint: boolean; over: boolean; street: boolean; gum: boolean; city: boolean;
  grimeAttr?: boolean; weatherAttr?: boolean;
  pbSize: V2; pbRatio: V3; pbSeed: number; pbDirt: number; pbBaseY: number; pbTopY: number; pbPaint: V3;
  pbUnit: V2; pbBl: V3; pbRot: V4; pbWorld: number; pbChips: number; pbRefL: number; pbScan: V4; pbSubK: number;
  pbOver: V3; pbCavK: number; pbGrimeC: V3; pbGlazed: number; pbRS: V3; pbRough: number; pbMetal: V2; pbNrmK: number;
  pbFac: V3;
  [key: string]: unknown;
}

export interface PbrEnv {
  /** ENV.night. pbrLib reads it only inside the trim terms this port leaves out (see the header); kept for the API. */
  night: Node<'float'>;
  /** Colours in the linear working space (the physical stack) rather than display values (the direct path). */
  physical: boolean;
  albedo: DataArrayTexture;
  orm: DataArrayTexture;
  /** The street's height under the fragment (pbrLib's pbGy0 from the city AO bake); 0 when not given. */
  groundY?: Node<'float'> | number;
}

/** The two arrays from the .bin payloads (assets/pbr-albedo.bin, assets/pbr-orm.bin). */
export function loadPbrTextures(THREE: Three, bytes: { albedo: ArrayBuffer; orm: ArrayBuffer }): { albedo: DataArrayTexture; orm: DataArrayTexture } {
  const make = (buf: ArrayBuffer, expect: number, name: string, srgb: boolean, anisotropy: number) => {
    if (buf.byteLength !== expect) throw new Error(`${name}: ${buf.byteLength} bytes, the manifest says ${expect}`);
    const t = new THREE.DataArrayTexture(new Uint8Array(buf), VD_PBR_LAYER_SIZE, VD_PBR_LAYER_SIZE, VD_PBR_LAYERS);
    t.format = THREE.RGBAFormat;
    t.type = THREE.UnsignedByteType;
    // the albedo is sRGB (the KTX2's own transfer function): rgba8unorm-srgb decodes RGB in the sampler, before the
    // filter, as Valdrada's KTX2 did; A (the normal's X) stays linear in that format
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    // three's WebGPU path uploads level 0 of an array texture and builds the chain itself
    t.generateMipmaps = true;
    // pbrLib (and world/materials.js initGTEX): colour at 16, data at 8
    t.anisotropy = anisotropy;
    t.name = name;
    t.needsUpdate = true;
    return t;
  };
  return {
    albedo: make(bytes.albedo, VD_PBR_BIN.albedo.bytes, 'vd:pbr-albedo', true, 16),
    orm: make(bytes.orm, VD_PBR_BIN.orm.bytes, 'vd:pbr-orm', false, 8),
  };
}

// ---------------------------------------------------------------- a structural view of THREE.TSL
// @types/three types each TSL function per node type; pbrLib's graph mixes nodes whose type three only knows at build
// time (a Fn's result, a texture channel). Written against this view, handed back to three as Node at the material.
type A = N | number;
interface N {
  readonly x: N; readonly y: N; readonly z: N; readonly w: N;
  readonly r: N; readonly g: N; readonly b: N; readonly a: N;
  readonly xy: N; readonly xz: N; readonly yz: N; readonly zy: N; readonly xx: N; readonly xyx: N; readonly yzx: N;
  readonly xyz: N; readonly rgb: N;
  add(v: A): N; sub(v: A): N; mul(v: A): N; div(v: A): N;
  negate(): N;
  greaterThan(v: A): N; lessThan(v: A): N; equal(v: A): N; and(v: N): N;
  assign(v: A): N; mulAssign(v: A): N;
  depth(v: A): N; grad(dx: A, dy: A): N;
  toVar(): N;
}
type F1 = (a: A) => N;
type F2 = (a: A, b: A) => N;
type F3 = (a: A, b: A, c: A) => N;
type FN = (...a: A[]) => N;
interface L {
  Fn(body: (args: [N]) => N): { setLayout(layout: { name: string; type: string; inputs: { name: string; type: string }[] }): (a: A) => N };
  float: F1; vec2: FN; vec3: FN; vec4: FN;
  uniform(v: unknown): N;
  texture(t: unknown, uv: A): N;
  sin: F1; abs: F1; floor: F1; fract: F1; sqrt: F1; normalize: F1; length: F1; fwidth: F1; inverseSqrt: F1;
  dFdx: F1; dFdy: F1; sRGBTransferOETF: F1;
  min: F2; max: F2; step: F2; dot: F2; pow: F2; reflect: F2; cross: F2;
  clamp: F3; mix: F3; smoothstep: F3;
  positionWorld: N; positionView: N; positionViewDirection: N; normalView: N; normalWorldGeometry: N;
  cameraViewMatrix: N; roughness: N;
  uv(): N;
}

interface LightingContext {
  radiance: N;
  reflectedLight: { directDiffuse: N; indirectDiffuse: N; indirectSpecular: N };
}

/** pbrLib's surface for one material, from its descriptor. Every material built here compiles to the same shader. */
export function createPbrMaterial(THREE: Three, desc: PbrDescriptor, env: PbrEnv): StdMat {
  if (desc.grimeAttr || desc.weatherAttr) throw new Error(`pbr:${desc.name}: the aGrime / aWeather attributes are not ported`);
  const S = VD_PBR_SETS.find((s) => s.set === desc.set);
  if (!S) throw new Error(`pbr:${desc.name}: set ${desc.set} is not baked (data/pbr-sets.ts)`);
  const T = THREE.TSL as unknown as L;
  const u = (v: number | readonly number[]) => T.uniform(typeof v === 'number' ? v
    : v.length === 2 ? new THREE.Vector2(v[0], v[1]) : v.length === 3 ? new THREE.Vector3(v[0], v[1], v[2]) : new THREE.Vector4(v[0], v[1], v[2], v[3]));
  const on = (b: boolean) => (b ? 1 : 0);

  // ---- the material's and the set's constants (pbrLib's uniform names)
  const U = {
    layer: u(S.layer), bIsMetal: u(on(S.b === 'metal')), metalConst: u(S.metal ?? 0), alphaConst: u(S.alphaConst ?? 0),
    paint: u(on(desc.paint)), over: u(on(desc.over)), street: u(on(desc.street)), gum: u(on(desc.gum)), city: u(on(desc.city)),
    pbSize: u(desc.pbSize), pbRatio: u(desc.pbRatio), pbSeed: u(desc.pbSeed), pbDirt: u(desc.pbDirt), pbBaseY: u(desc.pbBaseY),
    pbTopY: u(desc.pbTopY), pbPaint: u(desc.pbPaint), pbUnit: u(desc.pbUnit), pbBl: u(desc.pbBl), pbRot: u(desc.pbRot),
    pbWorld: u(desc.pbWorld), pbChips: u(desc.pbChips), pbRefL: u(desc.pbRefL), pbScan: u(desc.pbScan), pbSubK: u(desc.pbSubK),
    pbOver: u(desc.pbOver), pbCavK: u(desc.pbCavK), pbGrimeC: u(desc.pbGrimeC), pbGlazed: u(desc.pbGlazed), pbRS: u(desc.pbRS),
    pbRough: u(desc.pbRough), pbMetal: u(desc.pbMetal), pbNrmK: u(desc.pbNrmK), pbFac: u(desc.pbFac),
    groundY: typeof env.groundY === 'object' ? (env.groundY as unknown as N) : u(env.groundY ?? 0),
  };
  const sd = U.pbSeed;

  // ---- NOISE_GLSL
  // (as WGSL functions: inlined, the noise trees made a 190 kB fragment shader)
  const fn = (name: string, type: string, body: (args: [N]) => N) => T.Fn(body).setLayout({ name, type, inputs: [{ name: 'p', type: 'vec2' }] });
  const pbH12 = fn('pbH12', 'float', ([p]) => {
    const p3 = T.fract(p.xyx.mul(0.1031)).toVar();
    p3.assign(p3.add(T.dot(p3, p3.yzx.add(33.33))));
    return T.fract(p3.x.add(p3.y).mul(p3.z));
  });
  const pbH22 = fn('pbH22', 'vec2', ([p]) => {
    const p3 = T.fract(p.xyx.mul(T.vec3(0.1031, 0.1030, 0.0973))).toVar();
    p3.assign(p3.add(T.dot(p3, p3.yzx.add(33.33))));
    return T.fract(p3.xx.add(p3.yz).mul(p3.zy));
  });
  const pbN = fn('pbN', 'float', ([p]) => {
    const i = T.floor(p);
    const f0 = T.fract(p);
    const f = f0.mul(f0).mul(T.vec2(3).sub(f0.mul(2)));
    return T.mix(T.mix(pbH12(i), pbH12(i.add(T.vec2(1, 0))), f.x), T.mix(pbH12(i.add(T.vec2(0, 1))), pbH12(i.add(T.vec2(1, 1))), f.x), f.y);
  });
  const pbF = fn('pbF', 'float', ([p]) => pbN(p).mul(0.55).add(pbN(p.mul(2.03).add(17.1)).mul(0.28)).add(pbN(p.mul(4.11).add(31.7)).mul(0.17)));
  const lum = (c: N) => T.dot(c, T.vec3(0.2126, 0.7152, 0.0722));
  // pbrLib's branches as 0 / 1 weights: a TSL select() is an if / else, and every shared subtree built inside one is
  // built again in the other (with select() around the albedo the fragment shader ran to 74 kB)
  const gt = (a: N, b: number) => T.step(b, a).mul(T.step(a, b).negate().add(1));   // a > b
  const on5 = (a: N) => T.step(0.5, a);   // a uniform switch (0 / 1) or a flag > 0.5
  const sel = (c: N, a: A, b: A) => T.mix(b, a, c);   // c in {0, 1}

  // ---- the mapping
  const W = worldPatternPosition(THREE) as unknown as N;
  const wn = T.normalize(T.normalWorldGeometry);
  const tW = T.normalize(T.vec2(wn.z, wn.x.negate()));
  const mWorld = sel(gt(T.abs(wn.y), 0.7), T.vec2(W.x, W.z.negate()), T.vec2(T.dot(W.xz, tW), W.y));
  const m0 = sel(on5(U.pbWorld), mWorld, T.uv());
  // GLSL mat2(a, b, c, d) * m: columns (a, b) and (c, d)
  const m = T.vec2(U.pbRot.x.mul(m0.x).add(U.pbRot.z.mul(m0.y)), U.pbRot.y.mul(m0.x).add(U.pbRot.w.mul(m0.y)));
  const pbST = m.div(U.pbSize);
  // pbrLib's (s, -t): its noise and offsets run there; a texel at (s, -t) top-first is (s, t) in the bottom-up layers
  const st = T.vec2(pbST.x, pbST.y.negate());
  const gx = T.dFdx(pbST), gy = T.dFdy(pbST);
  const kx = pbN(st.mul(0.43).add(T.vec2(sd.mul(1.7), sd.mul(0.3)))).mul(6);
  const ia = T.floor(kx), fb = T.fract(kx);
  const pbOff = (i: N) => {
    const h = pbH22(T.vec2(i.mul(7.13).add(sd.mul(0.37)), i.mul(3.71).sub(sd.mul(0.11))));
    return sel(gt(U.pbUnit.x, 0), T.floor(h.div(T.max(U.pbUnit, T.vec2(1e-6)))).mul(U.pbUnit), h);
  };
  const tap = (o: N) => {
    const q = st.add(o);
    const at = T.vec2(q.x, q.y.negate());
    const a = T.texture(env.albedo, at).depth(U.layer).grad(gx, gy);
    const r = T.texture(env.orm, at).depth(U.layer).grad(gx, gy);
    const nx = a.a.mul(2).sub(1), ny = r.a.mul(2).sub(1);
    return {
      alb: a.rgb,
      ao: r.r, rough: r.g,
      metal: T.mix(U.metalConst, r.b, U.bIsMetal),
      alpha: T.mix(r.b, U.alphaConst, U.bIsMetal),
      n: T.vec3(nx, ny, T.sqrt(T.max(T.float(1).sub(nx.mul(nx)).sub(ny.mul(ny)), 0))),
    };
  };
  const t0 = tap(pbOff(ia)), t1 = tap(pbOff(ia.add(1)));
  // (brick sets switch layers along the joints: a sharp blend)
  const w = T.smoothstep(U.pbBl.x, U.pbBl.y, fb.add(t1.alpha.sub(t0.alpha).mul(U.pbBl.z)));
  const oR = T.mix(t0.ao, t1.ao, w), oA = T.mix(t0.alpha, t1.alpha, w), oB = T.mix(t0.metal, t1.metal, w);
  const oG0 = T.mix(t0.rough, t1.rough, w);
  const pbNt = T.mix(t0.n, t1.n, w);
  let alb = T.mix(t0.alb, t1.alb, w);

  // ---- the albedo: paint over a chipped substrate, or the ratio to the set's mean
  {
    const pm = T.float(1).sub(T.float(1).sub(oA).mul(U.pbChips));
    const L0 = lum(alb);
    const pc0 = U.pbRatio.mul(L0);
    // (with the city reflection) the scan's own paint is mottled: half of its light and dark is kept
    const pc = sel(U.city, pc0.mul(T.mix(U.pbRefL.div(T.max(L0, 1e-3)), 1, 0.55)), pc0);
    const sub = sel(on5(U.pbSubK), T.max(alb.sub(U.pbScan.xyz.mul(L0.div(T.max(U.pbScan.w, 1e-3))).mul(oA)), T.vec3(0)), alb);
    alb = sel(U.paint, T.mix(sub, pc, pm), alb.mul(U.pbRatio));
  }
  // worn paint over the substrate, in world space (pbOver.x: the threshold for the cover asked)
  const pbPv = (() => {
    const wr = pbF(W.xz.mul(1.3).add(sd.mul(2.1))).mul(0.62).add(pbF(W.xz.mul(11).sub(sd)).mul(0.38));
    const thr = U.pbOver.x;
    return T.float(1).sub(T.smoothstep(thr.sub(0.035), thr.add(0.035), wr)).mul(U.over);
  })();
  alb = T.mix(alb, U.pbPaint.mul(T.mix(1, lum(alb).div(T.max(U.pbOver.y, 1e-3)), 0.22)), pbPv);
  // large-scale tone drift in world space, seeded per material
  {
    const wp = W.add(sd.mul(13.7));
    const mv = pbF(T.vec2(T.dot(wp.xz, T.vec2(0.71, 0.70)).mul(0.21), wp.y.mul(0.17))).sub(0.5);
    alb = alb.mul(mv.mul(0.16).add(1));
    alb = T.mix(alb, alb.mul(T.vec3(1.03, 1.0, 0.96)), T.clamp(pbF(wp.xz.mul(0.09).add(wp.y.mul(0.05))).sub(0.4), 0, 1).mul(0.6));
  }
  // the street's height here (no baseY, not a street surface: the city AO bake's height in Valdrada, groundY here)
  const gy0 = sel(T.float(1).sub(on5(U.street)).mul(T.float(1).sub(T.step(-9000, U.pbBaseY))), U.groundY, U.pbBaseY);
  const dirtOn = gt(U.pbDirt, 0);
  // weathering of walls, roofs, paint and metal
  const gWall = (() => {
    const h = W.y.sub(gy0);
    const up = wn.y;
    const tw = T.normalize(T.vec2(wn.z, wn.x.negate()).add(1e-5));
    const uw = T.dot(W.xz, tw);
    const nz = pbF(T.vec2(uw.mul(1.9), h.mul(1.3)).add(sd.mul(3.1)));
    const sp = T.float(1).sub(T.smoothstep(0.05, 0.62, h.add(nz.sub(0.5).mul(0.3))));
    const bs = T.float(1).sub(T.smoothstep(0.4, 2.6, h.add(nz.sub(0.5).mul(0.6))));
    const sk = pbN(T.vec2(uw.mul(2.6).add(sd.mul(5.3)), h.mul(0.11))).mul(0.65).add(pbN(T.vec2(uw.mul(7.9).sub(sd), h.mul(0.35))).mul(0.35));
    const streak = T.smoothstep(0.56, 0.86, sk).mul(pbN(T.vec2(uw.mul(0.7), h.mul(0.05).add(sd))).mul(0.45).add(0.55))
      .mul(T.float(1).sub(T.abs(up)));
    const topY = U.pbTopY;
    const soot = T.smoothstep(topY.sub(3.5), topY.sub(0.25), W.y.add(nz.sub(0.5).mul(1.2))).mul(T.step(W.y, topY.add(0.5)));
    const ledge = T.smoothstep(0.55, 0.9, up).mul(0.55), soff = T.smoothstep(0.55, 0.9, up.negate()).mul(0.35);
    const cav = T.mix(0.5, T.float(1).sub(oA), U.pbCavK);
    const pt = T.smoothstep(0.5, 0.82, pbF(T.vec2(uw.mul(0.42), h.mul(0.85)).add(sd.mul(4.7))))
      .mul(pbN(T.vec2(uw.mul(3.1), h.mul(2.3)).sub(sd)).mul(0.45).add(0.55));
    // (pt * 0.9: pbrLib's PBR_SOOT soot patches, on by default)
    const g = sp.mul(0.55).add(bs.mul(0.18)).add(streak.mul(0.30)).add(soot.mul(0.28)).add(ledge).add(soff).add(cav.mul(0.14)).add(pt.mul(0.9))
      .mul(U.pbDirt.mul(pbH12(T.vec2(sd, 7.7)).mul(0.4).add(0.8)));
    return T.clamp(g, 0, 0.85);
  })();
  // street surfaces: oil and wear blotches, chewing-gum spots
  const gStreet = T.smoothstep(0.55, 0.85, pbF(W.xz.mul(0.35).add(sd.mul(1.3)))).mul(0.35).mul(U.pbDirt);
  const spot = (() => {
    const gc = W.xz.div(0.23);
    const ci = T.floor(gc), cf = T.fract(gc);
    const hh = pbH22(ci.add(11.3));
    const onG = T.step(0.78, pbH12(ci.mul(1.37).add(4.1)));
    const rr = T.mix(0.035, 0.085, hh.y);
    const d = T.length(cf.sub(hh.mul(0.6).add(0.2)));
    const fw = T.max(T.fwidth(gc.x), 1e-4);
    const s = onG.mul(T.float(1).sub(T.smoothstep(rr.sub(fw), rr.add(fw), d))).mul(T.float(1).sub(T.smoothstep(0.08, 0.3, fw)));
    return { s: s.mul(U.street).mul(U.gum).mul(dirtOn), tone: T.vec3(0.075, 0.072, 0.07).mul(hh.x.mul(0.5).add(0.8)) };
  })();
  const pbGr = T.mix(gWall, gStreet, U.street).mul(dirtOn);
  {
    const L1 = lum(alb);
    const grime = T.mix(T.vec3(L1), alb, 0.55).mul(U.pbGrimeC);
    const walled = T.mix(alb, grime, pbGr);
    const streeted = T.mix(alb, spot.tone, spot.s.mul(0.85)).mul(T.float(1).sub(pbGr));
    alb = sel(U.street, streeted, walled);
  }
  // (a gum spot is smoother)
  const oG = T.mix(oG0, 0.55, spot.s);
  // the facades' value curve, as its net value (the header: its / mix(0.30, 0.88, night) undoes the trim not applied)
  {
    const a0 = T.max(alb, T.vec3(0));
    const cv0 = T.pow(a0, T.vec3(1.22)).mul(0.88);
    // paint and metal finishes (pbFac.y): the curve is not carried into the darks
    const cv = sel(on5(U.pbFac.y), T.mix(a0.mul(0.531), cv0, T.step(T.vec3(0.1), a0)), cv0);
    alb = sel(on5(U.pbFac.x), cv, alb);
  }

  // ---- roughness, metalness, the normal
  let rr = sel(on5(U.pbRS.z), T.mix(U.pbRS.x, U.pbRS.y, oG), oG).mul(U.pbRough);
  rr = sel(gt(U.pbGlazed, 0), T.mix(rr, T.max(rr, 0.72), pbGr.mul(U.pbGlazed)), T.mix(rr, T.min(rr.add(0.12), 1), pbGr));
  rr = T.mix(rr, U.pbOver.z, pbPv);
  const metalness = sel(on5(U.pbMetal.y), U.pbMetal.x.mul(T.float(1).sub(pbGr.mul(0.6))), oB);
  const normal = (() => {
    // cotangent frame from the derivatives of the sampling coordinates (no tangent attribute needed)
    const q0 = T.dFdx(T.positionView), q1 = T.dFdy(T.positionView);
    const s0 = T.dFdx(pbST), s1 = T.dFdy(pbST);
    const Nv = T.normalView;
    const q1p = T.cross(q1, Nv), q0p = T.cross(Nv, q0);
    const Tt = q1p.mul(s0.x).add(q0p.mul(s1.x)), Bt = q1p.mul(s0.y).add(q0p.mul(s1.y));
    const det = T.max(T.dot(Tt, Tt), T.dot(Bt, Bt));
    const sc = sel(gt(det, 0), T.inverseSqrt(T.max(det, 1e-30)), 0);
    const k = U.pbNrmK.mul(T.float(1).sub(pbGr.mul(0.35))).mul(T.float(1).sub(pbPv.mul(0.45)));
    const tn = T.vec3(pbNt.x.mul(k), pbNt.y.mul(k), pbNt.z);
    const mapped = T.normalize(Tt.mul(sc).mul(tn.x).add(Bt.mul(sc).mul(tn.y)).add(Nv.mul(tn.z)));
    // (sc 0: no frame, the geometry's normal; the rebuilt z is never 0, data/pbr-sets.ts zMin)
    return sel(gt(sc, 0), mapped, Nv);
  })();

  // ---- the material
  const material = new THREE.MeshStandardNodeMaterial({ side: desc.side as never });
  material.name = 'pbr:' + desc.name;
  material.envMapIntensity = desc.envMapIntensity;
  const shade = (rgb: N) => (env.physical ? rgb : T.sRGBTransferOETF(T.max(rgb, T.vec3(0))));
  material.colorNode = T.vec4(shade(alb), 1) as unknown as Node<'vec4'>;
  material.roughnessNode = T.clamp(rr, 0.04, 1) as unknown as Node<'float'>;
  material.metalnessNode = metalness as unknown as Node<'float'>;
  material.normalNode = normal as unknown as Node<'vec3'>;

  // ---- the city in the reflection and the ORM occlusion, where three's GLSL chunks put them
  const ao = T.mix(1, oR, 0.85);
  const cityK = (Rw: N, h: N, wd: N) => {
    const hz = T.float(1).sub(T.smoothstep(2, 32, h)).mul(0.55);
    return T.smoothstep(hz.sub(wd), hz.add(wd), Rw.y);
  };
  const cityC = (c: N, k: N) => {
    const g = T.vec3(lum(c)).mul(T.vec3(0.95, 1.0, 1.08));
    return T.mix(g.mul(0.55), T.mix(c, g, 0.35), k);
  };
  const Base = THREE.PhysicalLightingModel;
  class PbrLightingModel extends Base {
    override indirect(builder: Parameters<InstanceType<typeof Base>['indirect']>[0]) {
      const ctx = builder.context as unknown as LightingContext;
      // CITY_GLSL at lights_fragment_end: the environment's radiance along three's own lobe direction, the lobe's share
      // under the street canyon's skyline taken by the city
      const r = T.roughness;
      const cR = T.normalize(T.mix(T.reflect(T.positionViewDirection.negate(), T.normalView), T.normalView, r.mul(r).mul(r).mul(r)));
      const cRw = T.normalize(T.vec4(cR, 0).mul(T.cameraViewMatrix).xyz);
      const edited = cityC(ctx.radiance, cityK(cRw, W.y.sub(gy0), r.mul(r).mul(0.55).add(0.1)));
      ctx.radiance.assign(T.mix(ctx.radiance, edited, U.city));
      super.indirect(builder);
    }
    override ambientOcclusion(builder: Parameters<InstanceType<typeof Base>['ambientOcclusion']>[0]) {
      super.ambientOcclusion(builder);
      // pbrLib's aomap_fragment edit
      const { reflectedLight } = builder.context as unknown as LightingContext;
      reflectedLight.indirectDiffuse.mulAssign(ao);
      reflectedLight.indirectSpecular.mulAssign(T.mix(1, ao, 0.6));
      reflectedLight.directDiffuse.mulAssign(T.mix(1, ao, 0.25));
    }
  }
  material.setupLightingModel = () => new PbrLightingModel();
  material.userData.pbr = { name: desc.name, set: desc.set, layer: S.layer, trim: desc.trim ?? null };
  material.userData.pbrUniforms = U;
  return material;
}
