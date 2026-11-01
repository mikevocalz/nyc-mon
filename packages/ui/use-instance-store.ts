'use client';
// Repo rule: zustand always, never React useState. For component-local state
// (multi-instance safe), hold a vanilla store in a ref and subscribe with
// useStore — refs are stable containers, not React state.
import { useRef } from 'react';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';

/**
 * One value per mounted component, created on first render and kept for the
 * component's lifetime. This is the only place the kit reads a ref during
 * render: callers get the instance back as a plain value, so their own render
 * bodies never touch `.current` and stay compilable by the React Compiler.
 */
export function useInstance<T>(create: () => T): T {
  const ref = useRef<{ value: T } | null>(null);
  ref.current ??= { value: create() };
  // eslint-disable-next-line react-hooks/refs -- write-once lazy init; the value never changes after the first render, so reading it cannot go stale
  return ref.current.value;
}

export function useInstanceStore<S>(init: () => S): StoreApi<S> {
  return useInstance(() => createStore<S>(() => init()));
}

export { useStore };
