'use client';

import dynamic from 'next/dynamic';

/**
 * GSAP, Lenis and Kinetrell are ~58 KB gzip. Loading them after hydration keeps
 * them out of the requests that start before the hero paints; motion only
 * arms below-the-fold reveals and the hero entrance replays only when
 * hydration is fast (motion.ts), so nothing visible waits on this chunk.
 */
export const HomeMotion = dynamic(() => import('./MotionRoot'), { ssr: false });
