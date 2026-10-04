'use client';
import { createContext, useContext } from 'react';

/**
 * Internal: true inside a shell rendered with `accessibilityHidden`. Keys and
 * the trackpad read it to leave the tab order, because a hidden subtree must
 * not hold focusable controls (WCAG 4.1.2; axe `aria-hidden-focus`).
 */
export const ShellHiddenContext = createContext(false);

export function useShellHidden(): boolean {
  return useContext(ShellHiddenContext);
}
