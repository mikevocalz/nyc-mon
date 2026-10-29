// world/vd-materials.ts — the "vd" lane: Valdrada's street look ported from
// its GLSL (client/src/world/materials.js @ v0.4.0, makeFacadeMaterial and
// makeGroundMaterial) to TSL on the PBR body. Behind EXPO_PUBLIC_WORLD_VD,
// default ON (0 turns it off). Mike opened this port on 2026-10-18, overriding the v3
// prompt's "no GLSL materials" rule; docs/adr/0022-vd-look-lane.md records it.
//
// Ported:
// - Masonry: the five CC0 wall photos (vd-textures.ts) divided by their layer
//   mean, so the photo carries grain and colour drift around the building's
//   own tone (Valdrada's wRat/wLumC step), plus the brick normal map. Both
//   fade by pixel footprint, Valdrada's fwidth rule, so far walls do not
//   shimmer.
// - Windows: Valdrada's lattice with whole bays and corner margins, box-
//   filtered by pcov (its HASH_GLSL primitive), a 15 cm reveal drawn by
//   parallax, sky-fresnel glass over a dark room, and the night lit share
//   from windows.ts so every lane lights the same rooms.
// - Ground: asphalt photo grain and normal on the road graph; 5 ft (1.524 m)
//   sidewalk flags with joints and per-flag tone over the paving photo.
// - Weather: wet darkening, puddles and the roughness drop on the ground
//   (Valdrada materials.js wet block), damp masonry, snow on up-facing
//   surfaces (applySnowCap). Uniforms live on `weather`; vd-weather.ts draws
//   the falling rain and snow.
//
// Not ported (DEFER, see the ADR): the ray-marched room furniture, fascia
// sign atlas, hex tiling, ground parallax, the city AO bake, GTAO/SSR/haze
// post passes, photometric lamps and clouds.
//
// EXPO_PUBLIC_WORLD_VD_LEANMAT (vd-leanmat.ts) skips all of this and
// returns the unlit lean set in createLeanVdCityMaterials instead.
//
// Colour space: the city feeds palette hex as linear and outputs linear
// (city-scene.ts), so texture bytes are used raw — no sRGB decode — and land
// on screen as the photo.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { decodeBase64 } from './foliage.ts';
import { cityShaderTools, createUnlitLayers, leafGraphs, roadsGraphs, TONE_ATTRIBUTE, type CityMaterials } from './materials.ts';
import { createPbrCityMaterials, type PbrCityOptions } from './pbr-materials.ts';
import type { CityColor } from './palette.ts';
import { VD_LANE } from './curb.ts';
import { VD_LEANMAT } from './vd-leanmat.ts';
import { LIT_SHARE_CAP, LIT_SHARE_DAY, LIT_SHARE_GAIN, LIT_SHARE_TOD, WINDOW_GRID } from './windows.ts';
import {
  VD_GROUND_MEANS, VD_GROUND_RGB, VD_NORMAL_LAYERS, VD_NORMALS_XY, VD_TEXTURE_SIZE, VD_WALL_LAYERS, VD_WALL_MEANS, VD_WALLS_RGB,
} from './vd-textures.ts';
import { VD_TREES } from './vd-trees.ts';

type StdMat = InstanceType<Three['MeshStandardNodeMaterial']>;
type BasicMat = InstanceType<Three['MeshBasicNodeMaterial']>;
type BasicParams = ConstructorParameters<Three['MeshBasicNodeMaterial']>[0];
type Mat = InstanceType<Three['Material']>;
type TextureT = InstanceType<Three['Texture']>;
type F = Node<'float'>;
type V3 = Node<'vec3'>;

/** The vd lane — default ON (curb.ts VD_LANE); EXPO_PUBLIC_WORLD_VD=0 turns it off. */
export const EXPERIMENTAL_WORLD_VD = VD_LANE;

/** Starting weather from EXPO_PUBLIC_WORLD_WEATHER: `rain`, `snow` or anything else for clear. */
export function weatherFromEnv(value = process.env.EXPO_PUBLIC_WORLD_WEATHER): { rain: number; snow: number } {
  const v = value?.trim().toLowerCase();
  return { rain: v === 'rain' ? 1 : 0, snow: v === 'snow' ? 1 : 0 };
}

export interface VdWeather {
  /** Ground wetness 0..1 (rain). */
  wet: { value: number };
  /** Settled snow 0..1. */
  snow: { value: number };
}

export type VdCityMaterials = CityMaterials & { weather: VdWeather };

/** Lean lane (vd-leanmat.ts): unlit output lands near the dusk-lit level the PBR bodies produce. */
const LEAN_DUSK = 0.8;

// Tuning knobs, each a starting value for the Duo eyeball pass.
const TUNE = {
  /** How far the photo pulls the wall off its palette tone toward the photo's own colour, near. */
  photo: 0.55,
  /** Grain strength near / far (Valdrada wStr .36 → .05, raised: our base tone is flatter than PLUTO tints). */
  grainNear: 0.6,
  grainFar: 0.08,
  /** Brick normal strength. */
  normal: 0.9,
  /** Window reveal depth, metres (Valdrada REC masonry .15). */
  reveal: 0.15,
  /** Sidewalk flag pitch, metres: the NYC 5 ft flag. */
  flag: 1.524,
} as const;

