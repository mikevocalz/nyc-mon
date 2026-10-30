import type { ModelPoints } from './modelBounds.ts';

type Vec3 = [number, number, number];

/**
 * Share of the frame the model fills: its height when it is taller than it is
 * wide on screen, its width when a turn swings it wider than that.
 */
export const FILL = 0.8;
/** How far a drag can tilt the camera above or below the model, in degrees. */
export const MAX_PITCH = 15;

const RAD = Math.PI / 180;

/**
 * What the stage needs to know about a model to frame it at any yaw: the
 * middle of its height, how far it reaches above or below that middle at the
 * worst pitch, and how far it reaches from the axis it turns about.
 * Metres, after the placement scale.
 */
export type TurnExtent = { middle: number; halfHeight: number; reach: number };

/** A model with no readable points: as tall as measured, a quarter of that either side of its axis. */
export function fallbackExtent(heightMeters: number | null | undefined, scale: number): TurnExtent {
  const height = Math.max(0.01, heightMeters ?? 1) * scale;
  return { middle: height / 2, halfHeight: height / 2, reach: height / 4 };
}

/**
 * The room `points` need while the model turns on Y and the camera tilts up to
 * MAX_PITCH either way. Every vertex can face the camera at some yaw, so its
 * worst case at pitch p is |dy| cos p + r sin p, where r is its distance from
 * the turning axis. Taking the maximum per vertex, rather than combining the
 * model's tallest point with its widest, keeps a wide tail from shrinking the
 * frame for the whole body.
 */
export function turnExtent(points: ModelPoints, scale: number): TurnExtent {
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < points.length; i += 3) {
    minY = Math.min(minY, points[i]!);
    maxY = Math.max(maxY, points[i]!);
  }
  const middle = (minY + maxY) / 2;
  const tilts = [0, 0.25, 0.5, 0.75, 1].map((t) => [Math.cos(t * MAX_PITCH * RAD), Math.sin(t * MAX_PITCH * RAD)] as const);
  let halfHeight = 0;
  let reach = 0;
  for (let i = 0; i < points.length; i += 3) {
    const r = Math.hypot(points[i]!, points[i + 2]!);
    const dy = Math.abs(points[i + 1]! - middle);
    reach = Math.max(reach, r);
    for (const [c, s] of tilts) halfHeight = Math.max(halfHeight, dy * c + r * s);
  }
  return { middle: middle * scale, halfHeight: halfHeight * scale, reach: reach * scale };
}

export type PreviewCamera = {
  position: Vec3;
  focalPoint: Vec3;
  /**
   * Euler rotation in degrees that points the camera at `focalPoint`. The
   * preview sets it on a plain ViroCamera rather than handing `focalPoint` to
   * ViroOrbitCamera: ViroOrbitCamera.web's lookAtEuler negates the pitch
   * (`-asin(ny)`), so a camera above the model looked up and away from it.
   * A rotation of +x degrees about X turns the camera's -Z view upward, so
   * looking down from above is a negative X rotation.
   */
  rotation: Vec3;
  /** Full visible height of the orthographic frame, in metres. */
  orthographicScale: number;
};

/**
 * Orthographic camera for one model on a `width` x `height` stage, orbiting its
 * middle at `pitch` degrees (positive looks down). Viro web cannot set a field
 * of view (ViroOrbitCamera.web has no such prop, and the wasm keeps virocore's
 * 90 degree default), and at 90 degrees a turning model's near side looms out
 * of frame. An orthographic frame has no perspective, so the model fills
 * exactly FILL of the stage at every yaw and pitch, and turning never zooms.
 */
export function previewCamera(extent: TurnExtent, position: Vec3, width: number, height: number, pitch = 0): PreviewCamera {
  const aspect = width > 0 && height > 0 ? width / height : 1;
  const half = Math.max(extent.halfHeight, extent.reach / aspect, 1e-3);
  const orthographicScale = (2 * half) / FILL;
  // Far enough back that the near plane never cuts the model; distance does not change its size.
  const distance = 2 * Math.max(extent.halfHeight, extent.reach) + 1;
  const middle = position[1] + extent.middle;
  const p = clampPitch(pitch) * RAD;
  return {
    position: [position[0], middle + distance * Math.sin(p), position[2] + distance * Math.cos(p)],
    focalPoint: [position[0], middle, position[2]],
    rotation: [-clampPitch(pitch), 0, 0],
    orthographicScale,
  };
}

/** Pitch kept within MAX_PITCH either way. */
export function clampPitch(pitch: number): number {
  return Math.max(-MAX_PITCH, Math.min(MAX_PITCH, Number.isFinite(pitch) ? pitch : 0));
}
