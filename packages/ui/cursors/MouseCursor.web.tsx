'use client';
// First: Reanimated reads __DEV__ at module load, and web bundlers don't define it.
import '../rn-globals-shim';

import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { neonColor } from '../neon/colors';
import { neonDropShadowFilter } from '../neon/glow';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { useInstanceStore, useStore } from '../use-instance-store';
import { hideOsCursor, useFinePointer } from './follower.web';
import { chaseStep, facingLeftFor, poseFor, settled, type Vec } from './chase-model';
import { CityMouse, mouseNose, type MousePose } from './mouse';
import type { CursorGlow, MouseCursorProps } from './types';

const GLOW: Record<CursorGlow, number> = { none: 0, low: 6, medium: 10, high: 16 };

interface ChaseState {
  pose: MousePose;
  facingLeft: boolean;
}

/**
 * NeonBlade's FoxCursor as a NYC-MON city mouse. It chases the pointer:
 * each frame it closes part of the gap (frame-rate independent), faces the
 * way it is running and scurries; once it has caught up and the pointer
 * rests, it sits and nibbles its pizza. `follow="snap"` pins its nose to the
 * pointer like the fox. Reduced motion snaps and holds the drawing still.
 * Mouse and pen only; touch screens render nothing.
 *
 * Position lives in Reanimated shared values written from one
 * requestAnimationFrame loop, so moving the pointer never re-renders React;
 * only a change of pose or facing does.
 */
export function MouseCursor({
  size = 48,
  follow = 'chase',
  speed = 8,
  idleAfter = 900,
  pizza = true,
  glowColor = 'royal',
  glowIntensity = 'low',
  hideNativeCursor = false,
  disabled = false,
  containerRef,
}: MouseCursorProps) {
  const fine = useFinePointer();
  const reduced = useReducedMotion();
  const snap = follow === 'snap' || reduced;
  const x = useSharedValue(-500);
  const y = useSharedValue(-500);
  const visible = useSharedValue(containerRef ? 0 : 1);
  const store = useInstanceStore<ChaseState>(() => ({ pose: 'idle', facingLeft: false }));
  const { pose, facingLeft } = useStore(store);
  const active = !disabled && fine;

  useEffect(() => {
    if (!active) return;
    const container = containerRef?.current ?? null;
    const scope = container ?? document.documentElement;
    const target: HTMLElement | Window = container ?? window;
    const origin = () => (container ? container.getBoundingClientRect() : { left: 0, top: 0 });

    // The nose stops just below and behind the pointer tip, so the mouse
    // never covers what is being pointed at.
    const goal: Vec = { x: -500, y: -500 };
    let pos: Vec = { x: -500, y: -500 };
    let lastMove = 0;
    let last = 0;
    let frame = 0;
    let started = false;

    const place = () => {
      const { facingLeft: left } = store.getState();
      const nose = mouseNose(size, left);
      x.set(pos.x - nose.x);
      y.set(pos.y - nose.y);
    };

    const tick = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      const prev = pos;
      pos = snap ? { ...goal } : chaseStep(pos, goal, dt, speed);
      const s = store.getState();
      const left = facingLeftFor(pos.x - prev.x, s.facingLeft, snap ? 0.5 : 1.5);
      const gap = Math.hypot(goal.x - pos.x, goal.y - pos.y);
      const next = poseFor(gap, now - lastMove, idleAfter);
      if (left !== s.facingLeft || next !== s.pose) store.setState({ facingLeft: left, pose: next });
      place();
      // Keep ticking until caught up and seated, then sleep until the pointer moves.
      if (!settled(pos, goal) || next === 'run') frame = requestAnimationFrame(tick);
      else frame = 0;
    };
    const wake = () => {
      if (frame) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const o = origin();
      const offset = snap ? 0 : size * 0.18;
      const left = store.getState().facingLeft;
      goal.x = e.clientX - o.left + (left ? offset : -offset);
      goal.y = e.clientY - o.top + offset;
      if (!started) {
        // First sighting: appear at the pointer rather than running in from off-screen.
        pos = { ...goal };
        started = true;
      }
      lastMove = performance.now();
      visible.set(1);
      wake();
    };
    const leave = () => visible.set(0);

    target.addEventListener('pointermove', move as EventListener, { passive: true });
    scope.addEventListener('pointerleave', leave);
    const restore = hideNativeCursor ? hideOsCursor(scope) : undefined;
    return () => {
      target.removeEventListener('pointermove', move as EventListener);
      scope.removeEventListener('pointerleave', leave);
      if (frame) cancelAnimationFrame(frame);
      restore?.();
    };
  }, [active, containerRef, hideNativeCursor, idleAfter, size, snap, speed, store, visible, x, y]);

  // Explicit dependencies: the web bundlers run without Reanimated's Babel plugin.
  const animated = useAnimatedStyle(
    () => ({ opacity: visible.get(), transform: [{ translateX: x.get() }, { translateY: y.get() }] }),
    [visible, x, y],
  );

  if (!active) return null;
  const glow = GLOW[glowIntensity];
  return (
    <Animated.View
      aria-hidden
      pointerEvents="none"
      // Web-only follower: fixed/absolute positioning above the page and a CSS
      // glow filter aren't RN classes; the transform is animated per frame.
      style={[
        {
          position: (containerRef ? 'absolute' : 'fixed') as 'absolute',
          left: 0,
          top: 0,
          zIndex: 99999,
          filter: glow ? neonDropShadowFilter(neonColor(glowColor).base, glow) : undefined,
        } as object,
        animated,
      ]}
    >
      <CityMouse size={size} pose={pose} facingLeft={facingLeft} still={reduced} pizza={pizza} />
    </Animated.View>
  );
}
