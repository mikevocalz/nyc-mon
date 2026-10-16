// Stick maths for the left analog stick and the D-pad (Master Directive v2
// §2A). Pure: no react-native import, so `node --test` covers every branch.
//
// Every function that the touch adapter calls from a gesture callback carries
// the 'worklet' directive, so react-native-worklets 0.13.0 can run it on the
// UI thread (packages/app/node_modules/react-native-worklets/lib/typescript/
// threads.native.d.ts). Under node the directive is an inert string.
import type { Direction8, StickReading, StickTuning } from './contract.ts';

/** The stick at rest: outside any gesture, inside the dead zone, or after a cancel. */
export const NEUTRAL_STICK: StickReading = { x: 0, y: 0, engaged: false, direction: 'none' };

const SQRT_HALF = Math.SQRT1_2;

/** Unit vectors for each {@linkcode Direction8}, +y up, so the D-pad can publish a {@linkcode StickReading}. */
export const DIRECTION_VECTORS: Readonly<Record<Direction8, { readonly x: number; readonly y: number }>> = {
  none: { x: 0, y: 0 },
  n: { x: 0, y: 1 },
  ne: { x: SQRT_HALF, y: SQRT_HALF },
  e: { x: 1, y: 0 },
  se: { x: SQRT_HALF, y: -SQRT_HALF },
  s: { x: 0, y: -1 },
  sw: { x: -SQRT_HALF, y: -SQRT_HALF },
  w: { x: -1, y: 0 },
  nw: { x: -SQRT_HALF, y: SQRT_HALF },
};

const SECTORS: readonly Direction8[] = ['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se'];

/**
 * Eight-way sector for a normalized stick vector (+y up). Each sector is 45°
 * wide and centred on its compass point, so east is −22.5°…22.5°. A zero
 * vector is `none`.
 *
 * @see {@linkcode readStick}, which calls this for every reading.
 */
export function direction8(x: number, y: number): Direction8 {
  'worklet';
  if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) return 'none';
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  const index = Math.round(((degrees % 360) + 360) / 45) % 8;
  return SECTORS[index] ?? 'none';
}

/**
 * Turns finger travel from the stick origin into a {@linkcode StickReading}.
 *
 * `dx`/`dy` are screen dp with +y DOWN (the gesture handler's axes); the
 * reading has +y UP as the contract requires. The radial dead zone is a
 * fraction of {@linkcode StickTuning.clampRadiusDp}; travel inside it reads
 * as neutral. Past it, the magnitude ramps from 0 at the dead-zone edge to 1
 * at the clamp radius, is multiplied by {@linkcode StickTuning.sensitivity},
 * then clamped to 1. The direction is the finger direction, so the result
 * always lies inside the unit circle: a diagonal reads as (0.71, 0.71), never
 * (1, 1).
 *
 * Non-finite input or a non-positive clamp radius reads as neutral rather
 * than throwing; the router counts the adapter's rejected calls separately.
 */
export function readStick(dx: number, dy: number, tuning: StickTuning): StickReading {
  'worklet';
  const clamp = tuning.clampRadiusDp;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(clamp) || clamp <= 0) return NEUTRAL_STICK;
  const travel = Math.hypot(dx, dy);
  const deadZone = Math.min(Math.max(tuning.deadZone, 0), 0.5) * clamp;
  if (travel <= deadZone) return NEUTRAL_STICK;
  const sensitivity = Number.isFinite(tuning.sensitivity) ? tuning.sensitivity : 1;
  const ramp = (travel - deadZone) / (clamp - deadZone);
  const magnitude = Math.min(1, Math.max(0, ramp * sensitivity));
  if (magnitude === 0) return NEUTRAL_STICK;
  // `|| 0` turns a −0 (finger exactly on an axis) into 0, so readings compare by value.
  const x = (dx / travel) * magnitude || 0;
  const y = (-dy / travel) * magnitude || 0;
  return { x, y, engaged: true, direction: direction8(x, y) };
}

/**
 * The D-pad variant of a reading: the same gesture, snapped to the eight
 * {@linkcode DIRECTION_VECTORS}. Diagonals keep unit length (0.71, 0.71), so a
 * game that integrates the stick moves at the same speed in every direction.
 *
 * @see {@linkcode readStick} for the analog reading this snaps.
 */
export function toDigitalReading(reading: StickReading): StickReading {
  'worklet';
  if (!reading.engaged || reading.direction === 'none') return NEUTRAL_STICK;
  const vector = DIRECTION_VECTORS[reading.direction];
  return { x: vector.x, y: vector.y, engaged: true, direction: reading.direction };
}

