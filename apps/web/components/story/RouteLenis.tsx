'use client';
/**
 * The editorial routes' motion boundary, the same wiring as the home page
 * (components/home/MotionRoot.tsx): `gsap.ticker` is the only frame clock.
 * Lenis runs with `autoRaf: false` and `connectGsapLenis` adds `lenis.raf`
 * to the ticker, so there is one RAF owner. Reduced motion mounts nothing:
 * no Lenis, no armed class, every target at rest.
 */
import { useEffect, type ReactNode } from 'react';
import { ReactLenis, useKinetrellLenis } from 'kinetrell/web/lenis';
import { connectGsapLenis } from 'kinetrell/web/gsap-lenis';
import { useBrowserReducedMotion } from 'kinetrell/web/react';

function GsapLenisBridge() {
  const lenis = useKinetrellLenis();
  useEffect(() => {
    if (!lenis) return;
    return connectGsapLenis(lenis, { clock: 'kinetrell', refreshOnConnect: true });
  }, [lenis]);
  return null;
}

/** `children` is the route's motion frame (a component that calls `useRouteMotion`). */
export function RouteLenis({ children }: { children: ReactNode }) {
  const reduced = useBrowserReducedMotion();
  if (reduced) return null;
  return (
    <ReactLenis root options={{ autoRaf: false }}>
      <GsapLenisBridge />
      {children}
    </ReactLenis>
  );
}
