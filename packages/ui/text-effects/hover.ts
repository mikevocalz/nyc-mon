'use client';
import { useInstanceStore, useStore } from '../use-instance-store';

/**
 * Hover-or-press state for the effect texts, in a per-instance store (repo
 * rule: no useState). Pointer enter/leave covers mouse and pen (web, iPad
 * pointers); touch start/end cover phones, so a finger held down shows the
 * hover state. Touch events observe without claiming the responder, so a
 * Pressable around the text still gets the press.
 */
export function useHot() {
  const store = useInstanceStore(() => ({ hot: false }));
  const hot = useStore(store, (s) => s.hot);
  const on = () => store.setState({ hot: true });
  const off = () => store.setState({ hot: false });
  const handlers = {
    onPointerEnter: on,
    onPointerLeave: off,
    onTouchStart: on,
    onTouchEnd: off,
    onTouchCancel: off,
  } as object;
  return { hot, handlers };
}
