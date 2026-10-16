// The Harlem world: sky, ground, the baked city meshes, trees and lights,
// built once per scene from a parsed tile. city-scene.ts owns the camera and
// the actors; this owns everything static. Walkability lives in
// walkability.ts (pure) and bundled-queries.ts (bound to the bundled tile),
// not re-exported here, so the scene chunk never pulls the tile JSON twice.
import type { Three } from '@acme/ui/three';
import type { CityDatasetV2 } from '../city-dataset.ts';
import { buildCityMeshes, SHADOW_BAND_METRES, shadowBands, type CityMeshStats } from './city-mesh.ts';
import { buildStreetProps } from './street-props.ts';
import { buildTrees, type TreeReport } from './foliage.ts';
import { buildStreetFurniture } from './street-furniture.ts';
import { createStreetClearance } from './walkability.ts';
import { createCityMaterials, linearColor } from './materials.ts';

/**
 * Dusk sun, low in the south-west (about 25 degrees up): long light on the
 * west and south walls, the rest of the city in the cel mid band, where the
 * neon and the lit windows read. Unit vector, scene axes.
 */
export const SUN: readonly [number, number, number] = (() => {
  const v = [-0.62, 0.45, 0.64];
  const l = Math.hypot(v[0]!, v[1]!, v[2]!);
  return [v[0]! / l, v[1]! / l, v[2]! / l] as const;
})();

export interface CityWorldStats extends CityMeshStats {
  trees: number; signs: number; streetlights: number;
  /** Trees the street clearance moved, shrank or dropped. */
  treeClearance: TreeReport;
  props: ReturnType<typeof buildStreetProps>['stats'];
}

export function buildCityWorld(THREE: Three, dataset: CityDatasetV2) {
  const materials = createCityMaterials(THREE, SUN);
  const group = new THREE.Group();
  group.name = 'city:world';
  // Contact shadows lean away from the sun, along the ground.
  const away: [number, number] = (() => {
    const l = Math.hypot(SUN[0], SUN[2]) || 1;
    return [-SUN[0] / l, -SUN[2] / l];
  })();

  // Big unlit dome around the camera; city-scene.ts keeps it centred and sized to the far plane.
  const skyGeometry = new THREE.SphereGeometry(1, 32, 16);
  const sky = new THREE.Mesh(skyGeometry, materials.sky);
  sky.name = 'city:sky';
  sky.renderOrder = -10;
  sky.frustumCulled = false;

  const groundSize = (dataset.extentMeters + 1500) * 2;
  const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize).rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeometry, materials.ground);
  ground.name = 'city:ground';

  // One street-clearance index for every tree, pole, sign, stoop and prop.
  const clearance = createStreetClearance(dataset);
  const city = buildCityMeshes(THREE, dataset, materials, away, clearance);
  const trees = buildTrees(THREE, dataset, materials, clearance);
  const furniture = buildStreetFurniture(THREE, dataset, materials, clearance, city.texts);
  const props = buildStreetProps(THREE, dataset, materials, clearance, furniture.signs, furniture.lights);
  const bandMinZ = -dataset.extentMeters - SHADOW_BAND_METRES;
  const bandCount = Math.max(1, Math.ceil((dataset.extentMeters * 2 + SHADOW_BAND_METRES * 2) / SHADOW_BAND_METRES) + 1);

  const hemi = new THREE.HemisphereLight(linearColor(THREE, 'hemiSky'), linearColor(THREE, 'hemiGround'), 1.6);
  const sun = new THREE.DirectionalLight(linearColor(THREE, 'sun'), 2.2);
  sun.position.set(SUN[0] * 1000, SUN[1] * 1000, SUN[2] * 1000);
  group.add(ground, ...city.meshes, ...trees.objects, ...furniture.objects, ...props.objects, hemi, sun, sun.target);

  const horizon = linearColor(THREE, 'skyHorizon');
  const fog = new THREE.Fog(horizon, 600, 2500);

  const stats: CityWorldStats = {
    ...city.stats, trees: trees.count, signs: furniture.stats.signs, streetlights: furniture.stats.streetlights, treeClearance: trees.report,
    props: props.stats,
    drawCalls: city.stats.drawCalls + trees.objects.length + furniture.objects.length + props.objects.length + 2,
  };
  let viewDistance = 220;
  return {
    group,
    sky,
    fog,
    horizon,
    stats,
    /** Level of detail and air from the camera's distance to its target, metres. */
    setViewDistance(distance: number, far: number) {
      viewDistance = distance;
      furniture.setDistance(distance);
      props.setDistance(distance);
      fog.near = distance * 1.4 + 250;
      fog.far = Math.max(fog.near + 400, Math.min(far * 0.9, distance * 5 + 1600));
    },
    /**
     * The Caller (the camera's look-at point). Trees, contact shadows, sign
     * lettering and light pools draw around it; each refresh is
     * allocation-free and only runs after it has moved about 10 m.
     */
    setFocus(x: number, z: number) {
      trees.update(x, z, viewDistance);
      city.setFocus(x, z);
      furniture.setFocus(x, z);
      const [first, last] = shadowBands(z, bandMinZ, bandCount);
      props.setFocus(x, z, first, last);
    },
    dispose() {
      city.dispose();
      trees.dispose();
      furniture.dispose();
      props.dispose();
      skyGeometry.dispose();
      groundGeometry.dispose();
      materials.dispose();
    },
  };
}

export type CityWorld = ReturnType<typeof buildCityWorld>;
