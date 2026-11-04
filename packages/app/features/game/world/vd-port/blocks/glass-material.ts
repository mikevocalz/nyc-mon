// Authored KIT window glass and FK interiors, Valdrada @2724c7938f20e068748ad1fd66e907d2bc662e3e (MIT).
// Nodes receive original source-frame coordinates/parameters; no scene/material/texture ownership.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
type F = Node<'float'>; type V2 = Node<'vec2'>; type V3 = Node<'vec3'>; type V4 = Node<'vec4'>;

export const SOURCE_GLASS_PROGRAMS = {
  'kitwinglass3|0.2|0.03|0.3|0.26': 'd1d6ce16', 'kitwinglass3|0.07|0.02|0.22|0.6': '741f8539',
  'pbrglass4|t|st': 'f3f5b5fc', 'pbrglass4|o|st|rm': '8dd43f3e', 'pbrglass4|o|st|ca': 'dd5e516c',
  'pbrglass4|o|st': '9856b4b0', 'pbrglass4|o|rm': '2d150e11', 'pbrglass4|o': '55e4c117',
} as const;
export function sourceGlassProgram(key: string, hash: string): keyof typeof SOURCE_GLASS_PROGRAMS {
  if (!Object.hasOwn(SOURCE_GLASS_PROGRAMS, key) || SOURCE_GLASS_PROGRAMS[key as keyof typeof SOURCE_GLASS_PROGRAMS] !== hash) throw new Error(`Unsupported authored glass program: ${key} (${hash})`);
  return key as keyof typeof SOURCE_GLASS_PROGRAMS;
}

export const SOURCE_FK_PROGRAMS = {
  '|fkin0.6,0.85': '1c3d9b8b', '|fkin0.6,0.85|fknight1': '230396d1', '|fkin0.28,0.6': '692f9967',
  '|fkin0.3,0.6|fknight1': 'ef4466c1', '|fknight1': '62271fdd',
  '|fkin0.3,0.7|fklv0.22,1.1': 'a4a0561a', '|fkin0.3,0.7|fklv0.13,1.3': 'c8a4d7c4',
  '|fkin0.3,0.7|fklva0.16,1.25': 'e7194a81', '|fkin0.45,0.8|fklv0.2,0.9': '59c695f7',
  '|fkin1,1|fkselfU|fksoft0.2': 'ac9db111', '|fkenvU|fkplain|pbcity': '289985f3', '|fkplain|pbcity': 'd1ec3ffd',
} as const;
/** Full expanded shader hash validates the common prefix and exact appended FK modifier chain. */
export function sourceFkProgram(key: string, hash: string): keyof typeof SOURCE_FK_PROGRAMS {
  for (const [suffix, expected] of Object.entries(SOURCE_FK_PROGRAMS)) if (key.endsWith(suffix) && hash === expected) return suffix as keyof typeof SOURCE_FK_PROGRAMS;
  throw new Error(`Unsupported authored FK program: ${key} (${hash})`);
}

export interface SourceGlassEnvironment {
  night: F; reflectionGain: F; sunDirection: V3; sunColor: V3;
  /** Source uZenC is bound to ENV.skyAmbient, despite this helper field name. Never substitute dome radiance. */
  zenith: V3; horizon: V3;
}
export interface SourceGlassFrame {
  /** Absolute original Valdrada coordinates, not rebased render coordinates. */
  position: V3; cameraPosition: V3;
  /** Normal expressed in that same frame, including authored pane tilt. */
  normal: V3;
}
/** Final installed physical lighting sums captured at lightingModel.finish(), before the source output hook. */
export interface SourceGlassLighting {
  outgoing: V3; totalSpecular: V3; indirectDiffuse: V3; directDiffuse: V3; emission: V3;
}

