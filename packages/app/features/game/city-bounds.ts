// Where the bundled tile actually has geometry, in the scene's local metres.
// The camera store clamps to +/-2000 m (city-camera.ts) and the ground plane
// is wider than the tile (world/ground.ts), so a player can pan onto bare
// ground long before hitting a limit. That is the screen's "empty" state: an
// honest "nothing mapped here" with a way back, not a blank plane.
import type { CityDatasetV2, FlatPoints } from './city-dataset.ts';
import type { CityCamera } from './city-scene.ts';

export interface CityBounds { minX: number; maxX: number; minZ: number; maxZ: number }

export function cityDatasetBounds(dataset: CityDatasetV2): CityBounds {
  let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
  const add = (points: FlatPoints) => {
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i]!; const z = points[i + 1]!;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  };
  for (const b of dataset.buildings) add(b.ring);
  for (const r of dataset.roads) add(r.points);
  for (const a of dataset.areas) add(a.ring);
  // parseCityDataset rejects tiles with no buildings, roads or areas, so the bounds are finite.
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
