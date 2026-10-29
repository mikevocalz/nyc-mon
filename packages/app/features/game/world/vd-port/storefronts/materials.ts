// The storefronts' three node materials, Valdrada's kit materials translated to TSL (onBeforeCompile -> nodes):
//
//   paint   the kit's metal and paint sets (kitMats.js L40-L55, the tint per vertex as facadeKit's shared-set writers
//           carry it, roughness per vertex), with Valdrada's other opaque materials folded in by attribute, so the far
//           level is one draw a chunk:
//             kitShutterMat (L721-L732: 75 mm slats; aGate marks a curtain, whose foot follows gateDrop)
//             fab_awning (facadeKit.js L2056: the cloth, emitted both ways instead of DoubleSide)
//             int_shop@lvl (L778: selfLit, emission dayK 0.13 to nightK 1.3 times the level) and int_shopLight (L779)
//             the sign faces: lettering coverage (R8 atlas) in the sign's colour over its ground (aBg), lit boxes
//             glowing after dark (shopSigns.js: "internally-lit sign boxes at night, plus a little by day")
//           aLit is the (day, night) emission; a vertex that is not lettering samples the atlas's solid cell
//   detail  the near level through the same graph
//   glass   int_shopglass (kitMats.js L783: opacity 0.16, f0 0.07) and int_frosted (a milky pane, aGlass = 1)
//
// Every piece is a flat box face or quad, so the materials shade flat from derivatives and no normal is uploaded.
// ctx.night is Valdrada's ENV.night. Colours arrive as display sRGB; on the physical stack they decode to linear.
// No import from world/physical/: the vd port loads with the physical stack off (physical-graph.flag-off.test.ts).
import type { Three } from '@acme/ui/three';
import { shadowSafe } from '../shared/shadow-safe.ts';
import type { Node } from 'three/webgpu';
import { decodeBase64 } from '../../foliage-decode.ts';
import type { Slot } from './emit.ts';

type Material = InstanceType<Three['Material']>;
type Tex = InstanceType<Three['DataTexture']>;
type Arg = N | number;

/** The slice of THREE.TSL this file uses, seen structurally (three's own TSL types do not compose across chains). */
interface N {
  readonly x: N; readonly y: N; readonly z: N; readonly w: N; readonly r: N; readonly xyz: N;
  add(v: Arg): N; sub(v: Arg): N; mul(v: Arg): N; div(v: Arg): N; greaterThan(v: Arg): N;
}
interface L {
  float(v: number): N; vec3(...v: Arg[]): N; vec4(...v: Arg[]): N;
  attribute(name: string, type: string): N;
  texture(tex: unknown, uv: N): N;
  uv(): N;
  mix(a: Arg, b: Arg, t: Arg): N; step(e: Arg, x: Arg): N; smoothstep(a: Arg, b: Arg, x: Arg): N;
  fract(x: Arg): N; floor(x: Arg): N; clamp(x: Arg, a: Arg, b: Arg): N; max(a: Arg, b: Arg): N; fwidth(x: Arg): N;
  select(c: N, a: Arg, b: Arg): N; bool(v: boolean): N;
  uniform(v: number): N & { onObjectUpdate(f: () => number): N };
  sRGBTransferEOTF(x: Arg): N;
  positionWorld: N; output: N & { rgb: N };
}

export interface StorefrontMaterials {
  bySlot: Record<Slot, Material>;
  atlas: Tex;
  dispose(): void;
}

