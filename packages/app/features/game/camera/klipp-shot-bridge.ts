/**
 * The Klipp seam for the Game world's camera. A `KlippThree` owns
 * arbitration, blending and the write to the real camera (transform, lens
 * and view offset); this module feeds it two virtual cameras — `explore`,
 * which replays the chase pose every frame, and `shot`, which takes over
 * while a caller holds a shot. No React, no DOM, and nothing allocates
 * inside the per-frame path, so the rig can run on the worklet render
 * runtime once shot state is mirrored there.
 */
import { BlendCurves, hardLookAt, type BlendDefinition, type CameraState } from '@pmndrs/klipp';
import { KlippThree } from '@pmndrs/klipp/three';
import type { PerspectiveCamera } from 'three';

export type ShotVec3 = readonly [number, number, number];
export type ShotQuat = readonly [number, number, number, number];

/** What a caller hands the rig: a fully authored pose and lens, not a tracked rig. */
export interface KlippCameraShot {
  readonly position: ShotVec3;
  readonly quaternion: ShotQuat;
  readonly fov: number;
  readonly near: number;
  readonly far: number;
  /** Normalised frustum offset, 0 centred; Klipp writes it through `setViewOffset`. */
  readonly viewOffset?: readonly [number, number];
  /** World point the shot frames. LOD and fog follow it while the shot is live; defaults to the shot position. */
  readonly lookAt?: ShotVec3;
}

/** Lens bounds. Out-of-range shots clamp, never snap back to `explore` mid-blend. */
export const SHOT_MIN_FOV = 20;
export const SHOT_MAX_FOV = 95;
const SHOT_MIN_NEAR = 0.05;
const SHOT_MAX_FAR = 20_000;
const SHOT_MIN_GAP = 0.1;

/** Fixed arbitration slots; the doc's named shots (ride, scan, encounter, battle) become cameras of their own later. */
const EXPLORE_PRIORITY = 10;
const SHOT_PRIORITY = 40;

const SHOT_BLEND: BlendDefinition = { curve: BlendCurves.easeInOut, time: 0.65 };
/** Reduced motion: every transition resolves in the same frame. */
const CUT_BLEND: BlendDefinition = { curve: BlendCurves.cut, time: 0 };

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Scalar pre-flight, no allocation: a shot the piece could never write never activates. */
const writableShot = (s: KlippCameraShot): boolean => {
  const p = s.position;
  const q = s.quaternion;
  return (
    finite(p?.[0]) && finite(p?.[1]) && finite(p?.[2]) &&
    finite(q?.[0]) && finite(q?.[1]) && finite(q?.[2]) && finite(q?.[3]) &&
    Math.hypot(q[0], q[1], q[2], q[3]) > 1e-6
  );
};

/**
 * Event-time sanitation for `cinematicCameraStore`: rejects values no clamp
 * can repair (non-finite tuples, a zero quaternion) and clamps the rest —
 * out-of-range fov clamps rather than dropping the shot. Not the per-frame
 * path: the piece below re-guards scalar fields without allocating.
 */
