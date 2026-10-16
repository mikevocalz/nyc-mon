// The Harlem world: sky, ground, the baked city meshes, trees and lights,
// built once per scene from a parsed tile. city-scene.ts owns the camera and
// the actors; this owns everything static. Walkability lives in
// walkability.ts (pure) and bundled-queries.ts (bound to the bundled tile),
// not re-exported here, so the scene chunk never pulls the tile JSON twice.
import type { Three } from '@acme/ui/three';
import type { CityDatasetV2 } from '../city-dataset.ts';
import { buildCityMeshes, type CityMeshStats } from './city-mesh.ts';
import { buildTrees } from './foliage.ts';
import { createCityMaterials, linearColor } from './materials.ts';

/** Afternoon sun from the south-west, high enough that walls on both sides read. Unit vector, scene axes. */
const SUN: readonly [number, number, number] = (() => {
  const v = [-0.45, 0.78, 0.43];
  const l = Math.hypot(v[0]!, v[1]!, v[2]!);
  return [v[0]! / l, v[1]! / l, v[2]! / l] as const;
})();

export interface CityWorldStats extends CityMeshStats { trees: number }

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

  const city = buildCityMeshes(THREE, dataset, materials, away);
  const trees = buildTrees(THREE, dataset, materials);

  const hemi = new THREE.HemisphereLight(linearColor(THREE, 'hemiSky'), linearColor(THREE, 'hemiGround'), 1.6);
  const sun = new THREE.DirectionalLight(linearColor(THREE, 'sun'), 2.2);
  sun.position.set(SUN[0] * 1000, SUN[1] * 1000, SUN[2] * 1000);
  group.add(ground, ...city.meshes, ...trees.objects, hemi, sun, sun.target);

  const horizon = linearColor(THREE, 'skyHorizon');
  const fog = new THREE.Fog(horizon, 600, 2500);

  const stats: CityWorldStats = { ...city.stats, trees: trees.count, drawCalls: city.stats.drawCalls + 4 };
  return {
    group,
    sky,
    fog,
    horizon,
    stats,
    /** Level of detail and air from the camera's distance to its target, metres. */
    setViewDistance(distance: number, far: number) {
      trees.setDistance(distance);
      fog.near = distance * 1.4 + 250;
      fog.far = Math.max(fog.near + 400, Math.min(far * 0.9, distance * 5 + 1600));
    },
    dispose() {
      city.dispose();
      trees.dispose();
      skyGeometry.dispose();
      groundGeometry.dispose();
      materials.dispose();
    },
  };
}

export type CityWorld = ReturnType<typeof buildCityWorld>;
