// Adapted from mrdoob/slop-newyork @ be65d0a, js/tsl-materials.js roadPuddleField, roadWetMasks, createRoadSurfaceMaterial, createSidewalkMaterial, createCurbMaterial, createContactShadowMaterial (MIT, © 2026 Mr.doob)
// Slop ports the asphalt, sidewalk and curb from three's examples/jsm/generators/city
// (CityGenerator.js createRoadMaterial, SidewalkGenerator.js; MIT, three.js authors).
//
// Street surfaces for the physically lit city. Wetness comes from the
// preset (uRoadWetness): damp stains, a glossy film and standing pools that
// appear, grow and merge as it rises. Water's Fresnel rides on metalness,
// so pools reflect the street through SSR at grazing angles and only darken
// seen from above.
//
// Two Slop terms are left out because they are Manhattan geography: the
// puddle seeded at Slop's spawn point (roadPuddleField `spawnPool`) and the
// Times Square neon tint on wet asphalt (createRoadSurfaceMaterial
// `tsDist`). The wet road still mirrors the sky colours.
//
// city-mesh.ts draws sidewalk flags and granite curb faces from one buffer
// (one draw), so the sidewalk material carries the curb: vertical faces
// take Slop's curb graph, flat ones the flags.
import type { Three } from '@acme/ui/three';
import { physicalCityMaterials } from '@acme/theme';
import { ROADS } from '../physical-materials-constants.ts';
import { canyonSkyAO, type OpenSkyInput } from './canyon-ao.ts';
import { asColorNode, asNode, asTsl, type LooseTsl, type TslNode } from './loose-tsl.ts';
import { physicalTsl, type PhysicalMaterialUniforms } from './tsl-common.ts';
import { worldPatternPosition } from '../render-space.ts';

type StdMat = InstanceType<Three['MeshStandardNodeMaterial']>;
type BasicMat = InstanceType<Three['MeshBasicNodeMaterial']>;
const ST = physicalCityMaterials.street;

/** Slop roadPuddleField: organic standing-water field, higher where water collects. */
export function roadPuddleField(THREE: Three, wx: TslNode, wz: TslNode): TslNode {
  const { T, noise2D } = physicalTsl(THREE);
  const nMacro = noise2D(T.vec2(wx.mul(0.095), wz.mul(0.075)));
  const nMid = noise2D(T.vec2(wx.mul(0.25).add(19.4), wz.mul(0.22).add(11.8)));
  const nDetail = noise2D(T.vec2(wx.mul(0.68).sub(7.3), wz.mul(0.68).add(29.1)));
  return nMacro.mul(0.52).add(nMid.mul(0.34)).add(nDetail.mul(0.14));
}

/**
 * Slop roadWetMasks: x = damp stains, y = standing water, z = wet film. Water
 * collects in the field's highest spots first; `drainage` raises the water
 * line for better-drained surfaces.
 */
export function roadWetMasks(T: LooseTsl, wetness: TslNode, field: TslNode, drainage = 0.0): TslNode {
  const level = T.mix(T.float(0.86), T.float(0.56), T.clamp(wetness.sub(0.1).div(0.55), 0.0, 1.0)).add(drainage);
  const damp = T.smoothstep(level.sub(0.09), level.sub(0.015), field);
  const puddle = T.smoothstep(level, level.add(0.022), field).mul(T.smoothstep(0.1, 0.22, wetness));
  const film = T.smoothstep(0.2, 0.8, wetness);
  return T.vec3(damp, puddle, film);
}

/** Slop's `_transparentEffectMRT`: decals leave the G-buffer underneath intact. Only for a pipeline with those MRT outputs. */
export type MrtNode = NonNullable<StdMat['mrtNode']>;
export function transparentEffectMrt(T: LooseTsl): MrtNode {
  return T.mrt({ normal: T.vec4(0.0, 0.0, 0.0, 0.0), metalRough: T.vec4(0.0, 0.0, 0.0, 0.0) }) as MrtNode;
}

export interface StreetOptions {
  openSky?: OpenSkyInput;
}

