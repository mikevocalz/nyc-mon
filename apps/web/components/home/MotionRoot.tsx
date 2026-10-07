'use client';
/**
 * The page's motion boundary. One `ReactLenis` (root mode — no wrapper div,
 * Lenis smooths window scroll but leaves touch scrolling native) owns the
 * frame clock; `connectGsapLenis` with `clock: 'external'` subscribes
 * ScrollTrigger to Lenis scroll events without adding a second RAF loop.
 *
 * Reduced motion renders the same children without Lenis and without
 * arming any choreography — every `mfx-*` target simply stays visible.
 */
import { useEffect, type ReactNode } from 'react';
import { ReactLenis, useKinetrellLenis } from 'kinetrell/web/lenis';
import { connectGsapLenis } from 'kinetrell/web/gsap-lenis';
import { useBrowserReducedMotion } from 'kinetrell/web/react';
import { View } from '@acme/ui/tw';
import { useHomeMotion } from './motion';

/** Bridges the ReactLenis instance to ScrollTrigger once it exists. */
function GsapLenisBridge() {
  const lenis = useKinetrellLenis();
  useEffect(() => {
    if (!lenis) return;
    return connectGsapLenis(lenis, { clock: 'external', refreshOnConnect: true });
  }, [lenis]);
  return null;
}

function MotionFrame({ children }: { children: ReactNode }) {
  useHomeMotion();
  return <View className="w-full flex-1">{children}</View>;
}

export function MotionRoot({ children }: { children: ReactNode }) {
  const reduced = useBrowserReducedMotion();
  if (reduced) {
    return <View className="w-full flex-1">{children}</View>;
  }
  return (
    <ReactLenis root options={{ autoRaf: true }}>
      <GsapLenisBridge />
      <MotionFrame>{children}</MotionFrame>
    </ReactLenis>
  );
}
