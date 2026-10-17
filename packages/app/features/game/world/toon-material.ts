// The game world's toon (banded, flat-lit) material.
// Clean-room implementation of docs/design/toon-look-spec.md; no code or
// constants from the previous cel material.
//
// Spec §2: an unlit MeshBasicNodeMaterial whose colorNode computes
//   shaded = albedo * (ambient + direct) + rim
//   direct  §2.1 — smoothstep-quantized NdotL ramp, optional third band,
//           optional half-Lambert; `occlusion` multiplies the lit term only.
//   ambient §2.2 — nine-coefficient order-2 SH probe (Ramamoorthi &
//           Hanrahan 2001), evaluated against the world normal.
//   rim     §2.3 — masked fresnel accent; never on ground-facing faces.
//   §2.4 — no specular. The caller's emissiveNode is added after the sum
//   (D17), and scene fog still applies on top (MeshBasicNodeMaterial).
// Uniforms change on rig or palette edits only: no time nodes, no
// per-frame churn for the on-demand canvas (§5).
import type { Color, Node, UniformNode, Vector3 } from 'three/webgpu';
import type { Three } from '@acme/ui/three';
import { CITY_COLORS } from './palette.ts';

type Vec3Tuple = readonly [number, number, number];
type NumUniform = UniformNode<'float', number>;
type ColUniform = UniformNode<'color', Color>;
type Vec3Uniform = UniformNode<'vec3', Vector3>;

/**
 * Order of the nine stored SH coefficients (spec §2.2): the paper's
 * appendix basis — one constant term, three linear in x, y, z, five
 * quadratic — read in scene axes with y as the up pole (the paper's z).
 * Each stored vec3 already folds in the cosine-lobe weight A_l, so the
 * fragment shader is nine fused multiply-adds, no basis normalizers.
 */
export const TOON_SH_BASIS = ['1', 'x', 'y', 'z', 'x*y', 'y*z', '3y*y-1', 'x*z', 'x*x-z*z'] as const;

/** A CITY_COLORS recipe name or raw `#RRGGBB` into a linear working colour. */
function colorOf(THREE: Three, keyOrHex: string): Color {
  const hex = (CITY_COLORS as Record<string, string>)[keyOrHex] ?? keyOrHex;
  return new THREE.Color(hex);
}

// Probe shape weights for toonAmbientProbe — hand-tune starts, all
// TODO(tune) on device against the §6 views.
const HORIZON_BIAS = 0.25; // linear pull of the warm horizon glow toward the sun's bearing
const RING_WARM = 0.1; // warm ring hugging the horizon; lifts mid latitudes, dims the poles
const RING_TILT = 0.15; // ring tilted up toward the sun's ~25° elevation
const RING_AZIMUTH = 0.05; // residual L2 asymmetry along the horizon ring

/**
 * §2.2, authoring route 1 (hand-tuned): nine SH ambient coefficients as
 * linear-space Colors, derived from a hemisphere probe over palette recipes.
 * `hemiSky` up, `hemiGround` down give the pole terms; `skyHorizon` leaned
 * toward `sun` gives a warm bias toward the sun's horizon bearing and a
 * slight directional imbalance so shaded faces are not flat.
 * TODO(tune) on device — route 2 (offline cube-map projection) stays open.
 */
export function toonAmbientProbe(THREE: Three, sunDirection: Vec3Tuple): Color[] {
  const sky = colorOf(THREE, 'hemiSky');
  const ground = colorOf(THREE, 'hemiGround');
  const glow = colorOf(THREE, 'skyHorizon').lerp(colorOf(THREE, 'sun'), 0.4);
  const hl = Math.hypot(sunDirection[0], sunDirection[2]) || 1;
  const sx = sunDirection[0] / hl;
  const sz = sunDirection[2] / hl;
  const sy = Math.max(0, Math.min(1, sunDirection[1]));
  const at = (c: Color, k: number) => c.clone().multiplyScalar(k);
  return [
    at(sky.clone().add(ground), 0.5), // 1 — mid of sky + ground
    at(glow, HORIZON_BIAS * sx), // x — warm pull toward the sun bearing
    at(sky.clone().sub(ground), 0.5), // y — sky above, ground below
    at(glow, HORIZON_BIAS * sz), // z
    at(glow, RING_TILT * sx * sy), // x*y — glow lifted on the sun side
    at(glow, RING_TILT * sz * sy), // y*z
    at(glow, -RING_WARM), // 3y²-1 — ring at horizon, poles pulled down
    at(glow, RING_AZIMUTH * 2 * sx * sz), // x*z
    at(glow, RING_AZIMUTH * (sx * sx - sz * sz)), // x²-z²
  ];
}

