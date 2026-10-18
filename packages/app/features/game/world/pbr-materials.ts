// world/pbr-materials.ts — lane L2, "real surfaces". Behind
// EXPO_PUBLIC_WORLD_PBR (default OFF, the EXPERIMENTAL_SKY_RIG pattern) the
// city's lit materials move off the cel model onto
// MeshStandardNodeMaterial: the same TSL facade/road/leaf graphs
// (materials.ts — one graph, two lighting bodies) now feed colorNode, while
// roughness and metalness come from the per-vertex aRoughMetal attribute
// (geometry.ts, surfaces.ts ranges) and baked ambient occlusion from the
// per-vertex aOcclusion attribute. The unlit layers — sky, neon, billboards,
// contact shadows, lamp pools, lettering — are the same objects either way.
//
// Lighting arrives from real scene lights: the DirectionalLight sun
// (hardcoded dusk SUN unflagged, the L1 JSON sun when the sky rig is on),
// the hemisphere fill, and scene.environment for image-based specular and
// diffuse. The env hookup is three r186's node path: NodeManager assigns
// nodeBuilder.environmentNode from scene.environment
// (renderers/common/nodes/NodeManager.js getEnvironmentNode), and
// MeshStandardNodeMaterial.setupEnvironment wraps it in an EnvironmentNode
// — no material.envMap is needed. materialEnvIntensity reads
// scene.environmentIntensity when no envMap is set, so env level is a
// scene-wide knob.
//
// AO honesty limits: PhysicalLightingModel.ambientOcclusion multiplies
// aOcclusion into reflectedLight.indirectDiffuse (and the aoNV specular
// approximation) only — it tempers sky/env light, it does NOT shadow the
// direct sun. The sun shadow stays the authored contact-shadow ring mesh
// plus the N·L terminator; rn-webgpu keeps shadowMap.enabled = false. The
// aOcclusion values reuse the contact-shadow reach and fall²·0.34 depth
// (surfaces.ts) rather than a raytraced bake — symmetric (no sun lean),
// vertex-resolution, and absent entirely on instanced geometries (poles,
// blades, trunks, crowns) whose materials use constant roughness/metalness
// instead of attribute reads.
//
// DEVICE-PENDING, verify on rn-webgpu before unflagging:
// - env contribution: the PMREM scene.environment is L1's own
//   device-pending path (float texture upload unverified); without it the
//   standard materials still shade correctly off sun + hemi.
// - vertex-colour × PBR: colorNode carries the authored vertex albedo into
//   the standard BRDF; how the multiplied diffuse reads against the cel
//   bands is an eyeball item, as is every TODO(tune) range in surfaces.ts.

import type { Three } from '@acme/ui/three';
import {
  cityShaderTools,
  createUnlitLayers,
  facadeGraphs,
  leafGraphs,
  linearColor,
  roadsGraphs,
  sidewalkGlow,
  TONE_ATTRIBUTE,
  type CityMaterials,
  type FacadeGraphs,
} from './materials.ts';
import { LIT_SHARE_TOD, WINDOW_GRID } from './windows.ts';
import { CITY_COLORS, type CityColor } from './palette.ts';
import { parseSkyRigFlag } from './sky-rig.ts';
import { surfaceMid } from './surfaces.ts';
import type { Node } from 'three/webgpu';

type Mat = InstanceType<Three['Material']>;
type StdMat = InstanceType<Three['MeshStandardNodeMaterial']>;
type TextureT = InstanceType<Three['Texture']>;
type StdParams = ConstructorParameters<Three['MeshStandardNodeMaterial']>[0];

/** Opt-in L2 flag — default OFF. Same truthy set as the L1 rig flag. */
export const EXPERIMENTAL_WORLD_PBR = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_PBR);

export interface PbrCityOptions {
  /** Sun for the unlit dome's glow disc (index.ts passes the resolved direction). */
  sunDirection: readonly [number, number, number];
  /** Daypart lit share 0 = day … 1 = night (index.ts resolves it from the sky pick). Default dusk. */
  timeOfDay?: number;
}

/**
 * The PBR lane's lit factory: standard node materials reading the
 * aRoughMetal/aOcclusion vertex attributes, the graph masks steering
 * roughness per pixel where geometry cannot (window panes and steel gates
 * inside a masonry wall, lane paint on asphalt).
 */
