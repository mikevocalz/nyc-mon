'use client';
/**
 * The page's motion boundary. `gsap.ticker` is the only frame clock: Lenis
 * runs with `autoRaf: false` and `connectGsapLenis` (clock `'kinetrell'`,
 * kinetrell/dist/web/gsap-lenis.mjs) adds `lenis.raf` to the ticker. With
 * `clock: 'external'` plus `autoRaf: true` Lenis and GSAP each ran a RAF
 * loop (PREMIUM_SITE_BASELINE.md §2). Root mode leaves touch scroll native.
 *
 * It renders nothing: the page is server HTML and this module binds to it by
 * id. Reduced motion mounts no Lenis and arms no choreography, so every
 * `mfx-*` target stays visible.
 */
import { useEffect } from 'react';
import { ReactLenis, useKinetrellLenis } from 'kinetrell/web/lenis';
import { connectGsapLenis } from 'kinetrell/web/gsap-lenis';
import { useBrowserReducedMotion } from 'kinetrell/web/react';
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

function MotionFrame() {
  useHomeMotion();
  return null;
}

export default function MotionRoot() {
  const reduced = useBrowserReducedMotion();
  if (reduced) return null;
  return (
    <ReactLenis root options={{ autoRaf: false }}>
      <GsapLenisBridge />
      <MotionFrame />
    </ReactLenis>
  );
}
