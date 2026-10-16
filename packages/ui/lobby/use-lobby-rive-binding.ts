'use client';
// The lobby's copy of ../game-controls/use-rive-binding.ts, typed on
// LobbyRiveBinding (see LobbyRiveSurface.types.ts for the decision). A
// stable sink: the component keeps the live binding in a ref and writes to
// it from prop effects, never through a React render per update.
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { LobbyRiveBinding } from './lobby-rive-binding.ts';

/** What {@linkcode useLobbyRiveBinding} returns. */
export interface LobbyRiveBindingHandle {
  /** The live binding, or `null` before the view model instance exists and after it goes away. */
  readonly ref: RefObject<LobbyRiveBinding | null>;
  /** Pass as `LobbyRiveSurface`'s `onBinding`. Stable for the component's lifetime. */
  readonly onBinding: (binding: LobbyRiveBinding | null) => void;
  /** Write through the binding when it exists; a no-op before the artboard lands. */
  readonly write: (fn: (binding: LobbyRiveBinding) => void) => void;
}

/**
 * `sync` runs with the latest committed render's closure each time a binding
 * attaches, so an artboard that loads after the first render still shows the
 * current state.
 *
 * @see {@linkcode LobbyRiveSurfaceProps.onBinding}
 */
export function useLobbyRiveBinding(sync?: (binding: LobbyRiveBinding) => void): LobbyRiveBindingHandle {
  const ref = useRef<LobbyRiveBinding | null>(null);
  const latestSync = useRef(sync);
  useEffect(() => {
    latestSync.current = sync;
  });
  return useMemo<LobbyRiveBindingHandle>(
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