interface CompositeMath<S, V> {
  n(x: number): S; clamp(x: S): S; add(a: S, b: S): S; sub(a: S, b: S): S; mul(a: S, b: S): S;
  addV(a: V, b: V): V; subV(a: V, b: V): V; maxV(a: V): V; mulV(a: V, b: S): V;
}
interface CompositeValues<S, V> {
  outgoing: V; totalSpecular: V; indirectDiffuse: V; directDiffuse: V; emission: V;
  reflection: V; interior: V; opacity: S; fresnel: S;
}
function composite<S, V>(m: CompositeMath<S, V>, values: CompositeValues<S, V>, kind: 'kit' | 'transparent' | 'room' | 'body', street: boolean) {
  const v = values, complement = m.sub(m.n(1), v.fresnel);
  if (kind === 'kit' || kind === 'transparent') {
    const a = m.clamp(v.opacity);
    const light = kind === 'kit' || street ? m.maxV(m.subV(v.outgoing, v.totalSpecular)) : v.outgoing;
    return { color: m.addV(m.mulV(light, a), v.reflection), alpha: m.add(a, m.mul(m.sub(m.n(1), a), v.fresnel)) };
  }
  const outgoing = street ? m.maxV(m.subV(v.outgoing, v.totalSpecular)) : v.outgoing;
  let body = m.addV(m.addV(v.indirectDiffuse, m.mulV(v.directDiffuse, m.n(0.15))), v.emission);
  if (!street) body = m.addV(body, v.totalSpecular);
  return { color: m.addV(m.mulV(m.addV(kind === 'room' ? m.mulV(outgoing, m.n(0.1)) : body, v.interior), complement), v.reflection), alpha: m.n(1) };
}
function nodeCompositeMath(THREE: Three): CompositeMath<F, V3> {
  const T = THREE.TSL;
  return { n: x => T.float(x), clamp: x => T.clamp(x, 0, 1), add: (a,b) => a.add(b), sub: (a,b) => a.sub(b), mul: (a,b) => a.mul(b), addV: (a,b) => a.add(b), subV: (a,b) => a.sub(b), maxV: a => T.max(a, 0), mulV: (a,b) => a.mul(b) };
}
/** Numeric execution of the production compositing graph for comparisons with pinned source output equations. */
export function evaluateSourceGlassComposite(values: CompositeValues<number, readonly number[]>, kind: 'kit' | 'transparent' | 'room' | 'body', street: boolean) {
  const math: CompositeMath<number, readonly number[]> = { n:x=>x, clamp:x=>Math.max(0,Math.min(1,x)),add:(a,b)=>a+b,sub:(a,b)=>a-b,mul:(a,b)=>a*b,addV:(a,b)=>a.map((v,i)=>v+b[i]!),subV:(a,b)=>a.map((v,i)=>v-b[i]!),maxV:a=>a.map(v=>Math.max(0,v)),mulV:(a,b)=>a.map(v=>v*b) };
  return composite(math, values, kind, street);
}

function glassTools(THREE: Three, env: SourceGlassEnvironment) {
  const T = THREE.TSL;
  const hash = T.Fn(([p]: [V2]) => {
    const q = T.fract(T.vec3(p.x, p.y, p.x).mul(0.1031)).toVar();
    q.addAssign(T.dot(q, q.yzx.add(33.33)));
    return T.fract(q.x.add(q.y).mul(q.z));
  }) as unknown as (p: V2) => F;
  const hash2 = T.Fn(([p]: [V2]) => {
    const q = T.fract(T.vec3(p.x, p.y, p.x).mul(T.vec3(0.1031, 0.1030, 0.0973))).toVar();
    q.addAssign(T.dot(q, q.yzx.add(33.33)));
    return T.fract(q.xx.add(q.yz).mul(q.zy));
  }) as unknown as (p: V2) => V2;
  const noise = (p: V2): F => {
    const i = T.floor(p), f0 = T.fract(p), f = f0.mul(f0).mul(T.float(3).sub(f0.mul(2)));
    return T.mix(T.mix(hash(i), hash(i.add(T.vec2(1, 0))), f.x), T.mix(hash(i.add(T.vec2(0, 1))), hash(i.add(T.vec2(1, 1))), f.x), f.y) as F;
  };
  const fbm = (p: V2): F => noise(p).mul(0.55).add(noise(p.mul(2.03).add(17.1)).mul(0.28)).add(noise(p.mul(4.11).add(31.7)).mul(0.17)) as F;
  const luminance = (c: V3): F => T.dot(c, T.vec3(0.2126, 0.7152, 0.0722)) as F;
  const sky = (r: V3, aureole = 1.4): V3 => {
    const up = T.clamp(r.y, -1, 1), gain = env.reflectionGain;
    const zen = env.zenith.mul(gain.mul(1.95)), hor = env.horizon.mul(gain.mul(2.55)), ground = env.horizon.mul(T.vec3(0.45, 0.40, 0.34)).mul(gain);
    const base = T.select(up.greaterThanEqual(0), T.mix(hor, zen, T.pow(T.max(up, 0), 0.42)), T.mix(hor, ground, T.pow(T.max(up.negate(), 0), 0.55)));
    return base.add(env.sunColor.mul(gain.mul(aureole)).mul(T.pow(T.max(T.dot(r, env.sunDirection), 0), 7))) as V3;
  };
  const fresnel = (cosine: F, f0: F): F => f0.add(T.float(1).sub(f0).mul(T.pow(T.clamp(T.float(1).sub(cosine), 0, 1), 5))) as F;
  const sun = (r: V3, roughness: F, footprint: F): F => {
    const exponent = T.float(2).div(T.max(roughness.mul(roughness), 1e-4)).div(T.float(1).add(footprint.mul(220)));
    return T.min(T.pow(T.max(T.dot(r, env.sunDirection), 0), T.clamp(exponent, 12, 4000)), 6) as F;
  };
  const coverage = (x: F, lo: number | F, hi: number | F, footprint: F): F => {
    const low = typeof lo === 'number' ? T.float(lo) : lo, high = typeof hi === 'number' ? T.float(hi) : hi;
    const integral = (v: F) => T.floor(v).mul(high.sub(low)).add(T.clamp(T.fract(v).sub(low), 0, high.sub(low)));
    const w = T.max(footprint, 1e-4);
    return T.clamp(integral(x.add(w.mul(0.5)) as F).sub(integral(x.sub(w.mul(0.5)) as F)).div(w), 0, 1) as F;
  };
  return { hash, hash2, noise, fbm, luminance, sky, fresnel, sun, coverage };
}

