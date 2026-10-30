// Keyboard input for the website's city walk (/city/walk). Pure, so node --test covers every mapping; the screen
// owns the listeners and the frame loop. Held keys move the camera continuously, scaled by the frame time, so the
// speed is the same at 30 and 120 Hz. Every path ends in moveCityCamera (city-camera.ts), which clamps.
import type { CityCameraAction } from '../city-camera.ts';
import type { CityCamera } from '../city-scene.ts';

/** What a held key asks for. `reset` fires once on press and never repeats. */
export type WalkIntent = 'forward' | 'back' | 'left' | 'right' | 'turnLeft' | 'turnRight' | 'zoomIn' | 'zoomOut';

const KEY_INTENTS: Readonly<Record<string, WalkIntent>> = {
  ArrowUp: 'forward', KeyW: 'forward',
  ArrowDown: 'back', KeyS: 'back',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyQ: 'turnLeft',
  KeyE: 'turnRight',
  Equal: 'zoomIn', NumpadAdd: 'zoomIn', KeyZ: 'zoomIn',
  Minus: 'zoomOut', NumpadSubtract: 'zoomOut', KeyX: 'zoomOut',
};

/** The intent for a KeyboardEvent.code, `reset` for R or Home, or null for a key the walk does not use. */
export function intentForKey(code: string): WalkIntent | 'reset' | null {
  if (code === 'KeyR' || code === 'Home') return 'reset';
  return KEY_INTENTS[code] ?? null;
}

/** Ground speed at full hold: this fraction of the camera distance per second, so the walk feels the same at every zoom. */
export const MOVE_DISTANCE_PER_SECOND = 0.35;
/** Turn rate while Q or E is held, radians per second (a full circle in about five seconds). */
export const TURN_RADIANS_PER_SECOND = 1.25;
/** Zoom rate while a zoom key is held: the distance scales by this factor each second. */
export const ZOOM_FACTOR_PER_SECOND = 2;
/** Longest frame step integrated; a stalled tab never teleports the camera. */
export const MAX_FRAME_SECONDS = 0.1;

/**
 * The camera actions for one frame of held intents. Opposite keys cancel. Returns an empty list when nothing moves,
 * so the caller can skip the redraw.
 */
export function actionsForFrame(held: ReadonlySet<WalkIntent>, camera: CityCamera, deltaSeconds: number): CityCameraAction[] {
  const dt = Math.min(Math.max(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0), MAX_FRAME_SECONDS);
  if (dt === 0 || held.size === 0) return [];
  const axis = (positive: WalkIntent, negative: WalkIntent) => (held.has(positive) ? 1 : 0) - (held.has(negative) ? 1 : 0);
  const forward = axis('forward', 'back');
  const right = axis('right', 'left');
  const turn = axis('turnLeft', 'turnRight');
  const zoom = axis('zoomOut', 'zoomIn');
  const actions: CityCameraAction[] = [];
  if (forward !== 0 || right !== 0) {
    const step = camera.distance * MOVE_DISTANCE_PER_SECOND * dt;
    // Diagonals travel at the same speed as a straight push.
    const norm = Math.hypot(forward, right);
    actions.push({ type: 'pan', right: (right / norm) * step, forward: (forward / norm) * step });
  }
  if (turn !== 0) actions.push({ type: 'orbit', radians: turn * TURN_RADIANS_PER_SECOND * dt });
  if (zoom !== 0) actions.push({ type: 'zoom', factor: Math.pow(ZOOM_FACTOR_PER_SECOND, zoom * dt) });
  return actions;
}

/** Wheel or trackpad zoom: 500 px of scroll doubles or halves the distance. */
export function wheelToAction(deltaY: number): CityCameraAction | null {
  if (!Number.isFinite(deltaY) || deltaY === 0) return null;
  return { type: 'zoom', factor: Math.pow(2, Math.max(-500, Math.min(500, deltaY)) / 500) };
}
