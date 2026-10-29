// The 'std' family of the structure slots: Valdrada's plain three materials in the pk, lk and vk parts (MeshStandard,
// MeshPhysical, MeshBasic as each part sets them: pkMats.js pkGlow / pkFace / pkGlass / pkFarMat, lkMats.js std, the
// vk materials no describer claims) rebuilt as node materials with the same parameters, and the parts' per-frame
// behaviour (pk/props.js tick L202-L229, lkMats.js lkTick L121-L126) as uniforms the port's update drives.
//
// Canvas maps come from the sign atlas (bake-structures.mjs): a map's uv is moved onto its atlas rect; a map Valdrada
// repeats wraps inside the rect (fract), which is what a repeating CanvasTexture draws.
//
// Not carried over (lane C rule, furniture/materials.ts header): applyLightTrim, applyCityAO, applySnowCap; the
// countdown digits of the pedestrian heads (pkArt pedCountTex is redrawn per second): the count face keeps the canvas it
// was baked with and lights on Valdrada's countdown rule.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import type { SlotDesc } from './cell-package.ts';
import { signalState, walkTimeLeft } from './signal-clock.ts';

type Material = InstanceType<Three['Material']>;
type Texture = InstanceType<Three['Texture']>;
type V3 = Node<'vec3'>;

interface TexRef { kind: string; key: string; repeat: [number, number]; offset: [number, number]; wrap: [number, number]; srgb: boolean }
interface StdDesc extends SlotDesc {
  type: string;
  color: [number, number, number] | null;
  emissive: [number, number, number] | null;
  emissiveIntensity: number;
  roughness: number | null;
  metalness: number | null;
  opacity: number;
  transparent: boolean;
  alphaTest: number;
  side: number;
  depthWrite: boolean;
  vertexColors: boolean;
  blending: number;
  map: TexRef | null;
  emissiveMap: TexRef | null;
  alphaMap: TexRef | null;
  transmission: number | null;
  thickness: number | null;
  ior: number | null;
  clearcoat: number | null;
  clearcoatRoughness: number | null;
  part?: string;
  key?: string;
}

export interface StdEnv {
  night: Node<'float'>;
  physical: boolean;
  /** The sign atlas and its rects ([u0, v0, w, h] per canvas key). */
  atlas: Texture;
  rects: Readonly<Record<string, readonly number[]>>;
}

/** The per-frame emissive gains a std slot answers to (pk tick / lk lkTick), by the part's material key. */
export interface StdDriver {
  update(night: number, timeS: number): void;
}