/** Slop createRoadSurfaceMaterial: asphalt, aggregate relief, manholes and post-rain wetness. */
export function createRoadSurfaceMaterial(THREE: Three, uniforms: PhysicalMaterialUniforms, opts: StreetOptions = {}): StdMat {
  const { T, c, hash2D, noise2D, bumpNormal } = physicalTsl(THREE);
  const wetness = asTsl(uniforms.uRoadWetness);
  const mat = new THREE.MeshStandardNodeMaterial({ metalness: 0.24, roughness: 0.48 });
  const wp = asTsl(worldPatternPosition(THREE));
  const wx = wp.x;
  const wz = wp.z;
  const wet = roadWetMasks(T, wetness, roadPuddleField(THREE, wx, wz));
  const damp = wet.x; const puddle = wet.y; const film = wet.z;
  // World size of a pixel: fine texture settles to its mean before it can alias.
  const pixelSize = T.length(T.fwidth(T.positionWorld.xz));
  const viewDir = T.normalize(T.cameraPosition.sub(T.positionWorld));
  const waterFresnel = T.pow(T.float(1.0).sub(T.clamp(viewDir.y, 0.0, 1.0)), 5.0).mul(1 - ROADS.waterF0).add(ROADS.waterF0);

  mat.aoNode = asNode(canyonSkyAO(THREE, opts.openSky));

  mat.colorNode = asColorNode(T.Fn(() => {
    const camDist = T.length(T.positionWorld.sub(T.cameraPosition));
    const detail = T.smoothstep(240.0, 22.0, camDist);
    // Two-scale aggregate grit, patchwork pours, oily wear stains and tar crack seams.
    const microAggregate = T.mix(T.float(0.5), noise2D(T.vec2(wx.mul(16.0), wz.mul(16.0))), T.smoothstep(0.06, 0.02, pixelSize));
    const fineGrain = T.mix(T.float(0.5), noise2D(T.vec2(wx.mul(3.2), wz.mul(3.2))), T.smoothstep(0.4, 0.12, pixelSize));
    const patchNoise = noise2D(T.vec2(wx.mul(0.18), wz.mul(0.18)));
    const oilyStain = T.smoothstep(0.52, 0.84, noise2D(T.vec2(wx.mul(0.42), wz.mul(0.42)))).mul(detail);
    const tarSeam = T.float(1.0).sub(T.smoothstep(0.0, 0.04, T.abs(patchNoise.sub(0.52)))).mul(0.42).mul(detail);
    const baseAsphalt = T.mix(c(ST.asphaltDark), c(ST.asphaltLight), fineGrain.mul(0.36).add(microAggregate.mul(0.22)).add(patchNoise.mul(0.26)))
      .mul(T.float(1.0).sub(oilyStain.mul(0.32)))
      .mul(T.float(1.0).sub(tarSeam));
    // Cast-iron manhole covers, one 14 m cell in three.
    const cell = ROADS.manholeCell;
    const mhCell = T.floor(T.vec2(wx, wz).div(cell));
    const mhCentre = mhCell.add(T.vec2(hash2D(mhCell.add(13.7)), hash2D(mhCell.add(29.1))).mul(0.6).add(0.2)).mul(cell);
    const mhDist = T.length(T.vec2(wx, wz).sub(mhCentre));
    const isManhole = T.float(1.0).sub(T.smoothstep(ROADS.manholeInner, ROADS.manholeOuter, mhDist)).mul(T.step(0.66, hash2D(mhCell))).mul(detail);
    const mhRings = T.sin(mhDist.mul(36.0)).mul(0.15).add(0.85);
    // Water in the pores darkens the surface: damp stains and pools most, the film a little.
    const wetDarkening = T.mix(T.mix(T.float(1.0), T.float(0.72), damp), T.float(0.6), puddle).mul(T.mix(T.float(1.0), T.float(0.8), film));
    return T.mix(baseAsphalt, c(ST.manhole).mul(mhRings), isManhole).mul(wetDarkening);
  })());

  mat.roughnessNode = asNode(T.Fn(() => {
    const microRough = T.mix(T.float(0.04), noise2D(wp.xz.mul(12.0)).mul(0.08), T.smoothstep(0.08, 0.03, pixelSize));
    const wetRough = T.mix(T.float(0.9).add(microRough), T.float(0.38), T.max(film.mul(0.9), damp.mul(0.8)));
    return T.mix(wetRough, T.float(0.1), puddle);
  })());

  // Water's Fresnel (F0 0.02) weights SSR and trades diffuse for reflection in pools and, partly, the film.
  mat.metalnessNode = asNode(T.clamp(waterFresnel.mul(1.6), 0.0, 0.85).mul(T.max(puddle, film.mul(0.6))));

  // 3.2 mm + 1.6 mm aggregate relief, footprint gated, flattened inside pools so reflections stay crisp.
  mat.normalNode = asNode(T.Fn(() => {
    const coarseFade = T.smoothstep(0.08, 0.025, pixelSize);
    const fineFade = T.smoothstep(0.02, 0.006, pixelSize).mul(T.float(1.0).sub(film.mul(0.6)));
    const coarseGrit = noise2D(T.vec2(wx.mul(8.5), wz.mul(8.5))).sub(0.5).mul(0.0032).mul(coarseFade);
    const fineGrit = noise2D(T.vec2(wx.mul(36.0), wz.mul(36.0))).sub(0.5).mul(0.0016).mul(fineFade);
    return bumpNormal(coarseGrit.add(fineGrit).mul(T.float(1.0).sub(puddle)));
  })());

  mat.emissiveNode = asNode(T.Fn(() => {
    const roadFresnel = T.pow(T.clamp(T.float(1.0).sub(T.abs(viewDir.y)), 0.0, 1.0), 2.3);
    const skyMirror = T.mix(asTsl(uniforms.uSkyHorizonColor), asTsl(uniforms.uSkyTopColor), 0.4).mul(0.1);
    return skyMirror.mul(T.max(puddle, film.mul(0.35))).mul(roadFresnel).mul(asTsl(uniforms.uInteriorGlow)).mul(0.07);
  })());

  mat.name = 'physical:road';
  return mat;
}

