/**
 * Pure maths for MouseCursor: how the mouse closes on the pointer, which
 * way it faces, and when it sits down. Covered by cursors.test.ts.
 */
export interface Vec {
  x: number;
  y: number;
}

/**
 * One frame of the chase. Frame-rate independent: the share of the gap
 * closed depends on elapsed time, not on how many frames ran. `speed` is
 * per second; 8 closes about 87% of the gap in a quarter second.
 */
export function chaseStep(pos: Vec, target: Vec, dtMs: number, speed: number): Vec {
  const k = 1 - Math.exp(-Math.max(0, speed) * Math.max(0, dtMs) / 1000);
  return { x: pos.x + (target.x - pos.x) * k, y: pos.y + (target.y - pos.y) * k };
}

/**
 * Facing, with a dead zone so tiny jitters don't flip the mouse back and
 * forth. Returns the previous facing inside the dead zone.
 */
export function facingLeftFor(dx: number, wasLeft: boolean, deadZone = 1.5): boolean {
  if (dx < -deadZone) return true;
  if (dx > deadZone) return false;
  return wasLeft;
}

/** Scurrying while it still has ground to cover, sitting once it has caught up and the pointer has rested. */
export function poseFor(gap: number, msSincePointerMoved: number, idleAfterMs = 900): 'run' | 'idle' {
  if (gap > 6) return 'run';
  return msSincePointerMoved >= idleAfterMs ? 'idle' : 'run';
}

/** Close enough to stop the frame loop. */
export function settled(pos: Vec, target: Vec): boolean {
  return Math.abs(target.x - pos.x) < 0.3 && Math.abs(target.y - pos.y) < 0.3;
}