export function sanitizeKlippShot(input: KlippCameraShot | null | undefined): KlippCameraShot | null {
  if (!input) return null;
  const { position, quaternion } = input;
  if (
    !Array.isArray(position) || position.length !== 3 || !position.every(finite) ||
    !Array.isArray(quaternion) || quaternion.length !== 4 || !quaternion.every(finite)
  ) return null;
  if (!finite(input.fov) || !finite(input.near) || !finite(input.far)) return null;
  const qlen = Math.hypot(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
  if (!(qlen > 1e-6)) return null;
  const near = clamp(input.near, SHOT_MIN_NEAR, SHOT_MAX_FAR);
  const far = clamp(input.far, near + SHOT_MIN_GAP, SHOT_MAX_FAR);
  const out: {
    -readonly [K in keyof KlippCameraShot]: KlippCameraShot[K];
  } & { viewOffset?: [number, number]; lookAt?: [number, number, number] } = {
    position: [position[0], position[1], position[2]],
    quaternion: [quaternion[0] / qlen, quaternion[1] / qlen, quaternion[2] / qlen, quaternion[3] / qlen],
    fov: clamp(input.fov, SHOT_MIN_FOV, SHOT_MAX_FOV),
    near,
    far,
  };
  if (input.viewOffset && input.viewOffset.every(finite)) {
    out.viewOffset = [clamp(input.viewOffset[0], -1, 1), clamp(input.viewOffset[1], -1, 1)];
  }
  if (input.lookAt && input.lookAt.every(finite)) {
    out.lookAt = [input.lookAt[0], input.lookAt[1], input.lookAt[2]];
  }
  return out;
}

export interface KlippShotRig {
  /** Feed the chase pose each frame, metres. Writes into reused buffers. */
  setChase(position: ShotVec3, target: ShotVec3, near: number, far: number): void;
  /** Feed this frame's shot, or null to hand back to `explore`. */
  setShot(shot: KlippCameraShot | null | undefined): void;
  /** Reduced motion turns every blend into a cut. */
  setReducedMotion(reducedMotion: boolean): void;
  /** Viewport in px, for `viewOffset`'s normalised-to-pixel conversion. */
  setSize(width: number, height: number): void;
  /**
   * Advance arbitration and write the camera through `KlippThree.write`.
   * True while anything still moves, so the on-demand canvas knows to draw
   * another frame. `dt` 0 on a parked canvas is repaired by wall clock while
   * a blend is in flight.
   */
  update(dt: number): boolean;
  /** The last blended output `update` wrote; LOD and the sky follow it. */
  readonly shot: CameraState;
  dispose(): void;
}

/**
 * One `KlippThree` per scene: `explore` holds the chase pose and stays live
 * in standby so a cleared shot blends back to the camera as it is now, and
 * `shot` carries the caller's pose. Both pieces write straight into `out`;
 * a corrupt field holds the previous pose instead of snapping.
 */
export function createKlippShotRig(camera: PerspectiveCamera): KlippShotRig {
  const klipp = new KlippThree(camera);
  klipp.setDefaultBlend(SHOT_BLEND);
  const explore = klipp.addCamera('explore', { priority: EXPLORE_PRIORITY, standbyUpdate: 'always' });
  const shotCamera = klipp.addCamera('shot', { priority: SHOT_PRIORITY, active: false, standbyUpdate: 'never' });

  // Frame inputs, written by setChase/setShot and read by the pieces. `explore`'s
  // lens comes from the camera's captured state, not a constant.
  const chase = { position: [0, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number], near: camera.near, far: camera.far };
  const chaseFov = klipp.initialCameraState.fov;
  let held: KlippCameraShot | null = null;
  let stillMoving = false;
  let pendingTransition = false;
  let lastTick = 0;
  let reduced = false;

  explore.setBody({
    update: (out) => {
      out.position[0] = chase.position[0];
      out.position[1] = chase.position[1];
      out.position[2] = chase.position[2];
      hardLookAt.update(out, chase.target);
      out.fov = chaseFov;
      out.near = chase.near;
      out.far = chase.far;
      out.viewOffset[0] = 0;
      out.viewOffset[1] = 0;
      return false;
    },
  });
  shotCamera.setBody({
    update: (out) => {
      const s = held;
      if (!s) return false;
      const p = s.position;
      const q = s.quaternion;
      if (!finite(p[0]) || !finite(p[1]) || !finite(p[2])) return false;
      const qlen = Math.hypot(q[0], q[1], q[2], q[3]);
      if (!(qlen > 1e-6)) return false;
      out.position[0] = p[0];
      out.position[1] = p[1];
      out.position[2] = p[2];
      out.quaternion[0] = q[0] / qlen;
      out.quaternion[1] = q[1] / qlen;
      out.quaternion[2] = q[2] / qlen;
      out.quaternion[3] = q[3] / qlen;
      if (finite(s.fov)) out.fov = clamp(s.fov, SHOT_MIN_FOV, SHOT_MAX_FOV);
      if (finite(s.near)) out.near = Math.max(s.near, SHOT_MIN_NEAR);
      if (finite(s.far)) out.far = Math.min(Math.max(s.far, out.near + SHOT_MIN_GAP), SHOT_MAX_FAR);
      out.viewOffset[0] = s.viewOffset && finite(s.viewOffset[0]) ? clamp(s.viewOffset[0], -1, 1) : 0;
      out.viewOffset[1] = s.viewOffset && finite(s.viewOffset[1]) ? clamp(s.viewOffset[1], -1, 1) : 0;
      // LOD follows the shot's framed point, or its own position when it has none.
      const look = s.lookAt;
      if (look && finite(look[0]) && finite(look[1]) && finite(look[2])) {
        out.lookAtTarget[0] = look[0];
        out.lookAtTarget[1] = look[1];
        out.lookAtTarget[2] = look[2];
      } else {
        out.lookAtTarget[0] = p[0];
        out.lookAtTarget[1] = p[1];
        out.lookAtTarget[2] = p[2];
      }
      out.hasLookAtTarget = true;
      return false;
    },
  });

  return {
    get shot() {
      return klipp.shot;
    },
    setChase(position, target, near, far) {
      chase.position[0] = position[0];
      chase.position[1] = position[1];
      chase.position[2] = position[2];
      chase.target[0] = target[0];
      chase.target[1] = target[1];
      chase.target[2] = target[2];
      chase.near = near;
      chase.far = far;
    },
    setShot(shot) {
      const next = shot ?? null;
      if (next === held) return;
      held = next;
      const active = next !== null && writableShot(next);
      if (shotCamera.active !== active) shotCamera.active = active;
      pendingTransition = true;
    },
    setReducedMotion(reducedMotion) {
      if (reducedMotion === reduced) return;
      reduced = reducedMotion;
      klipp.setDefaultBlend(reducedMotion ? CUT_BLEND : SHOT_BLEND);
    },
    setSize(width, height) {
      klipp.setSize(width, height);
    },
    update(dt) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      // The canvas is on demand, so a parked frame arrives with dt 0. Blends
      // still need real elapsed time, measured the way actors measure theirs.
      if (!(dt > 0) && (pendingTransition || stillMoving || klipp.isBlending) && lastTick > 0) {
        dt = Math.min(Math.max((now - lastTick) / 1000, 0), 0.1);
      }
      lastTick = now;
      pendingTransition = false;
      stillMoving = klipp.update(dt);
      return stillMoving || klipp.isBlending;
    },
    dispose() {
      klipp.mode = 'disabled';
    },
  };
}