/** Slop createSidewalkMaterial, with createCurbMaterial on the vertical curb faces that share its buffer. */
export function createSidewalkMaterial(THREE: Three, uniforms: PhysicalMaterialUniforms, opts: StreetOptions = {}): StdMat {
  const { T, c, hash2D, noise2D, bumpNormal, gridLine } = physicalTsl(THREE);
  const wetness = asTsl(uniforms.uRoadWetness);
  const mat = new THREE.MeshStandardNodeMaterial({ metalness: 0.0, roughness: 0.88 });
  const wp = asTsl(worldPatternPosition(THREE));
  const wx = wp.x;
  const wz = wp.z;
  const flag = ROADS.sidewalkFlag;
  // Damp patches and pools on the flags (their own field; they drain better than the roadway).
  const swField = noise2D(T.vec2(wx.mul(0.14).add(7.4), wz.mul(0.14).sub(13.1))).mul(0.65)
    .add(noise2D(T.vec2(wx.mul(0.38), wz.mul(0.38))).mul(0.35));
  const swWet = roadWetMasks(T, wetness, swField, ROADS.sidewalkDrainage);
  const swPuddle = swWet.y.mul(T.smoothstep(0.5, 0.9, T.normalWorldGeometry.y));
  const swFresnel = T.pow(T.float(1.0).sub(T.clamp(T.normalize(T.cameraPosition.sub(T.positionWorld)).y, 0.0, 1.0)), 5.0)
    .mul(1 - ROADS.waterF0).add(ROADS.waterF0);
  const pixelSize = T.length(T.fwidth(T.positionWorld.xz));
  // 1 on the granite curb faces, 0 on the flags.
  const curb = T.float(1.0).sub(T.smoothstep(0.5, 0.85, T.normalWorldGeometry.y));
  const curbWetFilm = T.smoothstep(0.2, 0.8, wetness);

  mat.aoNode = asNode(canyonSkyAO(THREE, opts.openSky));

  mat.colorNode = asColorNode(T.Fn(() => {
    const camDist = T.length(T.positionWorld.sub(T.cameraPosition));
    const detail = T.smoothstep(190.0, 16.0, camDist);
    const panelHash = hash2D(T.floor(T.vec2(wx.div(flag), wz.div(flag))));
    const tone = noise2D(T.vec2(wx.mul(0.48), wz.mul(0.48)));
    const grit = noise2D(T.vec2(wx.mul(14.0), wz.mul(14.0))).sub(0.5).mul(0.08).mul(detail).mul(T.smoothstep(0.07, 0.02, pixelSize));
    const joints = T.max(gridLine(wx, flag, ROADS.flagJoint), gridLine(wz, flag, ROADS.flagJoint)).mul(detail);
    const baseConcrete = T.mix(c(ST.concreteB), c(ST.concreteA), tone)
      .mul(panelHash.sub(0.5).mul(0.16).add(1.0))
      .add(grit)
      .mul(T.mix(T.float(1.0), T.float(0.72), T.max(swWet.x, swPuddle)))
      .mul(T.mix(T.float(1.0), T.float(0.8), swWet.z));
    const flags = baseConcrete.mul(T.float(1.0).sub(joints.mul(0.45)));

    // Curb face: dressed granite with 1.5 m segment joints, grimier toward the road, rain-darkened like the roadway.
    const curbDetail = T.smoothstep(180.0, 16.0, camDist);
    const curbTone = noise2D(T.vec2(wx.mul(0.6), wz.mul(0.6)));
    const speckle = noise2D(T.vec2(wx.mul(18.0), wz.mul(18.0))).sub(0.5).mul(0.06).mul(curbDetail);
    const stone = T.mix(c(ST.graniteA), c(ST.graniteB), curbTone).add(speckle);
    const curbJoints = T.max(gridLine(wx, flag, ROADS.curbJoint), gridLine(wz, flag, ROADS.curbJoint)).mul(curbDetail);
    const granite = stone.mul(0.68).mul(T.float(1.0).sub(curbJoints.mul(0.42))).mul(T.mix(T.float(1.0), T.float(0.78), curbWetFilm));
    return T.mix(flags, granite, curb);
  })());

  mat.roughnessNode = asNode(T.Fn(() => {
    const panelHash = hash2D(T.floor(T.vec2(wx.div(flag), wz.div(flag))));
    const wetRough = T.mix(T.float(0.9).sub(panelHash.mul(0.06)), T.float(0.55), T.max(swWet.z, swWet.x.mul(0.7)));
    const flags = T.mix(wetRough, T.float(0.2), swPuddle);
    const granite = T.mix(T.float(0.72), T.float(0.5), curbWetFilm);
    return T.mix(flags, granite, curb);
  })());

  mat.metalnessNode = asNode(
    T.mix(T.clamp(swFresnel.mul(1.6), 0.0, 0.85).mul(T.max(swPuddle, swWet.z.mul(0.3))), T.float(0.06), curb),
  );

  // −12 mm scored joints and +3 mm aggregate on the flags; 2.2 mm grain on the granite.
  mat.normalNode = asNode(T.Fn(() => {
    const camDist = T.length(T.positionWorld.sub(T.cameraPosition));
    const detail = T.smoothstep(140.0, 14.0, camDist);
    const joints = T.max(gridLine(wx, flag, ROADS.flagJoint), gridLine(wz, flag, ROADS.flagJoint));
    const grain = noise2D(T.vec2(wx.mul(4.5), wz.mul(4.5))).sub(0.5).mul(0.003);
    const flagHeight = grain.sub(joints.mul(ROADS.flagJointDepth)).mul(detail).mul(T.float(1.0).sub(swPuddle));
    const curbDetail = T.smoothstep(120.0, 12.0, camDist);
    const curbHeight = noise2D(T.vec2(wx.mul(5.5), wz.mul(5.5))).sub(0.5).mul(0.0022).mul(curbDetail);
    return bumpNormal(T.mix(flagHeight, curbHeight, curb));
  })());

  mat.name = 'physical:sidewalk';
  return mat;
}