const smooth = (on: number) => on * on * (3 - 2 * on);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * One node graph for every std slot of a lighting model: the maps are atlas rects in uniforms (a slot without a map
 * samples the atlas's white block), the wrap is a uniform blend of fract and clamp, emissive colour and gain are
 * uniforms, the alpha test a uniform threshold. Slots then differ in uniforms and in pipeline state only (transparent,
 * side, depth write), so the family compiles to one shader per lighting model (standard, physical, basic, and the
 * vertex-coloured far key).
 */
export function createStdMaterial(THREE: Three, desc: SlotDesc, env: StdEnv, drivers: StdDriver[]): Material {
  const T = THREE.TSL;
  const d = desc as StdDesc;
  const working = (x: V3): V3 => (env.physical ? x : (T.sRGBTransferOETF(T.max(x, T.vec3(0))) as V3));
  const white = env.rects.white ?? [0, 0, 0, 0];
  /** A map's rect, repeat/offset and wrap as uniforms; the white block when the slot has none. */
  const sampler = (t: TexRef | null) => {
    const r = t && t.kind === 'canvas' ? env.rects[t.key] ?? white : white;
    const rect = T.uniform(new THREE.Vector4(r[0], r[1], r[2], r[3]));
    const xf = T.uniform(new THREE.Vector4(t?.repeat[0] ?? 1, t?.repeat[1] ?? 1, t?.offset[0] ?? 0, t?.offset[1] ?? 0));
    // 1 where Valdrada's CanvasTexture repeats (RepeatWrapping 1000), 0 where it clamps
    const wrap = T.uniform(new THREE.Vector2(t?.wrap[0] === 1000 ? 1 : 0, t?.wrap[1] === 1000 ? 1 : 0));
    const st = T.uv().mul(xf.xy).add(xf.zw);
    const w = T.mix(T.clamp(st, 0, 1), T.fract(st), wrap);
    return T.texture(env.atlas, rect.xy.add(w.mul(rect.zw)));
  };
  const Ctor = d.type === 'MeshPhysicalMaterial' ? THREE.MeshPhysicalNodeMaterial
    : d.type === 'MeshBasicMaterial' ? THREE.MeshBasicNodeMaterial
      : d.type === 'MeshLambertMaterial' ? THREE.MeshLambertNodeMaterial : THREE.MeshStandardNodeMaterial;
  const m = new Ctor() as InstanceType<Three['MeshStandardNodeMaterial']> & Record<string, unknown>;
  m.name = `vd-std:${d.part ? `${d.part}:${d.key}` : d.name ?? ''}`;
  const color = T.uniform(new THREE.Color(...(d.color ?? [1, 1, 1])));
  const map = sampler(d.map), alphaMap = sampler(d.alphaMap), emissiveMap = sampler(d.emissiveMap);
  let albedo: V3 = (color as unknown as V3).mul(map.rgb) as V3;
  if (d.vertexColors) albedo = albedo.mul(T.attribute<'vec3'>('color', 'vec3')) as V3;
  const alpha = T.uniform(d.opacity ?? 1).mul(map.a).mul(alphaMap.g) as Node<'float'>;
  m.colorNode = T.vec4(working(albedo), alpha);
  m.alphaTestNode = T.uniform(d.alphaTest ?? 0) as unknown as Node<'float'>;
  if ('roughness' in m && d.roughness !== null) m.roughness = d.roughness;
  if ('metalness' in m && d.metalness !== null) m.metalness = d.metalness;
  if (d.type === 'MeshPhysicalMaterial') {
    const p = m as unknown as Record<string, number>;
    if (d.transmission !== null) p.transmission = d.transmission;
    if (d.thickness !== null) p.thickness = d.thickness;
    if (d.ior !== null) p.ior = d.ior;
    if (d.clearcoat !== null) p.clearcoat = d.clearcoat;
    if (d.clearcoatRoughness !== null) p.clearcoatRoughness = d.clearcoatRoughness;
  }
  // emissive: colour x intensity x map; the intensity is a uniform the drivers below set as the parts' ticks do
  const gain = T.uniform(d.emissiveIntensity ?? 0) as unknown as Node<'float'> & { value: number };
  const emissive = T.uniform(new THREE.Color(...(d.emissive ?? [0, 0, 0])));
  m.emissiveNode = working((emissive as unknown as V3).mul(gain).mul(emissiveMap.rgb) as V3);
  m.transparent = d.transparent;
  m.side = d.side as never;
  m.depthWrite = d.depthWrite;
  if (d.blending !== undefined) m.blending = d.blending as never;

  // ---- the parts' per-frame emissive rules
  const key = d.key ?? '';
  if (d.part === 'pk') {
    if (key === 'lum') drivers.push({ update(n) { const on = clamp01((n - 0.06) / 0.24); gain.value = 3.2 * smooth(on); } });
    else if (key === 'globeG' || key === 'globeR') drivers.push({ update(n) { const on = clamp01((n - 0.06) / 0.24); gain.value = 0.25 + 2.4 * smooth(on); } });
    else {
      const lens = /^lens([RAG])_(ew|ns)$/.exec(key);
      const ped = /^ped(Man|Hand|Count)_(ew|ns)$/.exec(key);
      if (lens) drivers.push({ update(_n, t) { gain.value = signalState(t, lens[2] === 'ew') === lens[1] ? 2.4 : 0; } });
      else if (ped) {
        drivers.push({
          update(_n, t) {
            const ew = ped[2] === 'ew';
            const st = signalState(t, ew), left = walkTimeLeft(t, ew);
            const walk = st === 'G' && left > 7, count = st === 'G' && !walk ? Math.ceil(left) : 0;
            const flash = count > 0 && (t % 1) < 0.5;
            gain.value = ped[1] === 'Man' ? (walk ? 1.6 : 0) : ped[1] === 'Hand' ? (!walk && !flash ? 1.6 : 0) : count > 0 ? 1.6 : 0;
          },
        });
      }
    }
  } else if (d.part === 'lk') {
    if (key === 'tube') drivers.push({ update(n) { gain.value = 1.4 + 1.6 * clamp01((n - 0.05) / 0.3); } });
    else if (key === 'canopy') drivers.push({ update(n) { gain.value = 0.3 * (1 - clamp01(n / 0.4)); } });
  }
  return m as unknown as Material;
}
