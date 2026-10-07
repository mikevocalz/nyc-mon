'use client';
/**
 * The page's motion boundary. `gsap.ticker` is the only frame clock: Lenis
 * runs with `autoRaf: false` and `connectGsapLenis` (clock `'kinetrell'`,
 * kinetrell/dist/web/gsap-lenis.mjs) adds `lenis.raf` to the ticker. With
 * `clock: 'external'` plus `autoRaf: true` Lenis and GSAP each ran a RAF
 * loop (PREMIUM_SITE_BASELINE.md §2). Root mode leaves touch scroll native.
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
    return connectGsapLenis(lenis, { clock: 'kinetrell', refreshOnConnect: true });
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
    <ReactLenis root options={{ autoRaf: false }}>
      <GsapLenisBridge />
      <MotionFrame>{children}</MotionFrame>
    </ReactLenis>
  );
}
