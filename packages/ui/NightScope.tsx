'use client';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { ScopedTheme } from 'uniwind';

/**
 * The neon surfaces are night facades on every page, light theme included.
 * Content that screens drop into them (kit Text with `tone="muted"`, Switch
 * labels) reads theme tokens, so on a light page it would come out dark on
 * night. This scopes the dark theme to the surface:
 * - web: the `scheme-dark` class on the face (NIGHT_SCHEME) redeclares every
 *   semantic token at its dark value (@acme/theme theme.css), so everything
 *   inside reads night; nothing to wrap.
 * - native: Uniwind's ScopedTheme resolves `dark` variables for the subtree.
 */
export const NIGHT_SCHEME = 'scheme-dark';

export function NightScope({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') return <>{children}</>;
  return <ScopedTheme theme="dark">{children}</ScopedTheme>;
}