/**
 * Slop createContactShadowMaterial: a soft rounded-rectangle shadow under a
 * vehicle on a unit quad, darker under the tyres. For the vehicle lane's
 * per-car quads; the building contact shadows stay city-mesh.ts's own.
 */
export function createContactShadowMaterial(THREE: Three, opts: { effectMrt?: boolean } = {}): BasicMat {
  const { T, c } = physicalTsl(THREE);
  const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  const shadowOpacity = T.Fn(() => {
    const uvCentered = T.uv().sub(T.vec2(0.5, 0.5)).mul(2.0);
    const p = T.abs(uvCentered);
    // Rounded-box SDF in [-1, 1]² quad coordinates, falling to 0 before the quad edges.
    const q = p.sub(T.vec2(0.64, 0.7));
    const d = T.length(T.max(q, T.vec2(0.0, 0.0))).add(T.min(T.max(q.x, q.y), 0.0));
    const chassisAO = T.smoothstep(0.3, -0.14, d);
    const coreAO = T.smoothstep(0.76, 0.12, p.x).mul(T.smoothstep(0.82, 0.16, p.y));
    const wheelPatch = T.smoothstep(0.22, 0.0, T.length(p.sub(T.vec2(0.68, 0.56)).mul(T.vec2(1.4, 1.0))));
    return T.clamp(chassisAO.mul(0.72).add(coreAO.mul(0.18)).add(wheelPatch.mul(0.18)), 0.0, 0.88);
  })();
  mat.colorNode = asColorNode(c(ST.contactShadow));
  mat.opacityNode = asNode(shadowOpacity);
  if (opts.effectMrt) {
    // Fades wet-road SSR under the car in proportion to the shadow (0 at the quad edges).
    mat.mrtNode = T.mrt({ normal: T.vec4(0.0, 0.0, 0.0, 0.0), metalRough: T.vec4(0.0, 1.0, 0.0, shadowOpacity.mul(0.88)) }) as MrtNode;
  }
  mat.name = 'physical:contact-shadow';
  return mat;
}