export interface KitWindowInputs extends SourceGlassFrame {
  environment: SourceGlassEnvironment;
  /** Material diffuse tint, before source color attribute multiplication. */
  tint: V3;
  /** Raw color-attribute RGB = reflectance, dirt, clarity. It is not albedo. */
  character: V3;
  opacity: F; f0: F; roughness: F; dirt: F;
}
/** kitwinglass3: geometric pane reflection, street canyon, dirt film and authored premultiplied output. */
export function kitWindowGlassNodes(THREE: Three, input: KitWindowInputs) {
  const T = THREE.TSL, env = input.environment, g = glassTools(THREE, env), p = input.position;
  const view = T.normalize(input.cameraPosition.sub(p));
  const normal = T.select(T.dot(input.normal, view).lessThan(0), input.normal.negate(), input.normal) as V3;
  const reflected = T.reflect(view.negate(), normal);
  const cosine = T.max(T.dot(view, normal), 0) as F;
  const fresnel = g.fresnel(cosine, input.f0);
  const noColor = input.character.r.add(input.character.g).add(input.character.b).lessThan(0.01);
  const reflectance = T.select(noColor, 1, input.character.r), dirtShare = T.select(noColor, 1, input.character.g), clarity = T.select(noColor, 1, input.character.b);
  const film = g.noise(p.xz.mul(0.9).add(p.y.mul(0.5))).mul(0.6)
    .add(g.noise(T.vec2(p.x.add(p.z), p.y.mul(3.1)).mul(2.3)).mul(0.4)).mul(input.dirt).mul(dirtShare);
  const ripple = T.vec3(g.noise(p.xy.mul(2.1)), 0, g.noise(p.zy.mul(2.1).add(3.1))).sub(0.5).mul(0.03);
  const ray = T.normalize(reflected.add(ripple)) as V3;
  const sky = g.sky(ray);
  const travel = T.float(30).div(T.max(T.dot(ray, normal), 0.06));
  const height = p.y.add(ray.y.mul(travel)).sub(T.min(input.cameraPosition.y.sub(1.7), p.y));
  const tangent = T.normalize(T.vec3(normal.z.negate(), 0, normal.x).add(T.vec3(1e-5, 0, 0)));
  const u = T.dot(p.add(ray.mul(travel)), tangent);
  let aa = T.clamp(T.float(1.5).sub(T.max(T.fwidth(u).div(2.7), T.fwidth(height).div(3.3)).mul(4)), 0, 1);
  aa = aa.mul(T.smoothstep(0.25, 0.5, T.dot(ray, normal))).mul(T.float(1).sub(T.smoothstep(45, 80, travel)));
  const lot = T.floor(u.div(11));
  const neutralHorizon = T.mix(T.vec3(g.luminance(env.horizon)), env.horizon, 0.35);
  const wall = neutralHorizon.mul(T.mix(T.vec3(1.05, 0.9, 0.78), T.vec3(0.86, 0.87, 0.9), g.hash(T.vec2(lot, 7))))
    .mul(T.float(0.7).add(g.hash(T.vec2(lot, 3)).mul(0.6))).mul(env.reflectionGain);
  const windows = T.float(1).sub(T.smoothstep(0.17, 0.22, T.abs(T.fract(u.div(2.7)).sub(0.5))))
    .mul(T.float(1).sub(T.smoothstep(0.2, 0.26, T.abs(T.fract(height.sub(4).div(3.3)).sub(0.5)))))
    .mul(T.step(4.6, height));
  const sign = T.smoothstep(3, 3.15, height).mul(T.float(1).sub(T.smoothstep(3.95, 4.1, height)));
  const wallBand = wall.mul(T.mix(0.72, T.mix(0.85, 0.38, windows), aa));
  const shopBand = wall.mul(T.mix(0.62, T.mix(0.45, 1.25, sign), aa));
  const opposite = T.select(height.lessThan(0), neutralHorizon.mul(T.vec3(0.34, 0.33, 0.31)).mul(env.reflectionGain), T.mix(wallBand, shopBand, T.float(1).sub(T.smoothstep(3.9, 4.4, height))));
  const skyShare = T.smoothstep(14, 27, height);
  let reflection = T.mix(opposite, sky, skyShare).mul(input.tint).mul(fresnel).mul(reflectance).mul(T.float(1).sub(film.mul(0.55)));
  reflection = reflection.add(env.sunColor.mul(input.tint).mul(g.sun(ray, input.roughness.add(film.mul(0.1)) as F, T.length(T.fwidth(p)).mul(0.05) as F))
    .mul(g.fresnel(cosine, T.float(0.05))).mul(skyShare).mul(12).mul(env.reflectionGain).mul(T.float(1).sub(env.night)).mul(reflectance));
  const color = input.tint.mul(T.float(0.04).add(film.mul(0.3))) as V3;
  const opacity = T.clamp(input.opacity.mul(T.float(1).add(T.float(1).sub(clarity).mul(1.4))).add(film.mul(0.14)), 0, 0.95) as F;
  return {
    color, opacity, reflection: reflection as V3, fresnel,
    /** Source replaces opaque_fragment. Do not multiply this premultiplied result again. */
    output(lighting: SourceGlassLighting): V4 {
      const result = composite(nodeCompositeMath(THREE), { ...lighting, reflection: reflection as V3, interior: T.vec3(0), opacity, fresnel }, 'kit', true);
      return T.vec4(result.color, result.alpha) as V4;
    },
  };
}

