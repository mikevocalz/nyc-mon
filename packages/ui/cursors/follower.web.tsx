'use client';
// First: Reanimated reads __DEV__ at module load, and web bundlers don't define it.
import '../rn-globals-shim';

import { useEffect, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { useInstanceStore, useStore } from '../use-instance-store';

const FINE = '(pointer: fine)';
const subscribeFine = (cb: () => void) => {
  const list = window.matchMedia(FINE);
  list.addEventListener('change', cb);
  return () => list.removeEventListener('change', cb);
};

/** True where the primary pointer is a mouse or pen. Touch-only screens get no custom cursor. */
export function useFinePointer(): boolean {
  return useSyncExternalStore(subscribeFine, () => window.matchMedia(FINE).matches, () => false);
}

const INTERACTIVE = 'a,button,input,select,textarea,summary,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])';
const SCOPE_ATTR = 'data-nyc-cursor';

let sheet: CSSStyleSheet | null = null;
let sheetUsers = 0;

/**
 * Hide the OS cursor inside elements carrying the scope attribute. One
 * constructed stylesheet shared by every mounted cursor (no <style> tags).
 */
function hideOsCursor(el: HTMLElement): () => void {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(`[${SCOPE_ATTR}], [${SCOPE_ATTR}] * { cursor: none !important; }`);
  }
  if (sheetUsers++ === 0) document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  el.setAttribute(SCOPE_ATTR, '');
  return () => {
    el.removeAttribute(SCOPE_ATTR);
    if (--sheetUsers === 0) document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
  };
}

export interface FollowerState {
  /** Over a link, button or other interactive element. */
  hot: boolean;
  /** A button is held down. */
  pressed: boolean;
}

export interface FollowerProps {
  /** The point of the drawing that sits on the pointer, in px from its top left. */
  anchor: { x: number; y: number };
  size: number;
  hideNativeCursor: boolean;
  containerRef?: RefObject<HTMLElement | null>;
  /** CSS filter for the accent glow. */
  filter?: string;
  children: (state: FollowerState) => ReactNode;
}

/**
 * Moves a drawing with the mouse. Position lives in Reanimated shared values
 * and reaches the screen through an animated transform, so moving the mouse
 * never re-renders React; only entering or leaving an interactive element
 * (hot) and pressing do. Contained mode tracks inside `containerRef` and
 * hides when the pointer leaves it.
 */
export function Follower({ anchor, size, hideNativeCursor, containerRef, filter, children }: FollowerProps) {
  const reduced = useReducedMotion();
  const x = useSharedValue(-200);
  const y = useSharedValue(-200);
  const visible = useSharedValue(containerRef ? 0 : 1);
  const scale = useSharedValue(1);
  const store = useInstanceStore<FollowerState>(() => ({ hot: false, pressed: false }));
  const state = useStore(store);

  useEffect(() => {
    const container = containerRef?.current ?? null;
    const scope = container ?? document.documentElement;
    const target: HTMLElement | Window = container ?? window;
    const origin = () => (container ? container.getBoundingClientRect() : { left: 0, top: 0 });
    const setScale = (v: number) => scale.set(reduced ? v : withSpring(v, { damping: 18, stiffness: 420 }));
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const o = origin();
      x.set(e.clientX - o.left - anchor.x);
      y.set(e.clientY - o.top - anchor.y);
      visible.set(1);
      const hot = e.target instanceof Element && e.target.closest(INTERACTIVE) !== null;
      if (hot !== store.getState().hot) {
        store.setState({ hot });
        setScale(store.getState().pressed ? 0.85 : hot ? 1.15 : 1);
      }
    };
    const down = () => {
      store.setState({ pressed: true });
      setScale(0.85);
    };
    const up = () => {
      store.setState({ pressed: false });
      setScale(store.getState().hot ? 1.15 : 1);
    };
    const leave = () => visible.set(0);
    target.addEventListener('pointermove', move as EventListener, { passive: true });
    target.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    scope.addEventListener('pointerleave', leave);
    const restore = hideNativeCursor ? hideOsCursor(scope) : undefined;
    return () => {
      target.removeEventListener('pointermove', move as EventListener);
      target.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      scope.removeEventListener('pointerleave', leave);
      restore?.();
    };
  }, [anchor.x, anchor.y, containerRef, hideNativeCursor, reduced, scale, store, visible, x, y]);

  // Explicit dependencies: the web bundlers run without Reanimated's Babel plugin.
  const animated = useAnimatedStyle(
    () => ({
      opacity: visible.get(),
      transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
    }),
    [visible, x, y, scale],
  );

  return (
    <Animated.View
      aria-hidden
      pointerEvents="none"
      // Web-only follower: fixed/absolute positioning, the scale origin at the
      // hotspot, and a CSS glow filter are not expressible as RN classes, and
      // the transform is animated per pointer move.
      style={[
        {
          position: (containerRef ? 'absolute' : 'fixed') as 'absolute',
          left: 0,
          top: 0,
          width: size,
          height: size,
          zIndex: 99999,
          transformOrigin: `${anchor.x}px ${anchor.y}px`,
          filter,
        } as object,
        animated,
      ]}
    >
      {children(state)}
    </Animated.View>
  );
}
