'use client';
import { useCallback } from 'react';
import { useInstanceStore, useStore } from '../use-instance-store';
import type { InView, InViewOptions } from './use-in-view.types';

/**
 * Viewport position for lazy and pausable scenes. Two IntersectionObservers:
 * one with a wide margin decides when to mount (and never unmounts), one with
 * none decides whether the frame loop runs. The server pass reports neither,
 * so nothing heavy renders before hydration.
 */
export function useInView({ nearMarginPx = 600 }: InViewOptions = {}): InView {
  const store = useInstanceStore(() => ({ hasBeenNear: false, isVisible: false }));
  const hasBeenNear = useStore(store, (s) => s.hasBeenNear);
  const isVisible = useStore(store, (s) => s.isVisible);

  // Stable across renders, so React attaches the observers once per node.
  const ref = useCallback((node: object | null) => {
    if (!(node instanceof Element)) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      store.setState({ hasBeenNear: true, isVisible: true });
      return undefined;
    }
    const near = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          store.setState({ hasBeenNear: true });
          near.disconnect();
        }
      },
      { rootMargin: `${nearMarginPx}px 0px` },
    );
    const visible = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) store.setState({ isVisible: last.isIntersecting });
    });
    near.observe(node);
    visible.observe(node);
    return () => {
      near.disconnect();
      visible.disconnect();
    };
  }, [store, nearMarginPx]);

  return { ref, hasBeenNear, isVisible };
}