/** The source fkin modifier applies after all direct/indirect scattering, before the final output sums. */
export function fkInteriorLighting(THREE: Three, input: Pick<SourceGlassLighting, 'indirectDiffuse' | 'directDiffuse'> & { indirectSpecular: V3; directSpecular: V3 }, indirect: F, direct: F) {
  return { indirectDiffuse: input.indirectDiffuse.mul(indirect), indirectSpecular: input.indirectSpecular.mul(indirect), directDiffuse: input.directDiffuse.mul(direct), directSpecular: input.directSpecular.mul(direct) };
}
/** fklv/fkselfU: add this to material emission; day/night factors are captured source values, never legacy E-alpha. */
export function fkLevelEmission(THREE: Three, diffuse: V3, lightLevel: F, day: F, night: F, nightAmount: F): V3 {
  return diffuse.mul(lightLevel).mul(THREE.TSL.mix(day, night, nightAmount)) as V3;
}
export function fkNightEmission(THREE: Three, emission: V3, night: F, factor: F): V3 { return emission.mul(night).mul(factor) as V3; }
export function fkSoftMap(THREE: Three, diffuse: V3, sample: V3, contrast: F): V3 { return diffuse.mul(THREE.TSL.mix(THREE.TSL.vec3(1), sample, contrast)) as V3; }
/** fklva atlas uses local repeating UV for each tile but original derivatives to select mips. */
export function fkAtlasSample(THREE: Three, uv: V2, variant: V3, rows: F, sample: (uv: V2, dx: V2, dy: V2) => V4): V4 {
  const T = THREE.TSL, scale = T.vec2(0.25, T.float(1).div(rows));
  const f = T.clamp(uv.sub(T.floor(uv.mul(0.99999))), T.vec2(0.004), T.vec2(0.996));
  return sample(variant.yz.add(f.mul(scale)) as V2, T.dFdx(uv).mul(scale) as V2, T.dFdy(uv).mul(scale) as V2);
}

