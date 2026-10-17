// world/car-materials.ts — lane L4, "cars". Behind
// EXPO_PUBLIC_WORLD_CAR_PBR (default OFF, the same truthy table the L1/L2
// flags use) the parked-car material — one InstancedMesh, one material —
// moves off the lane's lit body onto MeshPhysicalNodeMaterial. The merged
// geometry stays exactly as street-props.ts writes it: the paint marker
// (vertex colour below zero takes the instance tone) and the aRoughMetal
// stamps (paint 0.4/0.55, glass 0.08/0, tyre 0.95/0) are the surface data.
// The physical body adds what the standard lane cannot: a clearcoat, and
// per-pixel trim and lamps masked out of car-local position — the geometry
// has no lamp or chrome parts, so positionGeometry IS the mask.
//
//   paint    base colour = the instance tone, a full clearcoat at
//            clearcoatRoughness 0.025 over a 0.38 base — the measured
//            car-paint recipe. TODO(tune) on the device.
//   glass    tinted clearcoat: the authored near-black glass albedo under
//            a full coat. transmissionNode exists in three r186, but it
//            lights through the renderer's backbuffer copy — an extra
//            scene pass plus a bicubic sample per fragment
//            (PhysicalLightingModel's getTransmissionSample), unverified
//            on rn-webgpu and a heavy way to draw a car window. A dark
//            dielectric under a near-mirror coat reads as tinted glass
//            for the cost of one extra lobe, so that is the recipe.
//   chrome   the bumper caps, masked in local space (|x| within 0.35 m of
//            the ends, below belt height), metalness 0.9 / roughness 0.15.
//   lamps    head, tail and taxi-roof lamps as emissive spots in local
//            space, gated by a `lampsOn` float uniform resolved from the
//            L1 sky pick (morning dark, dusk and night lit) so a sky swap
//            flips the lamps without a rebuild. The roof lamp gates a
//            second time on the instance tone being taxi yellow, so plain
//            cars do not burn a sign they never had.
//
// Everything stays lit by the one scene environment: no envNode or envMap
// is set, so NodeManager feeds scene.environment into the physical model
// exactly as it does the L2 standard materials (pbr-materials.ts header).
//
// DEVICE-PENDING, verify on rn-webgpu before unflagging:
// - the clearcoat lobe (PhysicalLightingModel clearcoat path) and the
//   shared PMREM env's role in it — same float-texture caveat the sky rig
//   carries. Without the env the cars still shade off sun + hemi.
// - every lamp spot size and level is a TODO(tune) guess from the
//   geometry's own dimensions, not a measured source.

import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { cityShaderTools, TONE_ATTRIBUTE } from './materials.ts';
import { CITY_COLORS, hexToRgb } from './palette.ts';
import { parseSkyRigFlag, type SkyName } from './sky-rig.ts';
import { CAR_LENGTH, CAR_WIDTH } from './street-props-layout.ts';

type Mat = InstanceType<Three['Material']>;
type PhysMat = InstanceType<Three['MeshPhysicalNodeMaterial']>;

/** Opt-in L4 flag — default OFF. Same truthy set as the L1 rig flag. */
export const EXPERIMENTAL_WORLD_CAR_PBR = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_CAR_PBR);

/** Lamps light on dusk and night; the unflagged world is authored dusk, so it lights too. */
export function carLampsOn(sky: SkyName | undefined): boolean {
  return (sky ?? 'dusk') !== 'morning';
}

/**
 * The measured recipe, all TODO(tune) until eyeballed on a device. Lengths
 * in metres in car-local space (x along the car, y up, z across).
 */
export const CAR_PBR = {
  /** Base roughness under the coat — measured automotive paint. */
  paintRough: 0.38,
  /** A full clearcoat layer, polished near-mirror. */
  clearcoat: 1,
  clearcoatRoughness: 0.025,
  /** Laminated glass keeps a whisper more coat roughness than the paint. */
  glassClearcoatRoughness: 0.06,
  /** Chrome bumpers: bright metal, small but visible scuff. */
  chromeMetal: 0.9,
  chromeRough: 0.15,
  /** Lamp lenses are smooth dielectric over the emissive spots. */
  lensRough: 0.12,
  /** Bumper band: this far in from each end, below this height. */
  bumperReach: 0.35,
  bumperTop: 0.54,
  /** Headlamp/tail-lamp spot centres and radii (y centre, z centre, radii). */
  headlampY: 0.7,
  headlampZ: 0.68,
  headlampRy: 0.16,
  headlampRz: 0.26,
  taillampY: 0.72,
  taillampZ: 0.7,
  taillampRy: 0.15,
  taillampRz: 0.3,
  /** How far off the end face the lamp spot fades, in metres. */
  lampFaceDepth: 0.09,
  /** The roof sign box is 1.45–1.6 m up, ±0.25 long, ±0.2 across. */
  roofLampX: 0.28,
  roofLampZ: 0.24,
  /** Emissive drive — over 1 so the lamps read past the dusk key. */
  headlampLevel: 3,
  taillampLevel: 2.4,
  roofLampLevel: 2.2,
} as const;

/**
 * The physical parked-car material: paint, tinted glass, chrome and lamps
 * on one MeshPhysicalNodeMaterial, in the colours the vertex data already
 * carries. `sky` is the resolved L1 pick (index.ts passes the rig's name,
 * 'dusk' when unflagged) — it seeds the lampsOn uniform, which stays live
 * for runtime flips.
 */
