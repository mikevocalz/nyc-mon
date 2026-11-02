// The Slop-grade city materials behind EXPO_PUBLIC_WORLD_PHYSICAL: one
// entry point that builds every material this lane owns from the rig's
// uniforms and the tile. Nothing here runs unless the scene calls it with
// the flag on; with the flag off city-scene.ts never imports this module's
// output and city-mesh.ts writes the same bytes as before.
//
// Draw calls: masonry, glass, road and sidewalk replace the existing four
// city-mesh materials one for one (no new draws); road paint adds one mesh;
// fire escapes add three instanced meshes and remove their baked floors
// from the street-detail mesh.
import type { Three } from '@acme/ui/three';
import type { CityDatasetV3 } from '../../city-dataset.ts';
import type { LaneTopology } from '../../living-city/topology.ts';
import { bakeOpenSkyGrid, openSkyTexture, type OpenSkyInput } from './canyon-ao.ts';
import { createCurtainWallMaterial, createPreWarMaterial } from './facade.ts';
import { createFireEscapeMaterials, createFireEscapes, type FireEscapes } from './fire-escapes.ts';
import { buildRoadPaint, createRoadPaintMaterial, createRoadPaintMesh } from './road-paint.ts';
import { createContactShadowMaterial, createRoadSurfaceMaterial, createSidewalkMaterial } from './roads.ts';
import type { PhysicalMaterialUniforms } from './tsl-common.ts';

export type { PhysicalMaterialUniforms } from './tsl-common.ts';
export type { FireEscapePlacement } from './fire-escapes.ts';
export { CLASS_FAMILY, buildingFacade, type FacadeFamily } from './class-family.ts';
export { setupSceneCulling, type SceneCulling } from './culling.ts';

type Mat = InstanceType<Three['Material']>;

export interface PhysicalCityMaterialOptions {
  /** The living-city lane graph the road paint follows; no paint mesh without it. */
  topology?: LaneTopology;
  /**
   * Set when the render pipeline has Slop's `normal` and `metalRough` MRT
   * outputs, so the see-through ground effects leave them alone. Leave off
   * without that pipeline.
   */
  effectMrt?: boolean;
}

export interface PhysicalCityMaterials {
  /** For buildCityMeshes's `materials` (with `{ facadeAttributes: true }`): wall-local pre-war masonry, one draw for every family. */
  masonry: Mat;
  /** Wall-local curtain wall for the glass class. */
  glass: Mat;
  roads: Mat;
  /** Sidewalk flags and granite curb faces (one buffer in city-mesh.ts). */
  sidewalks: Mat;
  /** For the vehicle lane's under-car quads. */
  contactShadow: Mat;
  /** The road markings mesh; null without a topology. */
  roadPaint: InstanceType<Three['Mesh']> | null;
  /** Instanced fire escapes; feed them city-mesh.ts's `physical.fireEscapes` placements. */
  fireEscapes: FireEscapes;
  /** The open-sky grid behind the canyon AO, for inspection. */
  openSky: OpenSkyInput;
  dispose(): void;
}

export function buildPhysicalCityMaterials(
  THREE: Three, uniforms: PhysicalMaterialUniforms, dataset: CityDatasetV3, options: PhysicalCityMaterialOptions = {},
): PhysicalCityMaterials {
  const grid = bakeOpenSkyGrid(dataset.areas, dataset.extentMeters);
  const openSky: OpenSkyInput = { texture: openSkyTexture(THREE, grid), grid };
  const masonry = createPreWarMaterial(THREE, uniforms, { wallLocal: true, openSky });
  const glass = createCurtainWallMaterial(THREE, uniforms, { wallLocal: true, openSky });
  const roads = createRoadSurfaceMaterial(THREE, uniforms, { openSky });
  const sidewalks = createSidewalkMaterial(THREE, uniforms, { openSky });
  const contactShadow = createContactShadowMaterial(THREE, { effectMrt: options.effectMrt });
  const paintMaterial = options.topology ? createRoadPaintMaterial(THREE, uniforms, { effectMrt: options.effectMrt }) : null;
  const roadPaint = options.topology && paintMaterial
    ? createRoadPaintMesh(THREE, buildRoadPaint(dataset, options.topology), paintMaterial)
    : null;
  const fireEscapes = createFireEscapes(THREE, createFireEscapeMaterials(THREE));
  return {
    masonry, glass, roads, sidewalks, contactShadow, roadPaint, fireEscapes, openSky,
    dispose() {
      for (const m of [masonry, glass, roads, sidewalks, contactShadow]) m.dispose();
      paintMaterial?.dispose();
      roadPaint?.geometry.dispose();
      fireEscapes.dispose();
      openSky.texture.dispose();
    },
  };
}