function pbrStreet(THREE: Three, env: SourceGlassEnvironment, g: ReturnType<typeof glassTools>, p: V3, ray: V3, normal: V3, ground: F, width: F, sky: V3, origin: V3) {
  const T = THREE.TSL, horizon = env.horizon.mul(env.reflectionGain.mul(2.55));
  const light = g.luminance(horizon), travel = width.div(T.max(T.dot(ray, normal), 0.035));
  const hit = p.add(ray.mul(travel)), tangent = T.normalize(T.vec3(normal.z.negate(), 0, normal.x).add(1e-5));
  const u = T.dot(hit.sub(origin), tangent), y = hit.y.sub(ground);
  const du = T.length(T.vec2(T.dFdx(u), T.dFdy(u))), dy = T.length(T.vec2(T.dFdx(y), T.dFdy(y)));
  const lot = T.floor(u.div(12)), hash = g.hash2(T.vec2(lot, 5.3).add(0.5));
  const height = T.float(10).add(hash.x.mul(hash.x).mul(32)), pick = g.hash(T.vec2(lot, 9.1).add(0.5));
  const tone = T.select(pick.lessThan(0.35), T.vec3(0.36, 0.17, 0.11), T.select(pick.lessThan(0.55), T.vec3(0.55, 0.46, 0.34), T.select(pick.lessThan(0.75), T.vec3(0.62, 0.58, 0.5), T.select(pick.lessThan(0.88), T.vec3(0.26, 0.16, 0.12), T.vec3(0.7, 0.7, 0.66)))));
  const sun = T.max(T.dot(normal.negate(), env.sunDirection), 0).mul(T.float(1).sub(env.night));
  const wall = tone.mul(light).mul(T.float(0.5).add(sun.mul(1.4)));
  const windows = g.coverage(u.add(hash.y.mul(2.4)).div(2.4) as F, 0.27, 0.73, du.div(2.4) as F)
    .mul(g.coverage(y.sub(4.6).div(3.3) as F, 0.18, 0.74, dy.div(3.3) as F)).mul(T.smoothstep(4.4, 4.8, y));
  let windowColor = T.mix(T.vec3(light.mul(0.07)), sky.mul(0.25), 0.5);
  windowColor = T.mix(windowColor, T.vec3(1, 0.74, 0.46).mul(0.5).mul(T.step(0.5, g.hash(T.floor(T.vec2(u.div(2.4), y.div(3.3))).add(lot)))), env.night);
  let facade = T.mix(wall, windowColor, windows);
  const sign = T.float(0.2).add(T.vec3(g.hash(T.vec2(lot, 1.3)), g.hash(T.vec2(lot, 2.9)), g.hash(T.vec2(lot, 4.7))).mul(0.8)).mul(light).mul(0.45);
  const shop = T.mix(T.vec3(light.mul(0.13)), sign, T.smoothstep(T.float(3.3).sub(dy), T.float(3.3).add(dy), y));
  facade = T.mix(shop, facade, T.smoothstep(T.float(4.3).sub(dy), T.float(4.3).add(dy), y));
  const building = T.float(1).sub(T.smoothstep(height.sub(dy), height.add(dy), y));
  const street = T.select(ray.y.lessThan(-1e-3), T.step(p.y.sub(ground).div(T.max(ray.y.negate(), 1e-3)), travel), 0);
  const skyShare = T.float(1).sub(building).mul(T.float(1).sub(street));
  const pavement = T.vec3(1, 0.97, 0.92).mul(light).mul(T.float(0.12).add(T.max(env.sunDirection.y, 0).mul(0.35).mul(T.float(1).sub(env.night))));
  return { color: T.mix(T.mix(sky, facade, building), pavement, street) as V3, skyShare: skyShare as F };
}