/**
 * Sampler anisotropy for the photo arrays: the walls and the road are seen at grazing angles all the way down a
 * street, where an isotropic trilinear sample blurs a wall to its mean. 16 is WebGPU's maxAnisotropy ceiling; three
 * applies it only with linear min, mag and mip filters, which these keep.
 */
export const VD_TEXTURE_ANISOTROPY = 16;

/** The names the photo arrays carry (texture.name), for the sampler and mip tests. */
export const VD_TEXTURE_NAMES = { walls: 'vd:walls', ground: 'vd:ground', normals: 'vd:normals' } as const;

/**
 * One 256 px photo array. Mips: generateMipmaps with a trilinear min filter, so three allocates the full chain
 * (9 levels at 256 px) and builds it on upload (renderers/common/Textures.js). A wall several metres per pixel away
 * then reads a filtered average, not one texel per pixel.
 */
function arrayTexture(THREE: Three, base64: string, layers: number, channels: 2 | 3, name: string) {
  const src = decodeBase64(base64);
  const n = VD_TEXTURE_SIZE * VD_TEXTURE_SIZE * layers;
  const rgba = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    rgba[i * 4] = src[i * channels]!;
    rgba[i * 4 + 1] = src[i * channels + 1]!;
    rgba[i * 4 + 2] = channels === 3 ? src[i * 3 + 2]! : 255;
    rgba[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataArrayTexture(rgba, VD_TEXTURE_SIZE, VD_TEXTURE_SIZE, layers);
  texture.format = THREE.RGBAFormat;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = VD_TEXTURE_ANISOTROPY;
  texture.name = name;
  texture.needsUpdate = true;
  return texture;
}

/** Means table as a vec3 picked by layer index, without dynamic indexing. */
function pickMean(T: Three['TSL'], means: readonly (readonly number[])[], layer: F): V3 {
  let out: V3 = T.vec3(means[0]![0]!, means[0]![1]!, means[0]![2]!);
  for (let i = 1; i < means.length; i++) {
    out = T.mix(out, T.vec3(means[i]![0]!, means[i]![1]!, means[i]![2]!), T.step(i - 0.5, layer)) as V3;
  }
  return out;
}

export interface VdCityOptions extends PbrCityOptions {
  /**
   * Under the physical stack (sRGB output, ACES in the RenderPipeline,
   * bloom): the lane's colours are authored as display values fed straight
   * to a linear output, so each albedo and glow is decoded to the linear
   * working space here, and the near-future overrides that push neon and
   * lettering past 1 for AgX stay off (the physical bloom already lifts
   * them). Default false: the lane as tuned on the direct path.
   */
  physical?: boolean;
}

export function createVdCityMaterials(
  THREE: Three, options: VdCityOptions,
  /** Overridable for tests: the lean material bodies (vd-leanmat.ts). Defaults to the flag. */
  leanMat = VD_LEANMAT,
): VdCityMaterials {
  if (leanMat) return createLeanVdCityMaterials(THREE, options);
  const base = createPbrCityMaterials(THREE, options);
  const { T, c, vertexRgb } = cityShaderTools(THREE);
  const physical = options.physical === true;
  /** Display value to the working space: identity on the direct path, the sRGB decode under the physical stack. */
  const working = (x: V3): V3 => (physical ? T.sRGBTransferEOTF(x) as V3 : x);
  const tod = options.timeOfDay ?? LIT_SHARE_TOD;
  const initial = weatherFromEnv();
  const wet = T.uniform(initial.rain);
  const snow = T.uniform(initial.snow);

  const walls = arrayTexture(THREE, VD_WALLS_RGB, VD_WALL_LAYERS.length, 3, VD_TEXTURE_NAMES.walls);
  const groundMaps = arrayTexture(THREE, VD_GROUND_RGB, 3, 3, VD_TEXTURE_NAMES.ground);
  const normals = arrayTexture(THREE, VD_NORMALS_XY, VD_NORMAL_LAYERS.length, 2, VD_TEXTURE_NAMES.normals);
  const NRM = { brick: 0, asphalt: 1, paving: 2 } as const;
  const GND = { asphalt: 0, paving: 1, concrete: 2 } as const;

  const lum = (x: V3) => T.dot(x, T.vec3(0.2126, 0.7152, 0.0722)) as F;
  const footprint = (x: Node<'vec2'>) => T.max(T.fwidth(x.x), T.fwidth(x.y)) as F;
  const hash12 = (p: Node<'vec2'>) => T.fract(T.sin(T.dot(p, T.vec2(127.1, 311.7))).mul(43758.5453)) as F;
  const vnoise = (p: Node<'vec2'>): F => {
    const i = T.floor(p);
    const f = T.fract(p);
    const u = f.mul(f).mul(T.vec2(3).sub(f.mul(2)));
    const a = hash12(i);
    const b = hash12(i.add(T.vec2(1, 0)));
    const cc = hash12(i.add(T.vec2(0, 1)));
    const d = hash12(i.add(T.vec2(1, 1)));
    return T.mix(T.mix(a, b, u.x), T.mix(cc, d, u.x), u.y) as F;
  };
  // Valdrada HASH_GLSL pcov: coverage of the pulse [a, b) repeated every 1,
  // box-filtered over a footprint w. The integral of the pulse train is
  // floor(x)·(b−a) + clamp(fract(x)−a, 0, b−a).
  const integral = (x: F, a: number, b: number) => T.floor(x).mul(b - a).add(T.clamp(T.fract(x).sub(a), 0, b - a)) as F;
  const pcov = (x: F, a: number, b: number, w: F) =>
    T.clamp(integral(x.add(w.mul(0.5)), a, b).sub(integral(x.sub(w.mul(0.5)), a, b)).div(w), 0, 1) as F;

  // Tangent frame of a vertical wall from screen derivatives of the uv, so
  // the reveal and the normal map lean the right way whichever direction the
  // ring runs.
  const wallFrame = () => {
    const N = T.normalWorld;
    const up = T.vec3(0, 1, 0);
    const across = T.normalize(T.cross(up, N));
    const dpdx = T.dFdx(T.positionWorld);
    const dpdy = T.dFdy(T.positionWorld);
    const uvx = T.dFdx(T.uv());
    const uvy = T.dFdy(T.uv());
    // Sign of du along `across`: positive when u grows with it.
    const s = T.sign(T.dot(dpdx, across).mul(uvx.x).add(T.dot(dpdy, across).mul(uvy.x)));
    const tangent = across.mul(T.select(s.equal(0), T.float(1), s));
    return { N, tangent, bitangent: up };
  };
  const perturb = (frame: { N: V3; tangent: V3; bitangent: V3 }, sample: V3, strength: F) => {
    const xy = sample.xy.mul(2).sub(1).mul(strength);
    const z = T.sqrt(T.max(T.float(1).sub(T.dot(xy, xy)), 0));
    const world = T.normalize(frame.tangent.mul(xy.x).add(frame.bitangent.mul(xy.y)).add(frame.N.mul(z)));
    return T.transformNormalToView(world);
  };
  const snowCap = (albedo: V3, amount: F) => {
    const up = T.smoothstep(0.4, 0.75, T.normalWorld.y);
    return T.mix(albedo, c('snow'), snow.mul(amount).mul(up)) as V3;
  };

  // ---------------------------------------------------------------- masonry
  const masonry = (() => {
    const grid = WINDOW_GRID.masonry;
    const material = base.masonry as StdMat;
    // aFacade is constant per wall: read it flat, so the layer index and the hash seeds below never see an
    // interpolated 2.9999998 (i32() truncates that to the wrong photo; the hashes amplify the last bits).
    const fac = (T.varying(T.attribute<'vec2'>('aFacade', 'vec2')) as unknown as { setInterpolation(t: string, s?: string): Node<'vec2'> })
      .setInterpolation('flat', 'either');
    const layer = T.round(fac.x) as F;
    const perMetre = fac.y as F;
    const hasPhoto = T.step(-0.5, layer);
    const u = T.uv().x as F;
    const v = T.uv().y as F;
    const frame = wallFrame();

    // Photo grain: sample / layer mean, luminance compressed and chroma
    // limited the way Valdrada's wLumC/wRatC are, faded by footprint.
    const wuv = T.uv().mul(perMetre);
    const photo = T.texture(walls, wuv).depth(T.max(layer, 0)).rgb as V3;
    const mean = pickMean(T, VD_WALL_MEANS, layer);
    const ratio = photo.div(T.max(mean, T.vec3(0.01))) as V3;
    const ratioLum = lum(ratio);
    const lumC = T.pow(T.clamp(ratioLum, 0.55, 1.7), 0.42);
    const chroma = T.clamp(ratio.div(T.max(ratioLum, 0.01)), T.vec3(0.86), T.vec3(1.16));
    const grain = T.mix(T.vec3(1), chroma, 0.3).mul(lumC) as V3;
    const fp = footprint(wuv);
    const near = T.float(1).sub(T.smoothstep(0.008, 0.06, fp));
    const grainK = T.mix(T.float(TUNE.grainFar), T.float(TUNE.grainNear), near).mul(hasPhoto);
    // The photo's own colour brought to the building's brightness, so near
    // walls read as real brick or stone rather than a tinted palette swatch.
    const photoTone = photo.mul(lum(vertexRgb).div(T.max(lum(mean), 0.01))) as V3;
    let wall = T.mix(vertexRgb, photoTone, near.mul(TUNE.photo).mul(hasPhoto)) as V3;
    wall = wall.mul(T.mix(T.vec3(1), grain, grainK)) as V3;
    // Masonry courses (Valdrada's procedural brick and ashlar grid): the
    // 256 px photo cannot hold mortar lines past a few metres, so the
    // joints are drawn and box-filtered, fading once a course is under a
    // couple of pixels. Brick photos (layers 0-2) get 0.3 m courses of
    // 0.62 m bricks with alternate rows offset by half; stone (layer 3)
    // gets 0.66 m courses of 1.32 m blocks; plaster none.
    const isBrick = hasPhoto.mul(T.float(1).sub(T.step(2.5, layer)));
    const isStone = T.step(2.5, layer).mul(T.float(1).sub(T.step(3.5, layer)));
    const courseH = T.mix(T.float(0.3), T.float(0.66), isStone);
    const unitW = T.mix(T.float(0.62), T.float(1.32), isStone);
    const cy = v.div(courseH) as F;
    const cx = u.div(unitW).add(T.floor(cy).mod(2).mul(0.5)) as F;
    const aaY = T.max(T.fwidth(cy), 1e-4);
    // The footprint along the course, without the half-brick row offset: fwidth(cx) jumps to 0.5 on every pixel
    // quad that straddles a course line, which switched the bed joint on that line off and on as the Caller walked.
    const aaX = T.max(T.fwidth(u.div(unitW)), 1e-4);
    // Mortar is 6 % of a brick course and 3 % of its length; stone joints are half that.
    const brickSolid = pcov(cy, 0.06, 1, aaY.mul(1.25)).mul(pcov(cx, 0.03, 1, aaX.mul(1.25)));
    const stoneSolid = pcov(cy, 0.03, 1, aaY.mul(1.25)).mul(pcov(cx, 0.015, 1, aaX.mul(1.25)));
    const solid = T.mix(brickSolid, stoneSolid, isStone);
    // Edges in order (1 - smoothstep): Metal leaves smoothstep undefined for reversed edges (post/pipeline.ts).
    const courseVis = T.float(1).sub(T.smoothstep(0.22, 0.55, T.max(aaX, aaY)));
    // The per-brick tone is a hard-edged hash: it leaves before the joints do, while a brick is still ~10 px long.
    const toneVis = T.float(1).sub(T.smoothstep(0.08, 0.2, T.max(aaX, aaY)));
    const joint = T.float(1).sub(solid).mul(courseVis).mul(T.max(isBrick, isStone)) as F;
    // Per-brick tone drift, the low-frequency variance Valdrada's MAT9 pass added.
    const unitTone = T.float(0.9).add(hash12(T.vec2(T.floor(cx), T.floor(cy)).add(T.vec2(fac.y.mul(97), 0))).mul(0.2));
    wall = wall.mul(T.mix(T.float(1), unitTone, toneVis.mul(isBrick))) as V3;
    wall = T.mix(wall, wall.mul(0.62).add(T.vec3(0.05)), joint.mul(0.8)) as V3;
    // Street grime: the bottom 9 m darken toward the pavement (Valdrada splash term).
    wall = wall.mul(T.float(1).sub(T.float(0.24).mul(T.float(1).sub(T.smoothstep(0, 9, v))))) as V3;

    // Window lattice: whole bays with corner margins would need the wall
    // length, which the merged geometry does not carry; the uv grid already
    // starts each wall at u = 0, so the bays begin at the corner.
    const cu = u.div(grid.bay);
    const cv = v.div(grid.floor);
    const aaU = T.max(T.fwidth(cu), 1e-4).mul(1.25);
    const aaV = T.max(T.fwidth(cv), 1e-4).mul(1.25);
    const [x0, x1, y0, y1] = [0.2, 0.8, 0.3, 0.88];
    const upper = T.smoothstep(3.4, 3.8, v);
    const win = pcov(cu, x0, x1, aaU).mul(pcov(cv, y0, y1, aaV)).mul(upper) as F;
    const tiny = T.smoothstep(0.28, 0.62, T.max(aaU, aaV));

    // Reveal by parallax: the glass sits REC metres back, so the view ray
    // shifts the pane rectangle and the jamb/soffit shows in the gap.
    const ray = T.normalize(T.positionWorld.sub(T.cameraPosition));
    const rd = T.vec3(T.dot(ray, frame.tangent), T.dot(ray, frame.bitangent), T.max(T.dot(ray, frame.N.negate()), 0.04));
    const par = T.clamp(rd.xy.mul(T.float(TUNE.reveal).div(T.max(rd.z, 0.2))), T.vec2(-0.5), T.vec2(0.5));
    const W = (x1 - x0) * grid.bay;
    const H = (y1 - y0) * grid.floor;
    const pu = T.fract(cu).sub(x0).mul(grid.bay).add(par.x);
    const pv = T.fract(cv).sub(y0).mul(grid.floor).add(par.y);
    const aaP = T.max(T.fwidth(pu), 1e-3);
    const insideU = T.smoothstep(aaP.negate(), aaP, pu).mul(T.smoothstep(aaP.negate(), aaP, T.float(W).sub(pu)));
    const insideV = T.smoothstep(aaP.negate(), aaP, pv).mul(T.smoothstep(aaP.negate(), aaP, T.float(H).sub(pv)));
    const glassIn = insideU.mul(insideV);
    const reveal = win.mul(T.float(1).sub(glassIn)).mul(T.float(1).sub(tiny)) as F;
    const pane = win.mul(glassIn) as F;
    // Lintel shadow along the top of the opening.
    const lintelShade = T.mix(T.float(1), T.float(0.62), T.smoothstep(y1 - 0.14, y1, T.fract(cv)).mul(win));

    // Glass: a dark room behind a sky-fresnel sheet.
    const nDotV = T.clamp(T.dot(frame.N, ray.negate()), 0, 1);
    const fres = T.float(0.04).add(T.float(0.96).mul(T.pow(T.float(1).sub(nDotV), 5)));
    const skyRefl = T.mix(c('skyHorizon'), c('skyZenith'), T.clamp(T.reflect(ray, frame.N).y, 0, 1));
    const room = c('roomDark');
    const glass = T.mix(room, skyRefl, T.clamp(fres.mul(0.85).add(0.12), 0, 1)) as V3;

    // Lit rooms: windows.ts litShareAt per cell, the same hash as every lane.
    // The building tone as a flat varying: the seed multiplies it by ~4e6 on the way through the hash, so an
    // interpolated last bit would re-roll which rooms are lit from pixel to pixel.
    const seedRgb = (T.varying(T.attribute<'vec3'>('color', 'vec3')) as unknown as { setInterpolation(t: string, s?: string): V3 })
      .setInterpolation('flat', 'either');
    const seed = T.fract(seedRgb.x.mul(13.7).add(seedRgb.y.mul(7.3))).mul(100);
    const column = T.floor(cu);
    const row = T.floor(cv);
    const hash = (a: F, b: F) => T.fract(T.sin(a.mul(12.9898).add(b.mul(78.233)).add(seed.mul(37.719))).mul(43758.5453)) as F;
    const density = T.float(0.25).add(T.fract(T.sin(seed.mul(7.31).mul(12.9898).add(3.7 * 78.233).add(1.13 * 37.719)).mul(43758.5453)).mul(0.5));
    const share = T.min(T.float(LIT_SHARE_CAP), density.mul(LIT_SHARE_DAY + LIT_SHARE_GAIN * tod));
    const lit = T.step(hash(column, row), share).mul(T.step(1, row));
    const toneHash = hash(column.add(17.1), row.add(3.3));
    const tone = T.mix(T.mix(c('windowWarm'), c('windowAmber'), T.step(0.55, toneHash)), c('windowCool'), T.step(0.88, toneHash));

    // Storefront band: glass with a warm glow, roll-down gates on about a fifth of the 4 m bays.
    const shop = T.smoothstep(0.35, 0.45, v).mul(T.float(1).sub(T.smoothstep(3.05, 3.15, v)));
    const gate = shop.mul(T.step(hash(T.floor(u.div(4)), T.float(-7)), 0.22));
    const ribs = T.mix(c('gate'), c('gate').mul(0.72), T.step(0.5, T.fract(v.div(0.16))));

    // Sub-pixel windows collapse to their average, as Valdrada's `tiny` does.
    const average = T.mix(wall, c('roomDark'), T.float(0.36 * 0.58 * 0.85).mul(upper)) as V3;
    let albedo = T.mix(wall.mul(lintelShade), wall.mul(0.5), reveal) as V3;
    albedo = T.mix(albedo, glass, pane) as V3;
    albedo = T.mix(albedo, glass, shop.mul(T.float(1).sub(gate))) as V3;
    albedo = T.mix(albedo, ribs, gate) as V3;
    albedo = T.mix(albedo, average, tiny) as V3;
    // Damp masonry darkens; glass does not (Valdrada wet facades).
    const masonryShare = T.float(1).sub(T.max(pane, shop));
    albedo = albedo.mul(T.float(1).sub(wet.mul(0.26).mul(masonryShare))) as V3;
    material.colorNode = T.vec4(working(albedo), 1);

    const nSample = T.texture(normals, T.uv().mul(0.42)).depth(T.float(NRM.brick)).rgb as V3;
    const nStrength = T.float(TUNE.normal).mul(near).mul(hasPhoto).mul(masonryShare).mul(T.float(1).sub(reveal));
    material.normalNode = perturb(frame, nSample, nStrength);
    material.roughnessNode = T.mix(T.mix(T.float(0.9), T.float(0.05), T.max(pane, shop.mul(T.float(1).sub(gate)))), T.float(0.4), wet.mul(masonryShare));
    material.metalnessNode = T.float(0);
    // A lit room is not a flat slab: the ceiling light is brightest at the
    // top of the pane and falls off to the floor and the side walls (a
    // cheap stand-in for Valdrada's ray-marched room), and the glass still
    // reflects the sky over it.
    const paneV = T.clamp(pv.div(H), 0, 1);
    const paneU = T.clamp(pu.div(W), 0, 1);
    const roomLight = T.mix(T.float(0.35), T.float(1), T.smoothstep(0.1, 0.95, paneV))
      .mul(T.float(1).sub(T.pow(T.abs(paneU.mul(2).sub(1)), 3).mul(0.45)));
    const reflectOver = T.float(1).sub(T.clamp(fres.mul(0.85), 0, 0.6));
    const glowNear = tone.mul(pane.mul(lit).mul(0.85).mul(roomLight).mul(reflectOver))
      .add(c('windowWarm').mul(shop.mul(T.float(1).sub(gate)).mul(0.45)));
    const glowFar = tone.mul(share.mul(0.22).mul(upper));
    material.emissiveNode = working(T.mix(glowNear, glowFar, tiny) as V3);
    return material;
  })();

  // ------------------------------------------------------------------ ground
  // Wet ground (Valdrada makeGroundMaterial wet block): damp patches from two
  // octaves of value noise, puddles where the noise is high, albedo darkened
  // and roughness dropped by both.
  const wetGround = (xz: Node<'vec2'>) => {
    const n = vnoise(xz.mul(0.13)).mul(0.6).add(vnoise(xz.mul(0.031)).mul(0.4));
    const damp = wet.mul(T.float(0.5).add(n.mul(0.5)));
    const puddle = T.smoothstep(0.66, 0.8, n).mul(wet);
    return { damp, puddle, dark: T.float(1).sub(damp.mul(0.3)).sub(puddle.mul(0.25)) };
  };
  const groundGrain = (photo: V3, meanIdx: number, fp: F, k: number) => {
    const m = VD_GROUND_MEANS[meanIdx]!;
    const ratio = photo.div(T.vec3(m[0]!, m[1]!, m[2]!)) as V3;
    const lumC = T.pow(T.clamp(lum(ratio), 0.5, 1.8), 0.55);
    const near = T.float(1).sub(T.smoothstep(0.01, 0.08, fp));
    return T.mix(T.float(1), lumC, near.mul(k)) as F;
  };
  const flatFrame = () => ({ N: T.normalWorld, tangent: T.vec3(1, 0, 0), bitangent: T.vec3(0, 0, -1) });

  const roads = (() => {
    const material = base.roads as StdMat;
    const graphs = roadsGraphs(THREE);
    const xz = T.positionWorld.xz;
    const tuv = xz.div(2.0);
    const photo = T.texture(groundMaps, tuv).depth(T.float(GND.asphalt)).rgb as V3;
    const fp = footprint(tuv);
    const w = wetGround(xz);
    let albedo = (graphs.albedo as V3).mul(groundGrain(photo, GND.asphalt, fp, 0.8)) as V3;
    albedo = snowCap(albedo.mul(w.dark) as V3, T.float(0.7).add(vnoise(xz.mul(0.4)).mul(0.6)));
    material.colorNode = T.vec4(working(albedo), 1);
    const near = T.float(1).sub(T.smoothstep(0.01, 0.08, fp));
    const n = T.texture(normals, tuv).depth(T.float(NRM.asphalt)).rgb as V3;
    material.normalNode = perturb(flatFrame(), n, near.mul(T.float(1).sub(w.puddle)).mul(0.8));
    const dry = T.mix(T.float(0.92), T.float(0.55), T.min(graphs.paint, 1));
    material.roughnessNode = T.mix(T.mix(dry, T.float(0.32), w.damp.mul(0.65)), T.float(0.06), w.puddle);
    material.metalnessNode = T.float(0);
    // No kerb light line: lane paint only.
    material.emissiveNode = T.vec3(0);
    return material;
  })();

  const sidewalks = (() => {
    const material = base.sidewalks as StdMat;
    const xz = T.positionWorld.xz;
    const flag = xz.div(TUNE.flag);
    const cell = T.floor(flag);
    const aa = T.max(footprint(flag), 1e-4);
    // Joint: a 1.5 cm line at each flag edge, box-filtered like the windows.
    const jw = 0.015 / TUNE.flag;
    const jointU = T.float(1).sub(pcov(flag.x as F, jw, 1 - jw, aa.mul(1.5)));
    const jointV = T.float(1).sub(pcov(flag.y as F, jw, 1 - jw, aa.mul(1.5)));
    const joint = T.max(jointU, jointV);
    const tone = T.float(0.86).add(hash12(cell).mul(0.26));
    const tuv = xz.div(1.8).add(T.vec2(hash12(cell.add(5)), hash12(cell.add(9))));
    const photo = T.texture(groundMaps, tuv).depth(T.float(GND.paving)).rgb as V3;
    const fp = footprint(tuv);
    const near = T.float(1).sub(T.smoothstep(0.02, 0.12, aa));
    const w = wetGround(xz);
    let albedo = vertexRgb.mul(groundGrain(photo, GND.paving, fp, 0.7)).mul(T.mix(T.float(1), tone, near)) as V3;
    albedo = albedo.mul(T.float(1).sub(joint.mul(0.74).mul(near))) as V3;
    albedo = snowCap(albedo.mul(w.dark) as V3, T.float(1).sub(joint.mul(0.5)));
    // Curb faces share this buffer: granite blocks 1.2-2.1 m long with a
    // dark gutter foot and a bright top arris (Valdrada matId 2), not flags.
    const face = T.float(1).sub(T.smoothstep(0.5, 0.9, T.normalWorld.y));
    const blockU = T.uv().x.div(1.65);
    const blockJoint = T.float(1).sub(pcov(blockU as F, 0.02, 1, T.max(T.fwidth(blockU), 1e-4).mul(1.25)));
    const blockTone = T.float(0.85).add(hash12(T.vec2(T.floor(blockU), 3.1)).mul(0.25));
    const faceH = T.uv().y as F;
    const foot = T.smoothstep(0.06, 0.11, faceH);
    const arris = T.smoothstep(0.17, 0.185, faceH).mul(0.25);
    const granite = vertexRgb.mul(blockTone).mul(T.mix(T.float(0.45), T.float(1), foot)).mul(T.float(1).sub(blockJoint.mul(0.4))).add(arris) as V3;
    albedo = T.mix(albedo, granite.mul(w.dark), face) as V3;
    material.colorNode = T.vec4(working(albedo), 1);
    const n = T.texture(normals, tuv).depth(T.float(NRM.paving)).rgb as V3;
    material.normalNode = perturb(flatFrame(), n, near.mul(0.6).mul(T.float(1).sub(w.puddle)));
    material.roughnessNode = T.mix(T.mix(T.float(0.85), T.float(0.32), w.damp.mul(0.65)), T.float(0.08), w.puddle);
    material.metalnessNode = T.float(0);
    // No neon grid: Valdrada's sidewalks are plain concrete flags.
    material.emissiveNode = T.vec3(0);
    return material;
  })();

  const concreteGrain = (material: StdMat, albedoIn: V3, snowK: number) => {
    const xz = T.positionWorld.xz;
    const tuv = xz.div(3.0);
    const photo = T.texture(groundMaps, tuv).depth(T.float(GND.concrete)).rgb as V3;
    const albedo = albedoIn.mul(groundGrain(photo, GND.concrete, footprint(tuv), 0.5)) as V3;
    material.colorNode = T.vec4(working(snowCap(albedo, T.float(snowK))), 1);
  };
  concreteGrain(base.roofs as StdMat, vertexRgb as unknown as V3, 1);
  concreteGrain(base.areas as StdMat, vertexRgb as unknown as V3, 0.9);

  // No painted light pools: in Valdrada the lamps light the street through
  // the shader, and the decal read as a bright patch mid-sidewalk at noon.
  base.lampPools.visible = false;

  // ---------------------------------------------------------- near future
  // The D17 / MOBILE_WORLD_PR_PACK "Future NYC visual layer" on Valdrada's
  // real street: the light is added, nothing real is replaced. Values run
  // past 1 on purpose: AgX rolls them into a glow (no bloom pass on rn-webgpu).
  const vrgb = T.attribute<'vec3'>('color', 'vec3');
  if (!physical) {
  // Sign letters and LED edge strips burn like lit acrylic.
  (base.lettering as StdMat).colorNode = T.vec4(vrgb.mul(2.1), 1);
  // Roofline neon and sign boards.
  (base.neon as StdMat).colorNode = T.vec4(vrgb.mul(1.7), 1);
  // Holographic ad surfaces: the brand gradient as a translucent projection
  // with drifting scan bands, a bright rim and a slow shimmer.
  {
    const holo = base.billboards as StdMat;
    holo.transparent = true;
    holo.depthWrite = false;
    holo.blending = THREE.AdditiveBlending;
    holo.side = THREE.DoubleSide;
    // uv is metres across and up the panel (city-mesh.ts emitBillboard).
    const hv = T.uv().y as F;
    const hu = T.uv().x as F;
    const band = T.smoothstep(0.35, 0.5, T.fract(hv.mul(4).sub(T.time.mul(0.6)))).mul(0.45).add(0.55);
    const sweep = T.smoothstep(0.9, 1, T.fract(hv.mul(0.12).sub(T.time.mul(0.25)))).mul(1.4);
    const shimmer = T.float(0.85).add(T.sin(T.time.mul(3.1).add(hu.mul(1.3))).mul(0.15));
    holo.colorNode = T.vec4(vrgb.mul(band.add(sweep)).mul(shimmer).mul(1.8), 1);
    holo.opacityNode = T.float(0.85);
  }
  }

  // Far crowns in the model trees' own leaf colour (atlas mean), varied a little per tree.
  const leafMean = VD_TREES.reduce((acc, t) => acc.map((v, i) => v + t.leafTone[i]! / VD_TREES.length), [0, 0, 0]);
  const farCrown = () => {
    const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0 });
    const tone = T.attribute<'vec3'>(TONE_ATTRIBUTE, 'vec3');
    m.colorNode = T.vec4(working(T.vec3(leafMean[0]!, leafMean[1]!, leafMean[2]!).mul(T.float(0.8).add(tone.g.mul(0.4))) as V3), 1);
    return m;
  };

  return {
    ...base,
    farCrown,
    masonry,
    roads,
    sidewalks,
    weather: { wet, snow },
    dispose: () => { base.dispose(); walls.dispose(); groundMaps.dispose(); normals.dispose(); },
  };
}