export function createCarPbrMaterial(
  THREE: Three,
  options: { sky?: SkyName } = {},
): { material: PhysMat; lampsOn: { value: number } } {
  const { T, c, vertexRgb } = cityShaderTools(THREE);
  const material = new THREE.MeshPhysicalNodeMaterial();

  const tone = T.attribute<'vec3'>(TONE_ATTRIBUTE, 'vec3');
  const vertexRm = T.attribute<'vec2'>('aRoughMetal', 'vec2');
  const attrRough = vertexRm.x as Node<'float'>;
  const attrMetal = vertexRm.y as Node<'float'>;
  const vertexAo = T.attribute<'float'>('aOcclusion', 'float');
  // Car-local position — instancing lands after this, so the masks are
  // per-fragment on the shared geometry.
  const pos = T.positionGeometry;
  const posX = pos.x as Node<'float'>;
  const posY = pos.y as Node<'float'>;
  const ax = posX.abs() as Node<'float'>;
  const az = pos.z.abs() as Node<'float'>;

  // Surfaces, read off the aRoughMetal stamps and the paint marker.
  const paintMask = T.step(vertexRgb.x, -0.5) as Node<'float'>; // colour below zero = body paint
  const glassMask = T.float(1).sub(T.step(0.15, attrRough)) as Node<'float'>; // glass stamps 0.08, paint 0.4, tyre 0.95
  const half = CAR_LENGTH / 2;
  const bumper = T.smoothstep(half - CAR_PBR.bumperReach, half - 0.15, ax)
    .mul(T.float(1).sub(T.smoothstep(0.5, CAR_PBR.bumperTop, posY))) as Node<'float'>;

  // Lamp spots: soft ellipses on each end face, a small signed band in from
  // the end so they wrap the corner a touch, like real clusters.
  const spot = (cy: number, cz: number, ry: number, rz: number) =>
    T.float(1).sub(
      T.smoothstep(0.5, 1, T.vec2(posY.sub(cy).div(ry), az.sub(cz).div(rz)).length()),
    ) as Node<'float'>;
  const endFace = (side: Node<'float'>) => T.smoothstep(half - CAR_PBR.lampFaceDepth, half - 0.02, side);
  const headMask = spot(CAR_PBR.headlampY, CAR_PBR.headlampZ, CAR_PBR.headlampRy, CAR_PBR.headlampRz).mul(endFace(posX));
  const tailMask = spot(CAR_PBR.taillampY, CAR_PBR.taillampZ, CAR_PBR.taillampRy, CAR_PBR.taillampRz).mul(endFace(posX.negate() as Node<'float'>));
  // The taxi roof sign: only where the roof box stands, only when the
  // instance tone is the taxi yellow (CAR_TONES sit nowhere near it).
  const roofMask = (T.smoothstep(1.45, 1.5, posY)
    .mul(T.step(ax, CAR_PBR.roofLampX))
    .mul(T.step(az, CAR_PBR.roofLampZ)) as Node<'float'>);
  // Instance tones are the palette's display-space channels, so the taxi
  // check compares in that space (c() would re-tag them 'color').
  const taxiRgb = hexToRgb(CITY_COLORS.taxi);
  const isTaxi = T.float(1).sub(T.step(0.05, T.distance(tone, T.vec3(taxiRgb[0], taxiRgb[1], taxiRgb[2])))) as Node<'float'>;

  // Albedo: paint takes the instance tone, chrome reads silver instead of
  // a painted bumper, glass keeps its authored near-black tint.
  let albedo = T.mix(vertexRgb, tone, paintMask) as Node<'vec3'>;
  albedo = T.mix(albedo, c('carSilver'), bumper) as Node<'vec3'>;
  material.colorNode = T.vec4(albedo, 1);

  const lensMask = headMask.add(tailMask).saturate() as Node<'float'>;
  let rough = T.mix(attrRough, T.float(CAR_PBR.paintRough), paintMask) as Node<'float'>;
  rough = T.mix(rough, T.float(CAR_PBR.chromeRough), bumper) as Node<'float'>;
  rough = T.mix(rough, T.float(CAR_PBR.lensRough), lensMask) as Node<'float'>;
  material.roughnessNode = rough;
  let metal = attrMetal;
  metal = T.mix(metal, T.float(CAR_PBR.chromeMetal), bumper) as Node<'float'>;
  metal = T.mix(metal, T.float(0), lensMask) as Node<'float'>; // lamp lenses are dielectric
  material.metalnessNode = metal;
  material.aoNode = vertexAo; // cars carry the open-sky bake (all 1), same contract as the L2 lane

  // Clearcoat: paint and glass wear the coat, chrome and rubber do not.
  material.clearcoatNode = paintMask.add(glassMask).sub(bumper).saturate();
  material.clearcoatRoughnessNode = T.mix(
    T.float(CAR_PBR.clearcoatRoughness),
    T.float(CAR_PBR.glassClearcoatRoughness),
    glassMask,
  );

  const lampsOn = T.uniform(carLampsOn(options.sky) ? 1 : 0);
  const glow = c('lampHead')
    .mul(headMask.mul(CAR_PBR.headlampLevel))
    .add(c('marquee').mul(tailMask.mul(CAR_PBR.taillampLevel)))
    .add(c('windowWarm').mul(roofMask.mul(isTaxi).mul(CAR_PBR.roofLampLevel)));
  material.emissiveNode = glow.mul(lampsOn);

  return { material, lampsOn };
}

/**
 * Swap the flagged physical car material into a built CityMaterials set.
 * The previous `cars` still disposes through the set's own list; the new
 * one is returned for the caller to dispose alongside.
 */
export function applyCarPbrMaterial(
  THREE: Three,
  materials: { cars: Mat },
  options: { sky?: SkyName } = {},
): { dispose(): void } {
  const { material } = createCarPbrMaterial(THREE, options);
  materials.cars = material;
  return { dispose: () => material.dispose() };
}