export interface PbrGlassParameters {
  f0: F; roughness: F; dirt: F; streetWidth: F; body: V3;
  room: V4; blinds: F; transmission: F; seed: F; sheers: F; glow: F; storeyLocked: F; litShare: F; origin: V3;
}
function pbrRoom(THREE: Three, env: SourceGlassEnvironment, g: ReturnType<typeof glassTools>, p: V3, direction: V3, normal: V3, ground: F, light: F, params: PbrGlassParameters): V3 {
  const T = THREE.TSL, rm = params.room, night = env.night;
  const tangent = T.normalize(T.vec3(normal.z.negate(), 0, normal.x).add(1e-5));
  const u = T.dot(p.sub(params.origin), tangent), y = p.y.sub(ground), rayDepth = T.max(T.dot(direction, normal.negate()), 0.08);
  const ru = T.dot(direction, tangent).div(rayDepth), ry = direction.y.div(rayDepth);
  const height = rm.x, storey = y.sub(rm.y).div(height), floor = T.floor(storey), yIn = storey.sub(floor).mul(height);
  const dy = T.max(T.fwidth(y), 1e-4), du = T.max(T.fwidth(u), 1e-4), ceiling = height.sub(0.3);
  const shadeU = u.add(ru.mul(0.12)), shadeY = yIn.add(ry.mul(0.12)), bay = T.floor(shadeU.div(rm.w));
  const hash = g.hash2(T.vec2(bay, floor).add(params.seed)), key = g.hash(T.vec2(bay, floor).add(params.seed).add(7.1));
  const sheerKey = g.hash(T.vec2(bay, floor).add(params.seed).add(13.7)), isSheer = T.step(sheerKey, params.sheers);
  const hasShade = T.step(hash.x, params.blinds).mul(T.float(1).sub(isSheer)), vertical = T.step(hash.x, params.blinds.mul(0.3));
  const floorShade = g.hash(T.vec2(T.floor(shadeU.div(rm.w.mul(8))), floor).add(params.seed).add(5.9));
  const bottom = ceiling.sub(T.mix(0.12, 1, T.mix(floorShade, hash.y, 0.3)).mul(ceiling.sub(0.1)));
  let shadeCoverage = hasShade.mul(T.smoothstep(bottom.sub(dy), bottom.add(dy), shadeY)).mul(T.float(1).sub(T.smoothstep(ceiling.sub(dy), ceiling.add(dy), shadeY)));
  shadeCoverage = shadeCoverage.mul(T.mix(1, T.float(0.7).add(g.coverage(shadeU.div(0.089) as F, 0, 0.8, du.div(0.089) as F).mul(0.3)), vertical));
  const venetian = T.step(params.blinds.mul(0.3), hash.x).mul(T.step(hash.x, params.blinds.mul(0.65)));
  shadeCoverage = shadeCoverage.mul(T.mix(1, T.float(0.72).add(g.coverage(shadeY.div(0.06) as F, 0, 0.78, dy.div(0.06) as F).mul(0.28)), venetian));
  const hitCeiling = T.select(ry.greaterThan(1e-4), ceiling.sub(yIn).div(ry), 1e4), hitFloor = T.select(ry.lessThan(-1e-4), yIn.negate().div(ry), 1e4);
  const depth = T.min(T.min(hitCeiling, hitFloor), rm.z), isCeiling = T.step(hitCeiling, T.min(hitFloor, rm.z)), isFloor = T.float(1).sub(isCeiling).mul(T.step(hitFloor, rm.z));
  const ceilingDepth = T.min(hitCeiling, 60), ceilingU = u.add(ru.mul(ceilingDepth));
  const dc = T.max(T.fwidth(ceilingU), 1e-4), dd = T.max(T.fwidth(ceilingDepth), 1e-4);
  let lamp = g.coverage(ceilingU.div(2.4) as F, 0.4, 0.6, dc.div(2.4) as F).mul(g.coverage(ceilingDepth.div(2.4).sub(0.3) as F, 0.4, 0.6, dd.div(2.4) as F));
  lamp = T.mix(lamp, 0.04, T.smoothstep(0.12, 0.35, T.max(dc, dd)));
  const cellWidth = T.select(night.greaterThan(0.5), rm.w.mul(2), 9);
  const on = T.step(g.hash(T.vec2(T.floor(u.div(cellWidth)), floor).add(params.seed).add(3.3)), T.mix(0.85, params.litShare, night));
  const daylight = light.mul(T.float(1).sub(night)), warm = T.mix(T.vec3(1, 0.93, 0.82), T.vec3(1, 0.78, 0.52), night);
  const fill = daylight.mul(0.42).mul(T.exp(depth.mul(-0.12))).add(night.mul(on).mul(0.12)), fillColor = T.mix(T.vec3(1), warm, night);
  const ceilingColor = T.vec3(0.92, 0.92, 0.9).mul(fillColor).mul(fill).mul(1.25)
    .add(T.mix(T.vec3(1, 0.99, 0.96), warm, night).mul(lamp).mul(on).mul(T.mix(daylight.mul(0.4), 1.1, night)));
  const floorColor = T.vec3(0.4, 0.38, 0.36).mul(fillColor).mul(fill), wallColor = T.vec3(0.6, 0.6, 0.58).mul(fillColor).mul(fill).mul(T.float(0.8).add(key.mul(0.4)));
  const room = T.mix(T.mix(wallColor, floorColor, isFloor), ceilingColor, isCeiling);
  const shadeColor = T.mix(T.vec3(0.9, 0.89, 0.86), T.mix(T.vec3(0.68, 0.68, 0.67), T.vec3(0.8, 0.75, 0.66), T.step(0.88, key)), T.step(0.68, key));
  const shade = shadeColor.mul(T.vec3(daylight.mul(0.78)).add(warm.mul(night.mul(on).mul(0.32))));
  const far = T.smoothstep(0.15, 0.6, du.div(rm.w));
  shadeCoverage = T.mix(shadeCoverage, params.blinds.mul(T.float(1).sub(params.sheers)).mul(0.5).mul(ceiling.sub(0.1)).div(height), far);
  let result = T.mix(room, shade, shadeCoverage);
  const bayU = T.fract(shadeU.div(rm.w)), bayFootprint = du.div(rm.w);
  const sheerWidth = T.mix(1, T.float(0.4).add(key.mul(0.45)), T.step(0.75, T.fract(sheerKey.mul(7.31))));
  let sheerCoverage = isSheer.mul(T.float(1).sub(T.smoothstep(sheerWidth.sub(bayFootprint), sheerWidth.add(bayFootprint), bayU)))
    .mul(T.smoothstep(T.float(0.08).sub(dy), T.float(0.08).add(dy), shadeY)).mul(T.float(1).sub(T.smoothstep(ceiling.sub(dy), ceiling.add(dy), shadeY)));
  sheerCoverage = T.mix(sheerCoverage, params.sheers.mul(0.9).mul(ceiling.sub(0.08)).div(height), far);
  let fold = T.float(0.8).add(T.sin(shadeU.mul(6.2832 / 0.17).add(g.noise(T.vec2(shadeU.mul(1.3), floor.add(params.seed))).mul(2.5))).mul(0.2));
  fold = T.mix(fold, 0.8, T.smoothstep(0.02, 0.06, du));
  const sheer = T.vec3(0.93, 0.92, 0.89).mul(fold).mul(T.vec3(daylight.mul(0.6)).add(warm.mul(night.mul(on).mul(0.3)))).add(room.mul(0.25));
  result = T.mix(result, sheer, sheerCoverage);
  const slab = g.coverage(storey as F, ceiling.div(height) as F, 1, dy.div(height) as F).mul(params.storeyLocked);
  return T.mix(result, T.vec3(light.mul(0.16).mul(T.float(1).sub(night))).add(T.vec3(night.mul(0.01))), slab) as V3;
}

