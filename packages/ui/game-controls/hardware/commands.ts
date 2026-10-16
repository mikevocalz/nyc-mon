// The two command shapes the pure mappings hand back to the hook, which
// turns them into GameInputRouter calls. Kept apart from contract.ts because
// they are adapter-internal: the router never sees them.
import type { Phase } from '../contract.ts';

/**
 * A stick change the mapping wants published through
 * `GameInputRouter.move`. `x`/`y` are normalized −1…1 with +y up and already
 * inside the unit circle; `end` always carries (0, 0).
 */
export interface MoveCommand {
  readonly x: number;
  readonly y: number;
  readonly phase: Phase;
}

/** The three source-tagged requests the pill accepts from hardware. */
export type SessionCommand = 'pause-request' | 'resume-request' | 'stop-request';
