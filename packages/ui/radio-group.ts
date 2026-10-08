/**
 * Keyboard model for a single-select radio group (WAI-ARIA APG "Radio Group").
 *
 * Arrow keys move the selection to the next / previous option and wrap at the
 * ends; Home and End jump to the first and last option. Any other key returns
 * null so the caller lets the event through (Tab, Space, Enter...).
 *
 * `current` may be -1 when no option is checked: forward keys then land on the
 * first option and backward keys on the last.
 */
export type RadioKey = 'ArrowRight' | 'ArrowDown' | 'ArrowLeft' | 'ArrowUp' | 'Home' | 'End';

export function nextRadioIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return current < 0 ? 0 : (current + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return current < 0 ? count - 1 : (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/**
 * Roving tabindex: only the checked option is a Tab stop. When nothing is
 * checked, the first option takes the stop so the group stays reachable.
 */
export function rovingTabIndex(index: number, checkedIndex: number): 0 | -1 {
  const stop = checkedIndex < 0 ? 0 : checkedIndex;
  return index === stop ? 0 : -1;
}
