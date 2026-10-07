/**
 * Focus containment for an open disclosure menu (the NavBar phone sheet).
 *
 * The ring is the menu toggle followed by every focusable element in the
 * sheet. Tab moves forward, Shift+Tab backward, and both wrap, so keyboard
 * focus never lands on page content hidden behind the open sheet
 * (WCAG 2.4.11 Focus Not Obscured).
 *
 * `current` is the index of the focused element in the ring, or -1 when focus
 * is outside it: forward then lands on the first element, backward on the
 * last. Returns null for an empty ring.
 */
export function cycleFocusIndex(current: number, count: number, backward: boolean): number | null {
  if (count <= 0) return null;
  if (current < 0) return backward ? count - 1 : 0;
  return backward ? (current - 1 + count) % count : (current + 1) % count;
}

/** Elements a keyboard user can Tab to inside a container. */
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * After a menu closes, should focus go back to its toggle? The menu unmounts
 * on close, so focus that was inside it falls to <body> (or nowhere): send it
 * back to the toggle. Focus the user already moved to a real control stays.
 */
export function shouldReturnFocus(active: { tagName?: string } | null | undefined): boolean {
  return !active || active.tagName === 'BODY';
}
