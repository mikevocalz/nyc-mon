// Where the bundled tile actually has geometry, in the scene's local metres.
// The camera store clamps to +/-2000 m (city-camera.ts) and the ground plane is
// 4200 m wide (city-scene.ts), so a player can pan onto bare ground long before
// hitting a limit. That is the screen's "empty" state: an honest "nothing
// mapped here" with a way back, not a blank plane.
import { projectCityPoint, type CityDataset } from './city-dataset.ts';
import type { CityCamera } from './city-scene.ts';

export interface CityBounds { minX: number; maxX: number; minZ: number; maxZ: number }

export function cityDatasetBounds(dataset: CityDataset): CityBounds {
  let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
  for (const feature of dataset.features) {
    for (const point of feature.points) {
      const [x, z] = projectCityPoint(point, dataset.origin);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
  }
  // parseCityDataset rejects empty feature lists, so the bounds are finite.
  return { minX, maxX, minZ, maxZ };
}

/**
 * True when the camera's look-at point is within `margin` metres of mapped
 * geometry. The margin scales with zoom: from far out, the tile is still in
 * view even when the target has drifted off it.
 */
export function isOverMappedArea(camera: CityCamera, bounds: CityBounds): boolean {
  if (![camera.x, camera.z, camera.distance].every(Number.isFinite)) return false;
  const margin = Math.max(120, camera.distance * 0.75);
  const dx = Math.max(bounds.minX - camera.x, 0, camera.x - bounds.maxX);
  const dz = Math.max(bounds.minZ - camera.z, 0, camera.z - bounds.maxZ);
  return Math.hypot(dx, dz) <= margin;
}
