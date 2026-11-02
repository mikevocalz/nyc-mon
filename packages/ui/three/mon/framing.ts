import * as THREE from 'three';

/** Share of the frame's height the standing Mon fills. */
export const STAND_FILL = 0.9;

/**
 * Camera position for a Mon standing face-on, centred on its box: the body
 * fills STAND_FILL of the frame's height (or its width, if wider), measured
 * at the box's front face so the nearest parts never clip. The Mon turns at
 * most a quarter, never a full spin, so no turntable sweep is reserved.
 */
export function standFraming(size: THREE.Vector3, camera: THREE.PerspectiveCamera): THREE.Vector3 {
  const vHalf = (camera.fov * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  const toFront = Math.max(size.y / 2 / (STAND_FILL * Math.tan(vHalf)), size.x / 2 / (STAND_FILL * Math.tan(hHalf)));
  return new THREE.Vector3(0, size.y * 0.04, toFront + size.z / 2);
}
