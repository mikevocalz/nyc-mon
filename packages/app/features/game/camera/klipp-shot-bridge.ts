/**
 * Renderer-neutral bridge for @pmndrs/klipp v0.14 `klipp.shot`.
 * Klipp owns target tracking, virtual-camera priorities, blending and motion.
 * This is the narrow, testable last mile to the native Three.js camera. It does
 * not import R3F, DOM inputs or another Three renderer.
 */
export type Vector3 = readonly [number,number,number];
export type Quaternion = readonly [number,number,number,number];
export interface KlippCameraShot {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
  readonly fov: number;
  readonly near: number;
  readonly far: number;
}
export type NycMonShot = 'explore'|'ride'|'scan'|'encounter'|'battle';
export interface ShotTriggers { battle?: boolean; encounter?: boolean; scanner?: boolean; riding?: boolean }

/** Highest-priority relevant shot. Klipp's VirtualCamera will do blending. */
export function chooseCameraShot(input: ShotTriggers): NycMonShot {
  if (input.battle) return 'battle';
  if (input.encounter) return 'encounter';
  if (input.scanner) return 'scan';
  if (input.riding) return 'ride';
  return 'explore';
}
export interface CameraWithKlippPose {
  position: { set(x:number,y:number,z:number): unknown };
  quaternion: { set(x:number,y:number,z:number,w:number): unknown };
  fov: number;
  near: number;
  far: number;
  updateProjectionMatrix(): void;
}
const finiteTuple = (v: unknown,n: number): v is readonly number[] =>
  Array.isArray(v) && v.length===n && v.every(x=>typeof x==='number'&&Number.isFinite(x));
/**
 * Reject corrupt network/mod shots *before* mutating camera pose.
 * Clamp lens to a stable native/mobile range; normalize quaternion to avoid
 * gradually skewed transforms from a blended float buffer.
 */
export function validKlippShot(input: KlippCameraShot | null | undefined): KlippCameraShot | null {
  if (!input || !finiteTuple(input.position,3) || !finiteTuple(input.quaternion,4)) return null;
  if (!Number.isFinite(input.fov) || !Number.isFinite(input.near) || !Number.isFinite(input.far)) return null;
  if (input.near<=0 || input.far<=input.near || input.far>20_000) return null;
  if (input.fov<20 || input.fov>95) return null;
  const len=Math.hypot(...input.quaternion);
  if (len<1e-6 || len>2) return null;
  return {
    position: [...input.position] as unknown as Vector3,
    quaternion: input.quaternion.map(x=>x/len) as unknown as Quaternion,
    fov: input.fov,
    near: input.near,
    far: input.far,
  };
}
export function applyKlippShot(camera: CameraWithKlippPose, input: KlippCameraShot | null | undefined): boolean {
  const shot=validKlippShot(input);
  if (!shot) return false;
  camera.position.set(...shot.position);
  camera.quaternion.set(...shot.quaternion);
  if (camera.fov!==shot.fov || camera.near!==shot.near || camera.far!==shot.far) {
    camera.fov=shot.fov;
    camera.near=shot.near;
    camera.far=shot.far;
    camera.updateProjectionMatrix();
  }
  return true;
}