/** Scene-wide toon rig (spec §3): the values every toon material shares. */
export interface ToonRigOptions {
  /** Unit world-space sun direction — pass `SUN` from './index.ts'. */
  sunDirection: Vec3Tuple;
  /** Key colour recipe or hex; default 'sun'. */
  sunColor?: string;
  /** TODO(tune): lit-band strength so the key reads warm without blowing. */
  keyIntensity?: number;
  /** Nine SH ambient coefficients; default `toonAmbientProbe(sunDirection)`. */
  ambient?: Color[];
  /** TODO(tune): overall ambient scalar. */
  ambientIntensity?: number;
  /** Rim accent recipe or hex; default 'toonRim' (spec §4). */
  rimColor?: string;
  /** Optional cool fill from the north-east (spec §3); default off. */
  fillColor?: string;
  fillDirection?: Vec3Tuple;
  fillIntensity?: number;
}

export interface ToonRig {
  /** Uniform handles for the debug overlay; set `.value`, never rebuild. */
  uniforms: {
    sunDir: Vec3Uniform;
    keyColor: ColUniform;
    keyIntensity: NumUniform;
    ambientIntensity: NumUniform;
    /** Nine SH coefficients in TOON_SH_BASIS order. */
    ambient: ColUniform[];
    rimColor: ColUniform;
    fillDir: Vec3Uniform;
    fillColor: ColUniform;
    fillIntensity: NumUniform;
  };
}

export function createToonRig(THREE: Three, options: ToonRigOptions): ToonRig {
  const { uniform } = THREE.TSL;
  const sun = options.sunDirection;
  return {
    uniforms: {
      sunDir: uniform(new THREE.Vector3(sun[0], sun[1], sun[2]).normalize(), 'vec3'),
      keyColor: uniform(colorOf(THREE, options.sunColor ?? 'sun')),
      keyIntensity: uniform(options.keyIntensity ?? 1), // TODO(tune) on device
      ambientIntensity: uniform(options.ambientIntensity ?? 1), // TODO(tune) on device
      ambient: (options.ambient ?? toonAmbientProbe(THREE, sun)).map((c) => uniform(c)),
      rimColor: uniform(colorOf(THREE, options.rimColor ?? 'toonRim')),
      fillDir: uniform(new THREE.Vector3(...(options.fillDirection ?? [0.6, 0.25, -0.6])).normalize(), 'vec3'),
      fillColor: uniform(colorOf(THREE, options.fillColor ?? 'toonFill')),
      fillIntensity: uniform(options.fillIntensity ?? 0), // spec §3: default off
    },
  };
}

export interface ToonMaterialOptions {
  /** Albedo node; default the mesh's vertex colours (city bakes them in). */
  albedo?: Node;
  /** Flat albedo recipe/hex (proxy jacket, skin, …) when `albedo` is unset. */
  color?: string;
  /** Baked occlusion (spec §5): vertex attribute or texture; multiplies the
   * lit term only, never the ambient. Default: occlusion-free. */
  occlusion?: Node;
  /** Emissive input, assigned to emissiveNode and added after the sum (D17). */
  emissive?: Node;
  /** §2.1: 2 bands (default) or 3 with a mid band at `midThreshold`. */
  bands?: 2 | 3;
  /** §2.1: half-Lambert the NdotL before the ramp; default off. */
  halfLambert?: boolean;
  /** §2.1: ndotl where the lit band starts. TODO(tune) per material family. */
  threshold?: number;
  /** §2.1: second, lower threshold for the mid band. TODO(tune). */
  midThreshold?: number;
  /** §2.1: mid band's fraction of the key. TODO(tune). */
  midLevel?: number;
  /** §2.1: transition width, ≥ the MSAA shimmer floor. TODO(tune). */
  width?: number;
  /** §2.3: masked fresnel accent; default on (actors), set off for ground
   * and large flat land-use. Buildings: open question (§7). */
  rim?: boolean;
  rimPower?: number; // TODO(tune) edge tightness
  rimStrength?: number; // TODO(tune)
  rimUpWeight?: number; // §2.3 rimMask weight on up-facingness; TODO(tune)
  rimLitWeight?: number; // §2.3 rimMask weight on the lit term; TODO(tune)
  /** §3: add the rig's optional cool fill into ambient (unquantized). */
  fill?: boolean;
}