export interface PbrGlassInputs extends SourceGlassFrame {
  environment: SourceGlassEnvironment; parameters: PbrGlassParameters;
  /** Stable true geometric normal derived from camera-relative position gradients, transformed back to source frame. */
  geometricNormal: V3;
  groundHeight: F; tint: V3; tintRatio: V3; bodyOverride: V4; opacity: F;
  opaque: boolean; street: boolean; room: boolean; tintAttributes: boolean;
}
/** pbrglass4 (default PG_FRAME/PG_BODY): street reflections and office interiors are separate from kitwinglass3. */
export function pbrGlassNodes(THREE: Three, input: PbrGlassInputs) {
  if (input.room && !input.opaque) throw new Error('pbrglass4: authored room branch requires opaque glass');
  const T = THREE.TSL, env = input.environment, g = glassTools(THREE, env), p = input.position, params = input.parameters;
  const view = T.normalize(input.cameraPosition.sub(p)), normal = T.select(T.dot(input.normal, view).lessThan(0), input.normal.negate(), input.normal) as V3;
  const geometric = T.select(T.dot(input.geometricNormal, view).lessThan(0), input.geometricNormal.negate(), input.geometricNormal);
  const azimuth = T.atan(geometric.z, geometric.x);
  const snapped = T.float(0.50737).add(T.floor(azimuth.sub(0.50737).div(0.0981748).add(0.5)).mul(0.0981748));
  const faceNormal = T.select(T.dot(geometric, geometric).greaterThan(1e-24), T.select(T.abs(geometric.y).lessThan(0.8), T.vec3(T.cos(snapped), 0, T.sin(snapped)), geometric), normal) as V3;
  const tint = (input.tintAttributes ? input.tint.mul(input.tintRatio) : input.tint) as V3;
  const body = (input.tintAttributes ? T.select(input.bodyOverride.x.lessThan(0), params.body, input.bodyOverride.rgb) : params.body) as V3;
  const dirt = (input.tintAttributes ? T.select(input.bodyOverride.w.lessThan(0), params.dirt, input.bodyOverride.w) : params.dirt) as F;
  const ray = T.normalize(T.reflect(view.negate(), normal).add(T.vec3(g.noise(p.xy.mul(1.7)), 0, g.noise(p.zy.mul(1.7).add(3.1))).sub(0.5).mul(0.012))) as V3;
  const cosine = T.max(T.dot(view, normal), 0) as F, fresnel = g.fresnel(cosine, params.f0);
  const film = g.fbm(p.xz.mul(0.6).add(p.y.mul(0.4))).mul(dirt);
  const maxTint = T.max(T.max(tint.r, tint.g), T.max(tint.b, 1e-3)), tintUnit = tint.div(maxTint);
  const reflectionTint = (input.opaque ? tint : T.mix(T.vec3(1), tintUnit, 0.3)) as V3;
  const sky = g.sky(ray), skyDesaturated = T.mix(sky, T.vec3(g.luminance(sky)), 0.3) as V3;
  const street = input.street ? pbrStreet(THREE, env, g, p, ray, faceNormal, input.groundHeight, params.streetWidth, skyDesaturated, params.origin) : null;
  const canyon = street?.skyShare ?? T.float(1);
  let reflection = (street?.color ?? sky).mul(reflectionTint).mul(fresnel).mul(T.float(1).sub(film.mul(0.5)));
  if (!input.street) reflection = reflection.mul(T.mix(0.38, 1, T.smoothstep(4, 45, p.y)));
  reflection = reflection.add(env.sunColor.mul(reflectionTint).mul(g.sun(ray, params.roughness.add(film.mul(0.1)) as F, T.length(T.fwidth(p)).mul(0.05) as F))
    .mul(fresnel).mul(12).mul(env.reflectionGain).mul(T.float(1).sub(env.night)).mul(canyon));
  let interior: V3 = T.vec3(0);
  if (input.room) interior = pbrRoom(THREE, env, g, p, view.negate() as V3, faceNormal, input.groundHeight, g.luminance(env.horizon.mul(env.reflectionGain.mul(2.55))) as F, params)
    .mul(tintUnit).mul(params.transmission).mul(T.float(1).sub(film.mul(0.3))) as V3;
  else if (input.opaque) {
    const tangent = T.normalize(T.vec3(faceNormal.z.negate(), 0, faceNormal.x).add(1e-5));
    const on = T.step(g.hash(T.vec2(T.floor(T.dot(p.sub(params.origin), tangent).div(9)), T.floor(p.y.sub(input.groundHeight).sub(params.room.y).div(params.room.x))).add(params.seed).add(3.3)), 0.62);
    interior = T.select(params.glow.greaterThan(0).and(env.night.greaterThan(0)), T.vec3(1, 0.86, 0.66).mul(params.glow).mul(on).mul(env.night).mul(tintUnit), T.vec3(0)) as V3;
  }
  const color = (input.opaque ? body.mul(T.float(1).add(film.mul(0.6))) : tint.mul(T.float(0.04).add(film.mul(0.25)))) as V3;
  const opacity = (input.opaque ? T.float(1) : input.opacity.add(film.mul(0.12))) as F;
  return { color, opacity, reflection: reflection as V3, interior, fresnel,
    output(lighting: SourceGlassLighting): V4 {
      const result = composite(nodeCompositeMath(THREE), { ...lighting, reflection: reflection as V3, interior, opacity, fresnel }, input.room ? 'room' : input.opaque ? 'body' : 'transparent', input.street);
      return T.vec4(result.color, result.alpha) as V4;
    },
  };
}

