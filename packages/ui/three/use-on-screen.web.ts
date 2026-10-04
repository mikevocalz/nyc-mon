'use client';
import { useEffect, type RefObject } from 'react';
import { useInstanceStore, useStore } from '../use-instance-store';

/**
 * Whether the element is on screen and its tab visible. The frame loop stops
 * when either is false, so a terrain scrolled out of view costs nothing.
 * Kept in a per-instance store (repo rule: no React useState).
 */
export function useOnScreen(target: RefObject<unknown>): boolean {
  const store = useInstanceStore(() => ({ intersecting: true, visible: true }));
  useEffect(() => {
    const element = target.current as Element | null;
    const onVisibility = () => store.setState({ visible: document.visibilityState !== 'hidden' });
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    let observer: IntersectionObserver | null = null;
    if (element instanceof Element && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver((entries) => {
        const entry = entries[entries.length - 1];
        if (entry) store.setState({ intersecting: entry.isIntersecting });
      });
      observer.observe(element);
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    };
  }, [store, target]);
  return useStore(store, (s) => s.intersecting && s.visible);
}