/** The atlas as a DataTexture: R8 coverage, mipmapped, labelled (react-native-webgpu has no image decoder). */
export function fasciaTexture(THREE: Three, base64: string, width: number, height: number): Tex {
  const t = new THREE.DataTexture(decodeBase64(base64), width, height, THREE.RedFormat, THREE.UnsignedByteType);
  t.name = 'vd:storefronts:fascia';
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.flipY = false;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

export function createStorefrontMaterials(THREE: Three, night: Node<'float'>, physical: boolean, atlasB64: string, width: number, height: number): StorefrontMaterials {
  const T = THREE.TSL as unknown as L;
  // ctx.night read per object, as the streamer's own dither fade reads cellFade (cell-stream.ts ditherFadeMask), so it
  // joins the object group every cell already has
  const source = night as unknown as { value: number };
  const n = T.uniform(source.value).onObjectUpdate(() => source.value);
  const node = (v: N) => v as unknown as Node;
  const working = (c: N) => (physical ? T.sRGBTransferEOTF(c) : c);
  const vcol = working(T.attribute('color', 'vec4').xyz);
  // after dark every gate is down (gateDrop in emit.ts)
  const closed = T.step(0.5, n);
  const std = (name: string, params: Record<string, unknown>) => {
    const m = new THREE.MeshStandardNodeMaterial({ flatShading: true, ...params });
    m.name = `vd:storefronts:${name}`;
    return m;
  };

  const rough = T.attribute('color', 'vec4').w;

  const atlas = fasciaTexture(THREE, atlasB64, width, height);
  // the far and the near level draw through one graph (two materials so the streamer fades each layer on its own)
  const front = (name: string) => {
    const paint = std(name, { metalness: 0.25 });
    const cov = T.texture(atlas, T.uv()).r;
    const bg = T.attribute('aBg', 'vec4');
    const level = T.attribute('aLit', 'vec2');
    const face = T.mix(working(bg.xyz), vcol, cov);
    const g = T.attribute('aGate', 'vec3');   // x: the curtain's top (world y), y: its foot, z: down by day; y < -999 = no gate
    const isGate = g.y.greaterThan(-999);
    const down = T.mix(g.z, T.float(1), closed);
    const yb = g.x.sub(g.x.sub(g.y).mul(down));
    const y = T.positionWorld.y;
    // 75 mm slats with a dark joint over the top 18 % of each, box-filtered over the pixel's footprint so the ladder
    // settles to its mean far off (the integral of a periodic pulse, as Valdrada's mipmapped slat texture does)
    const s = g.x.sub(y).div(0.075);
    const hw = T.max(T.fwidth(s), 0.0001).mul(0.5);
    const integral = (t: N) => T.floor(t).mul(0.18).add(T.clamp(T.fract(t), 0.82, 1).sub(0.82));
    const joint = integral(s.add(hw)).sub(integral(s.sub(hw))).div(hw.mul(2));
    const bar = T.smoothstep(0, 0.06, y.sub(yb));
    const shutter = face.mul(T.float(1).sub(joint.mul(0.45))).mul(T.mix(T.float(0.55), T.float(1), bar));
    paint.colorNode = node(T.vec4(T.select(isGate, shutter, face), 1)) as never;
    paint.roughnessNode = node(rough) as never;
    // the self-lit surfaces' emission, added to the lit output (as emissiveNode adds it)
    paint.outputNode = node(T.vec4(T.output.rgb.add(face.mul(T.mix(level.x, level.y, n))), T.output.w)) as never;
    // a gate's curtain ends at its foot; a sign without a ground (channel letters, paint) keeps only its letters
    (paint as unknown as { maskNode: Node }).maskNode = node(T.select(isGate, y.greaterThan(yb), bg.w.add(cov).greaterThan(0.5)));
    return paint;
  };
  const paint = front('paint');
  const detail = front('detail');

  const glass = std('glass', { roughness: 0.04, metalness: 0, transparent: true, depthWrite: false });
  const frosted = T.attribute('aGlass', 'float');
  glass.colorNode = node(T.vec4(T.mix(working(T.vec3(0.122, 0.149, 0.169)), working(T.vec3(0.85, 0.86, 0.85)), frosted), 1)) as never;
  glass.opacityNode = node(T.mix(T.float(0.16), T.float(0.85), frosted)) as never;
  // a frosted pane is lit from behind after dark (facadeKit L816-L818)
  glass.emissiveNode = node(working(T.vec3(1, 0.95, 0.85)).mul(frosted).mul(n).mul(0.6)) as never;

  const bySlot: Record<Slot, Material> = { paint: shadowSafe(THREE, paint), detail: shadowSafe(THREE, detail), glass };
  return {
    bySlot,
    atlas,
    dispose() {
      for (const m of Object.values(bySlot)) m.dispose();
      atlas.dispose();
    },
  };
}