/** FK shared PBR tint changes both scanned albedo ratio and (for bright metals) the analytic mirror tint. */
export function fkSharedTint(ratio: V3, tint: V3): V3 { return ratio.mul(tint) as V3; }
export function fkEnvironmentSpecular(indirectSpecular: V3, share: F): V3 { return indirectSpecular.mul(share) as V3; }
/** Source skymetalU adds its analytic reflection to emission and caps roughness; FKTRM multiplies tint before this call. */
export function fkSkyMetalNodes(THREE: Three, frame: SourceGlassFrame, environment: SourceGlassEnvironment, tint: V3, parameters: V4, roughness: F) {
  const T = THREE.TSL, g = glassTools(THREE, environment), view = T.normalize(frame.cameraPosition.sub(frame.position));
  const normal = T.select(T.dot(frame.normal, view).lessThan(0), frame.normal.negate(), frame.normal);
  const reflected = T.reflect(view.negate(), normal);
  const ray = T.normalize(T.mix(reflected, T.normalize(T.vec3(reflected.x, reflected.y.mul(0.42), reflected.z)), parameters.y)) as V3;
  const fresnel = T.mix(1, T.float(1).add(T.pow(T.float(1).sub(T.max(T.dot(view, normal), 0)), 5).mul(0.6)), 0.8);
  const emission = g.sky(ray, 2.2).mul(tint).mul(fresnel).mul(parameters.z)
    .add(environment.sunColor.mul(tint).mul(g.sun(ray, parameters.x, T.length(T.fwidth(frame.position)).mul(0.05) as F)).mul(10).mul(environment.reflectionGain).mul(parameters.z));
  return { emission: emission as V3, roughness: T.min(roughness, parameters.w) as F, ray };
}
