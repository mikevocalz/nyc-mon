// The stand-in walkability moved to the world lane's real implementation
// (world/walkability.ts: building footprints plus a 0.3 m body radius).
import type { WalkQueries } from '../world/walkability.ts';
export interface WorldQueries extends WalkQueries {
  /** Actual resident triangle membership/visibility revision, not a frame counter. */
  collisionRevision?(): number;
}
