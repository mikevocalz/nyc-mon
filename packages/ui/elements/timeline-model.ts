/** Pure logic for the subway-line Timeline. No React, so node:test can run it. */

export type StationState = 'served' | 'current' | 'upcoming';
export type TimelineAlign = 'left' | 'right' | 'alternate';

/**
 * Where the train is. Stops before the first `active` item are served, the
 * active one is the current stop, and the rest are still to come. With no
 * active item the whole line has been served.
 */
export function stationStates(items: readonly { active?: boolean }[]): StationState[] {
  const current = items.findIndex((item) => item.active);
  return items.map((_, i) => (current === -1 || i < current ? 'served' : i === current ? 'current' : 'upcoming'));
}

/**
 * Track colour for the run of rail leaving station `i` (towards i + 1): lit
 * while the train has passed or is at the station it heads from, so the
 * lit route ends at the current stop.
 */
export function segmentServed(states: readonly StationState[], i: number): boolean {
  const next = states[i + 1];
  return next === 'served' || next === 'current';
}

/** Which side of the rail an item's text sits on. Alternate collapses to left on compact screens. */
export function itemSide(align: TimelineAlign, index: number, compact: boolean): 'left' | 'right' {
  if (align === 'right') return 'left';
  if (align === 'alternate' && !compact) return index % 2 === 0 ? 'right' : 'left';
  return 'right';
}