/**
 * Lean vd materials (vd-leanmat.ts): every lit surface becomes an unlit
 * MeshBasicNodeMaterial — vertex colour or a flat palette tone, times
 * LEAN_DUSK so the raw output sits near the dusk-lit level the PBR bodies
 * produce. The wall and ground photo arrays, the window lattice, the
 * weather grain, the normals and the holo time uniforms all go away; the
 * meshes, polygon offsets, alpha tests and fog stay, so each draw encodes
 * a handful of colour nodes instead of the graphs above. Rain and snow
 * still move the weather uniforms for the precipitation mesh — the ground
 * just no longer reads wet. `lights = false` keeps the node builder from
 * wrapping the output in a lighting context (NodeMaterial.setupLighting).
 */
function createLeanVdCityMaterials(THREE: Three, options: PbrCityOptions): VdCityMaterials {
  const { T, c, vertexRgb } = cityShaderTools(THREE);
  const unlit = createUnlitLayers(THREE, options.sunDirection);
  const initial = weatherFromEnv();
  const wet = T.uniform(initial.rain);
  const snow = T.uniform(initial.snow);
  const flat = (params?: BasicParams): BasicMat => {
    const m = new THREE.MeshBasicNodeMaterial(params);
    m.lights = false;
    return m;
  };
  const vertex = (params?: BasicParams): BasicMat => {
    const m = flat(params);
    m.colorNode = T.vec4(vertexRgb.mul(LEAN_DUSK), 1);
    return m;
  };
  const tone = (key: CityColor, params?: BasicParams): BasicMat => {
    const m = flat(params);
    m.colorNode = T.vec4(c(key).mul(LEAN_DUSK), 1);
    return m;
  };
  // The same ground-lane offsets the lit bodies carry (city-mesh draw order).
  const offset = (n: number): BasicParams => ({
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -n, polygonOffsetUnits: -n * 2,
  });

  const masonry = vertex();
  const glass = vertex();
  const roofs = vertex();
  const ground = tone('ground', { side: THREE.DoubleSide });
  const areas = vertex(offset(1));
  const sidewalks = vertex(offset(2));
  // The road vertex colour is data (lane paint + width markers), not a tone — flat asphalt.
  const roads = tone('asphalt', offset(3));
  const trunks = tone('trunk');
  const poles = tone('pole');
  const signBlades = tone('signGreen');
  // Retroreflective self-light, same as the lit lanes; emissiveNode is only
  // declared on the standard/physical types (materials.ts setEmissive).
  (signBlades as unknown as { emissiveNode: Node }).emissiveNode = c('signGreen').mul(0.35);
  // Parked cars keep the body-paint/instance-tone contract so each car keeps its tone.
  const carTone = T.attribute<'vec3'>(TONE_ATTRIBUTE, 'vec3');
  const cars = flat();
  cars.colorNode = T.vec4(T.mix(vertexRgb, carTone, T.step(vertexRgb.x, -0.5)).mul(LEAN_DUSK), 1);

  const leaf = (map: TextureT) => {
    const graphs = leafGraphs(THREE, map);
    const m = flat({ alphaTest: 0.5 });
    m.colorNode = T.vec4(graphs.albedo, 1);
    m.opacityNode = graphs.opacity;
    return m;
  };
  // Far crowns in the model trees' mean leaf colour, varied per tree — the
  // same tone formula the lit lane uses, on the unlit body.
  const leafMean = VD_TREES.reduce((acc, t) => acc.map((v, i) => v + t.leafTone[i]! / VD_TREES.length), [0, 0, 0]);
  const farCrown = () => {
    const m = flat();
    const toneAttr = T.attribute<'vec3'>(TONE_ATTRIBUTE, 'vec3');
    m.colorNode = T.vec4(T.vec3(leafMean[0]!, leafMean[1]!, leafMean[2]!).mul(T.float(0.8).add(toneAttr.g.mul(0.4))), 1);
    return m;
  };
  // No painted light pools, same call as the lit vd lane.
  unlit.lampPools.visible = false;
  const all: Mat[] = [
    unlit.lettering, cars, unlit.sky, masonry, glass, roofs, unlit.accents, unlit.neon, unlit.billboards,
    ground, areas, sidewalks, roads, unlit.shadows, trunks, poles, signBlades, unlit.lampHeads, unlit.lampPools,
  ];
  return {
    sky: unlit.sky, masonry, glass, roofs, accents: unlit.accents, neon: unlit.neon, billboards: unlit.billboards,
    ground, areas, sidewalks, roads, shadows: unlit.shadows, trunks,
    poles, signBlades, lampHeads: unlit.lampHeads, lampPools: unlit.lampPools, lettering: unlit.lettering, cars,
    leaf, farCrown,
    weather: { wet, snow },
    dispose: () => { for (const material of all) material.dispose(); unlit.atlas.dispose(); },
  };
}