export interface ToonMaterial {
  material: InstanceType<Three['MeshBasicNodeMaterial']>;
  /** Per-material tunables (spec §4: material uniforms, never tokens). */
  uniforms: {
    threshold: NumUniform;
    midThreshold: NumUniform;
    midLevel: NumUniform;
    width: NumUniform;
    rimPower: NumUniform;
    rimStrength: NumUniform;
    rimUpWeight: NumUniform;
    rimLitWeight: NumUniform;
    occlusion: Node;
    albedo: Node;
  };
}

/**
 * Build the §2 lighting graph on an unlit basic material. One rig can feed
 * many materials; per-material response lives in the returned `uniforms`.
 */
export function createToonMaterial(THREE: Three, rig: ToonRig, options: ToonMaterialOptions = {}): ToonMaterial {
  const { Fn, cameraPosition, dot, float, normalWorld, normalize, positionWorld, pow, saturate, smoothstep, uniform, vec3, vec4, vertexColor } =
    THREE.TSL;
  const u = rig.uniforms;

  const threshold = uniform(options.threshold ?? 0.2); // TODO(tune)
  const midThreshold = uniform(options.midThreshold ?? 0.08); // TODO(tune)
  const midLevel = uniform(options.midLevel ?? 0.55); // TODO(tune)
  const width = uniform(options.width ?? 0.06); // TODO(tune), §5 shimmer floor
  const rimPower = uniform(options.rimPower ?? 3); // TODO(tune)
  const rimStrength = uniform(options.rimStrength ?? 0.5); // TODO(tune)
  const rimUpWeight = uniform(options.rimUpWeight ?? 0.9); // TODO(tune)
  const rimLitWeight = uniform(options.rimLitWeight ?? 0.7); // TODO(tune)

  const albedo = (options.albedo ?? (options.color ? uniform(colorOf(THREE, options.color)) : vec3(vertexColor().xyz))) as Node<'vec3'>;
  const occlusion = (options.occlusion ?? float(1)) as Node<'float'>; // §5: nothing baked -> 1

  const material = new THREE.MeshBasicNodeMaterial({ fog: true });
  if (options.albedo === undefined && !options.color) material.vertexColors = true;
  // emissiveNode is added after the color sum by the node material (D17);
  // the slot exists at runtime but is not in the type declarations.
  if (options.emissive) (material as unknown as { emissiveNode: Node }).emissiveNode = options.emissive;

  material.colorNode = Fn(() => {
    const n = normalWorld;
    // §2.1 quantized diffuse against the rig's sun.
    const ndotl = options.halfLambert ? dot(n, u.sunDir).mul(0.5).add(0.5) : dot(n, u.sunDir);
    const lit = smoothstep(threshold.sub(width), threshold.add(width), ndotl);
    let band = lit;
    if (options.bands === 3) {
      const mid = smoothstep(midThreshold.sub(width), midThreshold.add(width), ndotl);
      band = lit.add(mid.sub(lit).mul(midLevel)); // 0 / midLevel / 1
    }
    const direct = u.keyColor.mul(u.keyIntensity).mul(band).mul(occlusion);

    // §2.2 order-2 SH sky probe, basis order per TOON_SH_BASIS.
    const basis: Node<'float'>[] = [
      float(1),
      n.x,
      n.y,
      n.z,
      n.x.mul(n.y),
      n.y.mul(n.z),
      n.y.mul(n.y).mul(3).sub(1),
      n.x.mul(n.z),
      n.x.mul(n.x).sub(n.z.mul(n.z)),
    ];
    let ambient = u.ambient[0]!.mul(basis[0]!);
    for (let i = 1; i < 9; i++) ambient = ambient.add(u.ambient[i]!.mul(basis[i]!));
    ambient = ambient.mul(u.ambientIntensity);
    if (options.fill) ambient = ambient.add(u.fillColor.mul(u.fillIntensity).mul(saturate(dot(n, u.fillDir))));

    let shaded = albedo.mul(ambient.add(direct));

    if (options.rim !== false) {
      // §2.3 masked fresnel: kept off ground-facing faces, never wraps.
      const v = normalize(cameraPosition.sub(positionWorld));
      const fresnel = pow(float(1).sub(saturate(dot(n, v))), rimPower);
      const rimMask = saturate(n.y.mul(rimUpWeight).add(lit.mul(rimLitWeight)));
      shaded = shaded.add(u.rimColor.mul(rimStrength).mul(fresnel).mul(rimMask));
    }

    return vec4(shaded, 1);
  })();

  return {
    material,
    uniforms: { threshold, midThreshold, midLevel, width, rimPower, rimStrength, rimUpWeight, rimLitWeight, occlusion, albedo },
  };
}
