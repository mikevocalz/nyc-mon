'use client';
import type { ArrangementBackend, ArrangementPanesProps } from './arrangement.types';

/** Web and SSR never import the native library (it throws outside iOS and Android). */
export function useArrangementBackend(): ArrangementBackend {
  return 'fallback';
}

/** Web, SSR and Storybook: the existing fallback layout only (skill §9 step 4). */
export function ArrangementPanes({ fallback }: ArrangementPanesProps) {
  return <>{fallback()}</>;
}
