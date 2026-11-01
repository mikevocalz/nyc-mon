import { useMemo } from 'react';
import type { StoreApi } from 'zustand';

/**
 * Repo rule: zustand, never React useState (packages/ui/use-instance-store.ts).
 * Screens hold one instance store; these setters write a single field, take a
 * value or an updater like React's, and stay stable across renders.
 */
export type FieldSetter<V> = (next: V | ((prev: V) => V)) => void;

export type Setters<S> = { [K in keyof S]: FieldSetter<S[K]> };

export function fieldSetter<S, K extends keyof S>(store: StoreApi<S>, key: K): FieldSetter<S[K]> {
  return (next) =>
    store.setState((s) => {
      const value = typeof next === 'function' ? (next as (prev: S[K]) => S[K])(s[key]) : next;
      return { [key]: value } as unknown as Partial<S>;
    });
}

export function useSetters<S extends object>(store: StoreApi<S>): Setters<S> {
  return useMemo(() => {
    const out = {} as Setters<S>;
    for (const key of Object.keys(store.getState()) as (keyof S)[]) out[key] = fieldSetter(store, key);
    return out;
  }, [store]);
}
