'use client';
import { useSyncExternalStore } from 'react';
import { useForcedReducedMotion } from '../device-preferences';

// `prefers-reduced-motion` as a live subscription, so toggling the OS setting
// stops the grid without a reload. The server pass assumes motion is allowed;
// the canvas only mounts on the client anyway (SkiaWebGate).
const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

/** The OS setting OR the Caller's Settings override (M19). */
export function useReducedMotion(): boolean {
  const forced = useForcedReducedMotion();
  const system = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
  return forced || system;
}
