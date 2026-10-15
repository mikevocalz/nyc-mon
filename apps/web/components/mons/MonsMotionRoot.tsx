'use client';
/**
 * The /mons motion boundary, the same shape as the home page's MotionRoot:
 * `gsap.ticker` is the only frame clock. Lenis runs with `autoRaf: false`
 * and `connectGsapLenis` (clock `'kinetrell'`) adds `lenis.raf` to the
 * ticker, so one RAF loop drives scroll, ScrollTrigger and every timeline.
 *
 * It renders nothing: the page is server HTML and ./motion.ts binds to it by
 * id. Reduced motion mounts no Lenis and arms nothing, so every target stays
 * at rest and visible.
 */
import { useEffect } from 'react';
import { ReactLenis, useKinetrellLenis } from 'kinetrell/web/lenis';
import { connectGsapLenis } from 'kinetrell/web/gsap-lenis';
import { useBrowserReducedMotion } from 'kinetrell/web/react';
import { useMonsMotion } from './motion';

function GsapLenisBridge() {
  const lenis = useKinetrellLenis();
  useEffect(() => {
    if (!lenis) return;
    return connectGsapLenis(lenis, { clock: 'kinetrell', refreshOnConnect: true });
  }, [lenis]);
  return null;
}

function MotionFrame() {
  useMonsMotion();
  return null;
}

export default function MonsMotionRoot() {
  const reduced = useBrowserReducedMotion();
  if (reduced) return null;
  return (
    <ReactLenis root options={{ autoRaf: false }}>
      <GsapLenisBridge />
      <MotionFrame />
    </ReactLenis>
  );
}
