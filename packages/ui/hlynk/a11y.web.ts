/**
 * PLATFORM FORK (web): accessibility props for the H-Lynk controls on real
 * DOM elements. A disabled key stays focusable (`aria-disabled`, never the
 * `disabled` attribute) so keyboard users can discover it (M01 07-a11y.md
 * "Keyboard"). The long-press name is the native tooltip (`title`).
 */

/** Options for {@linkcode controlA11y}. */
export interface ControlA11yOptions {
  /** accessible name */
  label: string;
  /** read after the name; used for the disabled hint */
  hint?: string;
  disabled: boolean;
  /** show the name enlarged on long-press (iOS Large Content Viewer, web tooltip) */
  showsLargeContent?: boolean;
  /** inside a hidden shell: leave the tab order */
  removeFromTabOrder?: boolean;
}

export function controlA11y({ label, hint, disabled, showsLargeContent, removeFromTabOrder }: ControlA11yOptions): object {
  return {
    tabIndex: removeFromTabOrder ? -1 : undefined,
    'aria-label': label,
    'aria-disabled': disabled ? true : undefined,
    'aria-description': hint,
    title: showsLargeContent ? label : undefined,
  };
}

/** Remove a subtree from the accessibility tree (decorative parts, the first-run boot shell). */
export function hiddenA11y(hidden: boolean): object {
  return hidden ? { 'aria-hidden': true } : {};
}

/** A test ID on a raw DOM control (React Native views map `testID` themselves). */
export function testIdProps(testID: string | undefined): object {
  return testID ? { 'data-testid': testID } : {};
}
