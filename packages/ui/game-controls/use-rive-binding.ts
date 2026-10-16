'use client';
// A stable sink for the ArcadeRiveSurface's binding. The control keeps the
// live binding in a ref and writes to it from its input path (gesture
// callbacks hopped to JS, router listeners, prop effects), never through a
// React render per update. The ref is a stable container, not React state.
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { ArcadeRiveBinding } from './rive-binding.ts';

/** What {@linkcode useRiveBinding} returns. */
export interface RiveBindingHandle {
  /** The live binding, or `null` before the view model instance exists and after it goes away. */
  readonly ref: RefObject<ArcadeRiveBinding | null>;
  /** Pass as `ArcadeRiveSurface`'s `onBinding`. Stable for the component's lifetime. */
  readonly onBinding: (binding: ArcadeRiveBinding | null) => void;
  /** Write through the binding when it exists; a no-op before the artboard lands. */
  readonly write: (fn: (binding: ArcadeRiveBinding) => void) => void;
}

/**
 * Holds the {@linkcode ArcadeRiveBinding} a control writes to. `onBinding`
 * is created once, so the surface's effect never re-runs because of it.
 * `sync` runs with the latest committed render's closure each time a binding
 * attaches, so an artboard that loads after the first input still shows the
 * current state (labels, mode, reduced motion).
 *
 * @see {@linkcode ArcadeRiveSurfaceProps.onBinding}
 */
export function useRiveBinding(sync?: (binding: ArcadeRiveBinding) => void): RiveBindingHandle {
  const ref = useRef<ArcadeRiveBinding | null>(null);
  const latestSync = useRef(sync);
  useEffect(() => {
    latestSync.current = sync;
  });
  return useMemo<RiveBindingHandle>(
    () => ({
      ref,
      onBinding: (binding) => {
        ref.current = binding;
        if (binding && latestSync.current) latestSync.current(binding);
      },
      write: (fn) => {
        if (ref.current) fn(ref.current);
      },
    }),
    [],
  );
}
