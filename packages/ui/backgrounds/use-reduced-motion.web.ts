'use client';
import { useSyncExternalStore } from 'react';

// `prefers-reduced-motion` as a live subscription, so toggling the OS setting
// stops the grid without a reload. The server pass assumes motion is allowed;
// the canvas only mounts on the client anyway (SkiaWebGate).
const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
