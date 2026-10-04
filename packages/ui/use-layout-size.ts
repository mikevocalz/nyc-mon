'use client';
import type { LayoutChangeEvent } from 'react-native';
import { useInstanceStore, useStore } from './use-instance-store';

export type LayoutSize = { width: number; height: number };

/**
 * A view's measured size, kept in a per-instance zustand store (repo rule: no
 * React useState). Spread `onLayout` onto the view being measured; `size`
 * updates only when the width or height actually changes, so a parent
 * re-layout at the same size does not re-render the canvas below it.
 *
 * `initial` is what renders before the first layout pass. Canvas renderers
 * pass 1x1 so their geometry math never divides by zero.
 */
export function useLayoutSize(initial: LayoutSize = { width: 1, height: 1 }) {
  const store = useInstanceStore<LayoutSize>(() => initial);
  const size = useStore(store);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const current = store.getState();
    if (width !== current.width || height !== current.height) store.setState({ width, height });
  };
  return { size, onLayout };
}
