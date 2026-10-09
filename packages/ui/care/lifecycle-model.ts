/**
 * The life-stage track's data (M17 `LifecycleTrack`, DECISIONS D-15i): stages
 * the Mon has reached carry their form name; stages ahead are unnamed slots.
 * Pure.
 */

/** One slot on the track. Only reached stages carry a label; later stages carry no text and no stage word. */
export type LifecycleSlot =
  | { state: 'done'; label: string }
  | { state: 'current'; label: string }
  | { state: 'later' };

/**
 * Slots from the form names reached so far (chain order, the current stage
 * last) and the number of stages still ahead. Phase 1 Baby: `(['Metro Egg',
 * 'Squeaklet'], 3)` gives Egg ✓, Baby ●, then three ○. A branching Max counts
 * as one later slot; the caller passes the count, the kit never names it.
 */
export function lifecycleSlots(reached: readonly string[], laterCount: number): LifecycleSlot[] {
  const slots: LifecycleSlot[] = reached.map((label, i) =>
    i === reached.length - 1 ? { state: 'current', label } : { state: 'done', label },
  );
  for (let i = 0; i < Math.max(0, Math.floor(laterCount)); i += 1) slots.push({ state: 'later' });
  return slots;
}

/** Words for each slot state, from the screen's copy. The kit invents none. */
export interface LifecycleStateWords {
  done: string;
  current: string;
  later: string;
}

/** What one slot says: "Metro Egg, done", "Squeaklet, now", "Later stage". Without words, the label alone. */
export function lifecycleSlotSpoken(slot: LifecycleSlot, words?: LifecycleStateWords): string {
  if (slot.state === 'later') return words?.later ?? '';
  return words ? `${slot.label}, ${words[slot.state]}` : slot.label;
}