export function createPbrCityMaterials(THREE: Three, options: PbrCityOptions): CityMaterials {
  const { T, c, vertexRgb } = cityShaderTools(THREE);
  const unlit = createUnlitLayers(THREE, options.sunDirection);
  const vertexRm = T.attribute<'vec2'>('aRoughMetal', 'vec2');
  const vertexAo = T.attribute<'float'>('aOcclusion', 'float');
  // The vec2 swizzle types drop to bare Node; declare the float reads once.
  const attrRough = vertexRm.x as Node<'float'>;
  const attrMetal = vertexRm.y as Node<'float'>;
  const STOREFRONT = surfaceMid('storefront');
  const PAINTED = surfaceMid('paintedMetal');

  /** Attribute-driven lit surface. Only put it on VertexBuffer geometry — instanced primitives lack the attributes. */
  const attr = (params?: StdParams): StdMat => {
    const material = new THREE.MeshStandardNodeMaterial(params);
    material.roughnessNode = attrRough;
    material.metalnessNode = attrMetal;
    material.aoNode = vertexAo;
    return material;
  };
  /** Constant-property lit surface for shared instanced geometry (no per-vertex attributes to read). */
  const solid = (color: Node<'vec3'> | Node<'color'>, roughness: number, metalness = 0): StdMat => {
    const material = new THREE.MeshStandardNodeMaterial();
    material.colorNode = T.vec4(color, 1);
    material.roughness = roughness;
    material.metalness = metalness;
    return material;
  };

  // Facades: the cel albedo/emissive as before; panes and open shopfronts
  // pick up storefront glass values, roll-down gates read as painted steel —
  // all fading out with the pattern's own near mask so the far LOD keeps the
  // flat vertex values.
  const facade = (grid: { floor: number; bay: number }, glassy: boolean): StdMat => {
    const graphs: FacadeGraphs = facadeGraphs(THREE, grid, glassy, options.timeOfDay ?? LIT_SHARE_TOD);
    const material = attr();
    material.colorNode = T.vec4(graphs.albedo, 1);
    // On a curtain wall the panes ARE the curtain — the vertex metal stays;
    // on masonry they are inset glass and take storefront values.
    const glassMask = (glassy ? graphs.shops : T.max(graphs.panes, graphs.shops)) as Node<'float'>;
    material.roughnessNode = T.mix(T.mix(attrRough, STOREFRONT[0], glassMask), PAINTED[0], graphs.gates);
    material.metalnessNode = T.mix(T.mix(attrMetal, STOREFRONT[1], glassMask), PAINTED[1], graphs.gates);
    material.emissiveNode = graphs.emissive;
    return material;
  };
  const masonry = facade(WINDOW_GRID.masonry, false);
  const glass = facade(WINDOW_GRID.glass, true);

  const roofs = attr();
  roofs.colorNode = T.vec4(vertexRgb, 1);

  const flat = (offset: number): StdMat =>
    attr({ side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -offset, polygonOffsetUnits: -offset * 2 });
  // The ground is a PlaneGeometry — no surface attributes, so constants.
  const ground = solid(c('ground'), 0.95);
  ground.side = THREE.DoubleSide;
  const areas = flat(1);
  areas.colorNode = T.vec4(vertexRgb, 1);
  const sidewalks = flat(2);
  sidewalks.colorNode = T.vec4(vertexRgb, 1);
  sidewalks.emissiveNode = sidewalkGlow(THREE);

  const roads = (() => {
    const graphs = roadsGraphs(THREE);
    const material = attr({ side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
    material.colorNode = T.vec4(graphs.albedo, 1);
    // Lane paint sits flatter than tar; it stays dielectric. TODO(tune) lane-marking roughness.
    material.roughnessNode = T.mix(attrRough, 0.55, T.min(graphs.paint, 1));
    material.emissiveNode = graphs.emissive;
    return material;
  })();

  // Constant surfaces: trunk cylinders, sign poles and blades are shared
  // instanced primitives with no surface attributes.
  const trunks = solid(c('trunk'), 0.85);
  const poles = solid(c('pole'), PAINTED[0], PAINTED[1]);
  const signBlades = solid(c('signGreen'), PAINTED[0], PAINTED[1]);
  // Retroreflective self-light, same as the cel lane.
  signBlades.emissiveNode = c('signGreen').mul(0.35);

  // Parked cars: body-paint vertices (colour below zero) take the instance
  // tone, same contract as the cel lane; per-part surfaces come from the
  // aRoughMetal attribute the geometry writer stamps.
  const carTone = T.attribute<'vec3'>(TONE_ATTRIBUTE, 'vec3');
  const cars = attr();
  cars.colorNode = T.vec4(T.mix(vertexRgb, carTone, T.step(vertexRgb.x, -0.5)), 1);

  const all: Mat[] = [
    unlit.lettering, cars, unlit.sky, masonry, glass, roofs, unlit.accents, unlit.neon, unlit.billboards,
    ground, areas, sidewalks, roads, unlit.shadows, trunks, poles, signBlades, unlit.lampHeads, unlit.lampPools,
  ];
  return {
    sky: unlit.sky, masonry, glass, roofs, accents: unlit.accents, neon: unlit.neon, billboards: unlit.billboards,
    ground, areas, sidewalks, roads, shadows: unlit.shadows, trunks,
    poles, signBlades, lampHeads: unlit.lampHeads, lampPools: unlit.lampPools, lettering: unlit.lettering, cars,
    leaf: (map) => createPbrLeafMaterial(THREE, map),
    farCrown: () => createPbrFarCrownMaterial(THREE),
    dispose: () => { for (const material of all) material.dispose(); unlit.atlas.dispose(); },
  };
}

/**
 * Leaf crowns on the standard body: the shared leafGraphs shading and
 * alpha-test cut-out, foliage-family constants since the merged crown
 * geometry carries no surface attributes.
 */
export function createPbrLeafMaterial(THREE: Three, map: TextureT): StdMat {
  const T = THREE.TSL;
  const graphs = leafGraphs(THREE, map);
  const material = new THREE.MeshStandardNodeMaterial({ alphaTest: 0.5 });
  material.colorNode = T.vec4(graphs.albedo, 1);
  material.opacityNode = graphs.opacity;
  material.roughness = 0.8; // foliage family mid — TODO(tune)
  material.metalness = 0;
  return material;
}

/** Far crowns: the same standard-lit ball in the instance tone, no cut-outs. */
export function createPbrFarCrownMaterial(THREE: Three): StdMat {
  const T = THREE.TSL;
  const material = new THREE.MeshStandardNodeMaterial();
  material.colorNode = T.vec4(T.attribute<'vec3'>(TONE_ATTRIBUTE, 'vec3'), 1);
  material.roughness = 0.85;
  material.metalness = 0;
  return material;
}
