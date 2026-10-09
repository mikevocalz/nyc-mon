/**
 * PLATFORM FORK (web): always false. A desktop keyboard does not cover the
 * page, and mobile browsers resize the layout viewport themselves, which the
 * shell already measures.
 */
export function useKeyboardVisible(): boolean {
  return false;
}
