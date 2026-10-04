/**
 * PLATFORM FORK (native): the same contract as a11y.web.ts with React
 * Native's props. Large Content Viewer is iOS-only and ignored elsewhere.
 */
import type { ControlA11yOptions } from './a11y.web';

export type { ControlA11yOptions };

export function controlA11y({ label, hint, disabled, showsLargeContent, removeFromTabOrder }: ControlA11yOptions): object {
  return {
    focusable: removeFromTabOrder ? false : undefined,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityState: { disabled },
    accessibilityShowsLargeContentViewer: showsLargeContent ? true : undefined,
    accessibilityLargeContentTitle: showsLargeContent ? label : undefined,
  };
}

export function hiddenA11y(hidden: boolean): object {
  return hidden ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } : {};
}

export function testIdProps(testID: string | undefined): object {
  return testID ? { testID } : {};
}