/** Two readings publish the same values, so the adapter can skip a JS hop. */
export function isSameReading(a: StickReading, b: StickReading): boolean {
  'worklet';
  return a.x === b.x && a.y === b.y && a.engaged === b.engaged && a.direction === b.direction;
}

/**
 * Where the thumbpad sits for a reading, in dp from the stick origin with
 * +y DOWN (a layout transform). The visual follows the normalized reading, so
 * the pad stops at the clamp radius while the finger keeps travelling.
 */
export function thumbOffsetDp(reading: StickReading, clampRadiusDp: number): { x: number; y: number } {
  'worklet';
  return { x: reading.x * clampRadiusDp || 0, y: -reading.y * clampRadiusDp || 0 };
}

/**
 * Floating placement: the stick origin is where the finger lands, pulled
 * inward so the whole clamp circle stays inside the control's bounds. When
 * the bounds cannot hold the circle on an axis, the origin centres on that
 * axis. Fixed placement always uses the bounds' centre.
 *
 * @see {@linkcode StickTuning.clampRadiusDp}
 */
export function stickOrigin(
  placement: 'fixed' | 'floating',
  touchX: number,
  touchY: number,
  bounds: { readonly width: number; readonly height: number },
  clampRadiusDp: number,
): { x: number; y: number } {
  'worklet';
  const centre = { x: bounds.width / 2, y: bounds.height / 2 };
  if (placement === 'fixed' || !Number.isFinite(touchX) || !Number.isFinite(touchY)) return centre;
  const clampAxis = (value: number, size: number, middle: number) =>
    size < 2 * clampRadiusDp ? middle : Math.min(Math.max(value, clampRadiusDp), size - clampRadiusDp);
  return { x: clampAxis(touchX, bounds.width, centre.x), y: clampAxis(touchY, bounds.height, centre.y) };
}

/** Options for {@linkcode leverOffsetDp}. */
export interface LeverOffsetOptions {
  /** `dpad` parks the pad on one of eight gate notches; `analog` lets it follow the finger. */
  readonly mode: 'analog' | 'dpad';
  /** Finger travel that reaches the gate, in dp (the scaled {@linkcode StickTuning.clampRadiusDp}). */
  readonly clampRadiusDp: number;
  /** Pad-centre travel at the gate, in dp. */
  readonly travelDp: number;
}

/**
 * Where the arcade-lever pad sits for a finger offset from the stick origin,
 * in dp with +y DOWN (a view transform).
 *
 * Analog: the pad follows the finger from the first dp of travel, dead zone
 * included, scaled so a finger at the clamp radius parks the pad at the gate,
 * and stops there however far the finger goes. Moving the pad inside the
 * dead zone is deliberate: a lever moves before its switch closes, and the
 * reading still stays neutral there.
 *
 * D-pad: the pad snaps to one of eight notches of an octagonal gate, every
 * notch at `travelDp` from the centre, and sits at the centre while the
 * reading is inside the dead zone.
 *
 * Non-finite input, or a non-positive radius, puts the pad at the centre.
 *
 * @see {@linkcode readStick}, which turns the same offset into the reading the router gets.
 */
export function leverOffsetDp(
  dx: number,
  dy: number,
  reading: StickReading,
  { mode, clampRadiusDp, travelDp }: LeverOffsetOptions,
): { x: number; y: number } {
  'worklet';
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !(clampRadiusDp > 0) || !(travelDp > 0)) return { x: 0, y: 0 };
  if (mode === 'dpad') {
    if (!reading.engaged || reading.direction === 'none') return { x: 0, y: 0 };
    const notch = DIRECTION_VECTORS[reading.direction];
    return { x: notch.x * travelDp || 0, y: -notch.y * travelDp || 0 };
  }
  const travel = Math.hypot(dx, dy);
  if (travel === 0) return { x: 0, y: 0 };
  const padTravel = Math.min(travel * (travelDp / clampRadiusDp), travelDp);
  return { x: (dx / travel) * padTravel || 0, y: (dy / travel) * padTravel || 0 };
}

/**
 * The lever's tilt for a pad offset, in degrees: `rotateY` follows x and
 * `rotateX` follows −y, so the cap leans toward the push with perspective,
 * reaching `maxDeg` at the gate.
 *
 * @see {@linkcode leverOffsetDp}
 */
export function leverTiltDeg(offset: { x: number; y: number }, travelDp: number, maxDeg: number): { rotateX: number; rotateY: number } {
  'worklet';
  if (!(travelDp > 0)) return { rotateX: 0, rotateY: 0 };
  return { rotateX: (-offset.y / travelDp) * maxDeg || 0, rotateY: (offset.x / travelDp) * maxDeg || 0 };
}
